-- Migration: Security Events (Fase 2) — cross-access e indicios de actividad
-- sospechosa
-- Date: 2026-08-08
--
-- ============================================================================
-- POR QUÉ ESTÁ HECHO ASÍ (análisis previo, resumen)
-- ============================================================================
--
-- Todas las tablas del módulo de Economía (financial_accounts,
-- financial_spaces, financial_space_members, economy_*) usan políticas RLS
-- de SELECT que son un simple filtro booleano (can_access_financial_space(...)):
--
--   create policy financial_accounts_select on financial_accounts
--     for select using (can_access_financial_space(financial_space_id));
--
-- Postgres no tiene ningún hook para "una fila fue descartada por una
-- política RLS" -- no existe un trigger de SELECT (Postgres no los soporta
-- en absoluto, no es una limitación de Supabase) ni ninguna señal que
-- distinga, desde dentro de la base de datos, "0 filas porque no tienes
-- acceso" de "0 filas porque no había nada que buscar". Un
-- `GET /rest/v1/financial_accounts?id=eq.<ajena>` hecho SALTÁNDOSE el
-- frontend (PostgREST traduce la petición directamente a un SELECT con RLS)
-- es, por tanto, estructuralmente invisible para cualquier función o
-- trigger de Postgres. Verificarlo no es opcional: es una limitación real
-- del motor, confirmada antes de escribir una sola línea de esta migración.
--
-- Lo único que SÍ es observable desde el cliente sin tocar RLS ni añadir
-- RPCs nuevas de las que nadie sea dueño: las llamadas que ya usan
-- `.single()`, porque PostgREST lanza un error real (PGRST116, "0 rows")
-- cuando la fila esperada no aparece -- ya sea porque no existe o porque
-- RLS la filtró. Se han localizado dos puntos así, ya existentes en el
-- código, sin necesidad de crear ninguna tabla, política ni RPC nueva para
-- el propio dato:
--   - financialSpacesService.getHouseholdSpace(houseId) -> cubre
--     authz_cross_workspace_access para el sub-tipo 'household'.
--   - accountsService.updateAccount(accountId, updates) -> cubre
--     authz_cross_account_access (un UPDATE cuyo USING de RLS filtra la fila
--     también devuelve 0 filas en el RETURNING que sintetiza `.select()`,
--     mismo mecanismo). deleteAccount() se instrumenta en paralelo
--     añadiendo `.select()` (antes no devolvía nada que inspeccionar) SIN
--     cambiar su comportamiento para un borrado legítimo.
--
-- authz_cross_personal_economy_access y el sub-tipo 'shared' de
-- authz_cross_workspace_access NO tienen hoy un punto así: la app nunca
-- hace un `.single()` sobre la economía Personal de OTRO usuario ni sobre
-- un espacio compartido ajeno -- toda esa lectura ocurre vía listados
-- (`.select()` sin `.single()`, silenciosos) o ni siquiera existe todavía
-- como funcionalidad (no hay pantalla que abra "la economía personal de
-- fulano" por id). Crear un endpoint nuevo solo para tener algo que loguear
-- sería exactamente el "cambio arriesgado para conseguir el log" que se
-- pidió evitar: nadie lo llamaría de forma legítima, y un atacante que
-- salte el frontend seguiría sin pasar por él -- cero beneficio real de
-- detección, superficie nueva de más. Por eso NO se instrumentan estos dos
-- casos en un call site del cliente. Lo que SÍ se hace: el mecanismo de
-- verificación (_verify_cross_access_claim, abajo) soporta las 4
-- combinaciones completas (cuenta / economía personal por usuario o por
-- espacio / workspace shared o household) y está probado directamente vía
-- RPC en la batería de pruebas -- listo para conectarse el día que exista
-- un punto de lectura real que lo justifique, sin tener que tocar esta
-- función otra vez.
--
-- ============================================================================
-- DISEÑO: verificación server-side de lo que el cliente afirma
-- ============================================================================
--
-- Fase 1 ya impedía falsificar user_id/severity/result (siempre derivados
-- en el servidor). Lo que faltaba: el cliente SÍ podía elegir libremente
-- resource_type/resource_id, así que nada impedía reportar
-- 'authz_cross_account_access' sobre una cuenta que en realidad SÍ es
-- suya, o sobre un id que no existe. Para estas 3 categorías nuevas, el
-- resource_type/resource_id que manda el cliente pasa a ser solo una PISTA:
-- log_security_event vuelve a comprobar la verdad con las mismas funciones
-- que ya usa RLS (can_access_financial_space) antes de aceptar el evento.
-- Si la pista no se sostiene -- recurso inexistente, tipo equivocado, o el
-- llamante en realidad SÍ tiene acceso (p.ej. se lo concedieron después) --
-- no se registra nada. Se prefiere perder algún evento real dudoso a
-- generar falsos positivos.
--
-- ============================================================================
-- DISEÑO: security_suspicious_activity
-- ============================================================================
--
-- Regla fija y transparente, no un score ni un clasificador: si el mismo
-- user_id acumula 5 o más eventos con result IN ('denied','failure') en una
-- ventana de 10 minutos, se registra UN evento security_suspicious_activity
-- (con cooldown de 30 minutos para no repetirlo en bucle). No es un tipo
-- que el cliente pueda pedir directamente -- no aparece en el CASE de
-- log_security_event, así que un intento de solicitarlo cae en el mismo
-- "tipo de evento no válido" que cualquier valor inventado. Solo lo escribe
-- _maybe_log_suspicious_activity, siempre desde dentro del servidor, tras
-- confirmar el patrón con una consulta a la propia tabla. Ninguna acción
-- automática se dispara a partir de esto todavía (ni bloqueo, ni
-- suspensión, ni revocación de sesión) -- eso queda fuera de esta fase.
--
-- ============================================================================
-- 1. Verificación server-side de la identidad del recurso reclamado
-- ============================================================================

create or replace function public._verify_cross_access_claim(
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_caller_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_space_type text;
begin
  if p_caller_id is null or p_resource_id is null or p_resource_type is null then
    return false;
  end if;

  if p_event_type = 'authz_cross_account_access' then
    if p_resource_type <> 'financial_account' then
      return false;
    end if;

    select financial_space_id into v_space_id
    from public.financial_accounts
    where id = p_resource_id;

    if v_space_id is null then
      return false;
    end if;

    return not public.can_access_financial_space(v_space_id);
  end if;

  if p_event_type = 'authz_cross_personal_economy_access' then
    if p_resource_type = 'user' then
      if p_resource_id = p_caller_id then
        return false;
      end if;
      select id into v_space_id
      from public.financial_spaces
      where owner_id = p_resource_id and type = 'personal'
      limit 1;
    elsif p_resource_type = 'financial_space' then
      select id into v_space_id
      from public.financial_spaces
      where id = p_resource_id and type = 'personal'
      limit 1;
    else
      return false;
    end if;

    if v_space_id is null then
      return false;
    end if;

    return not public.can_access_financial_space(v_space_id);
  end if;

  if p_event_type = 'authz_cross_workspace_access' then
    if p_resource_type = 'financial_space' then
      select type into v_space_type from public.financial_spaces where id = p_resource_id;
      if v_space_type is null or v_space_type not in ('shared', 'household') then
        return false;
      end if;
      return not public.can_access_financial_space(p_resource_id);
    elsif p_resource_type = 'house' then
      select id into v_space_id
      from public.financial_spaces
      where house_id = p_resource_id and type = 'household'
      limit 1;
      if v_space_id is null then
        return false;
      end if;
      return not public.can_access_financial_space(v_space_id);
    else
      return false;
    end if;
  end if;

  return false;
exception when others then
  -- Cualquier fallo al verificar se trata como "no confirmado": nunca se
  -- registra un evento sobre una afirmación que no se ha podido comprobar.
  return false;
end;
$$;

revoke all on function public._verify_cross_access_claim(text, text, uuid, uuid) from public, anon, authenticated;

-- ============================================================================
-- 2. Umbral de actividad sospechosa (solo lectura de security_events + un
--    insert directo, nunca invocable por el cliente).
-- ============================================================================

create or replace function public._maybe_log_suspicious_activity(p_user_id uuid, p_ip inet)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_denials integer;
  v_already_flagged boolean;
begin
  select count(*) into v_recent_denials
  from public.security_events
  where user_id = p_user_id
    and result in ('denied', 'failure')
    and created_at >= now() - interval '10 minutes';

  if v_recent_denials < 5 then
    return;
  end if;

  select exists (
    select 1 from public.security_events
    where user_id = p_user_id
      and event_type = 'security_suspicious_activity'
      and created_at >= now() - interval '30 minutes'
  ) into v_already_flagged;

  if v_already_flagged then
    return;
  end if;

  insert into public.security_events (
    user_id, event_type, severity, result, ip_address, session_id, metadata
  ) values (
    p_user_id, 'security_suspicious_activity', 'critical', 'denied',
    p_ip, public._security_event_session_id(),
    jsonb_build_object('recent_denials', v_recent_denials, 'window_minutes', 10)
  );
end;
$$;

revoke all on function public._maybe_log_suspicious_activity(uuid, inet) from public, anon, authenticated;

-- ============================================================================
-- 3. log_security_event: se añade la verificación de las 3 categorías
--    "cross access" antes del insert, y la comprobación de umbral después
--    (dentro de su propio bloque exception -- un fallo ahí no debe impedir
--    que el evento principal, ya insertado, quede registrado). Nada más
--    cambia respecto a la versión de Fase 1 (mismo rate limit, misma
--    derivación de severity/result, misma resolución de user_id).
-- ============================================================================

create or replace function public.log_security_event(
  p_event_type text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severity text;
  v_result text;
  v_user_id uuid;
  v_ip inet;
  v_rate_key text;
begin
  case p_event_type
    when 'auth_login_success' then v_severity := 'info'; v_result := 'success';
    when 'auth_login_failure' then v_severity := 'warning'; v_result := 'failure';
    when 'auth_logout' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_change' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_reset_requested' then v_severity := 'info'; v_result := 'success';
    when 'auth_email_change' then v_severity := 'warning'; v_result := 'success';
    when 'authz_cross_account_access' then v_severity := 'critical'; v_result := 'denied';
    when 'authz_cross_personal_economy_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_cross_workspace_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_unauthorized_write' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_unauthorized_financial_operation' then v_severity := 'critical'; v_result := 'denied';
    when 'authz_rpc_rejected' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_permission_bypass_attempt' then v_severity := 'critical'; v_result := 'denied';
    -- security_suspicious_activity NO está en esta lista a propósito: no es
    -- un tipo que el cliente pueda pedir directamente (ver
    -- _maybe_log_suspicious_activity arriba). Cualquier intento de pedirlo
    -- cae en el "else" de abajo, igual que un tipo inventado.
    else
      raise exception 'Tipo de evento de seguridad no válido: %', p_event_type;
  end case;

  v_user_id := auth.uid();

  if v_user_id is null and p_email is not null
     and p_event_type in ('auth_login_failure', 'auth_password_reset_requested') then
    select id into v_user_id from public.profiles where lower(email) = lower(trim(p_email));
  end if;

  if p_event_type in ('authz_cross_account_access', 'authz_cross_personal_economy_access', 'authz_cross_workspace_access') then
    if not public._verify_cross_access_claim(p_event_type, p_resource_type, p_resource_id, v_user_id) then
      return;
    end if;
  end if;

  v_ip := public._security_event_client_ip();
  v_rate_key := coalesce(v_user_id::text, host(v_ip), 'unknown');

  if not public._security_event_rate_limit_ok(v_rate_key) then
    return;
  end if;

  insert into public.security_events (
    user_id, event_type, severity, result, ip_address, session_id,
    resource_type, resource_id, metadata
  ) values (
    v_user_id, p_event_type, v_severity, v_result,
    v_ip, public._security_event_session_id(),
    p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb)
  );

  if v_result in ('denied', 'failure') and v_user_id is not null then
    begin
      perform public._maybe_log_suspicious_activity(v_user_id, v_ip);
    exception when others then
      null;
    end;
  end if;
end;
$$;

revoke all on function public.log_security_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_security_event(text, text, uuid, jsonb, text) to authenticated, anon;

-- EOF
