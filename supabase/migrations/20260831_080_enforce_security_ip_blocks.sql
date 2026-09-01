-- Migration: aplicar de verdad los bloqueos de IP del Security Center
-- (hallazgo A-3 de la auditoría)
-- Date: 2026-08-31
--
-- PROBLEMA
-- La tabla security_ip_blocks solo se escribía y se listaba. Fuera de
-- security_admin_block_ip / _unblock_ip / _list_ip_blocks (y del contador del
-- dashboard) NINGÚN punto del sistema la consultaba: ni RLS, ni las RPCs, ni
-- las Edge Functions. "Bloquear IP" en el Security Center no bloqueaba nada.
-- Es peor que no tener la función, porque da una falsa sensación de control
-- justo durante un incidente.
--
-- SOLUCIÓN
-- Se sigue el patrón que el proyecto ya usa para las cuentas suspendidas:
-- un helper booleano que se cuelga con AND de las mismas puertas por las que
-- pasa todo. Donde hay `and not public._is_account_blocked()` ahora hay
-- también `and not public._is_ip_blocked()`.
--
-- Puertas modificadas (todas las que gobiernan RLS y economía):
--   is_house_member, is_house_admin,
--   can_access_financial_space, can_contribute_financial_space,
--   can_manage_financial_space, is_workspace_owner
-- Más log_security_event, para que una IP bloqueada deje de poder escribir
-- eventos (y de disparar alertas).
--
-- DOS DECISIONES DELIBERADAS
--
-- 1. FALLA EN ABIERTO. _is_ip_blocked() devuelve false ante cualquier error y
--    cuando no puede determinar la IP. Va dentro de is_house_member, que gate
--    todas las tablas: si fallara en cerrado, un error aquí dejaría la
--    plataforma entera inservible para todo el mundo. Mismo criterio que
--    _house_join_rate_ok en 071.
--
-- 2. is_security_admin() NO se toca, a propósito. Si el bloqueo por IP le
--    aplicara, un admin que bloqueara su propia IP (nada se lo impide) se
--    cerraría el acceso al Security Center, que es justo la herramienta
--    necesaria para deshacer el bloqueo. Un Security Admin conserva el acceso
--    al panel desde una IP bloqueada; lo que pierde, como todos, es el acceso
--    a los datos de casa y economía.
--
-- RENDIMIENTO
-- is_house_member se evalúa por fila en las políticas RLS, así que el camino
-- común tiene que ser barato. _is_ip_blocked() comprueba PRIMERO si existe
-- algún bloqueo activo -- con 0 bloqueos activos (el caso normal) sale ahí
-- mismo por el índice parcial de abajo y no llega a parsear las cabeceras.
--
-- LÍMITES CONOCIDOS (no los cierra esta migración)
--   * Supabase Auth (GoTrue) sirve /auth/v1/token, /signup y /recover fuera de
--     Postgres: una IP bloqueada puede seguir intentando iniciar sesión. Eso
--     solo se corta en el WAF/CDN.
--   * En peticiones de Storage el GUC request.headers puede no estar puesto;
--     ahí _security_event_client_ip() cae a inet_client_addr(), que es la IP
--     interna del servicio, no la del cliente. El bloqueo no muerde en esa
--     ruta (pero tampoco rompe nada: falla en abierto).
--
-- REVERSIBLE: basta con volver a crear las 6 puertas sin el `and not
-- public._is_ip_blocked()` y log_security_event sin su comprobación previa, y
-- borrar _is_ip_blocked(). No se tocan datos.

-- ============================================================================
-- 1. ÍNDICE PARCIAL PARA EL CAMINO COMÚN
--    expires_at > now() no puede ir en el predicado (now() no es inmutable),
--    así que se filtra en tiempo de ejecución sobre un índice ya reducido.
-- ============================================================================

create index if not exists security_ip_blocks_active_idx
  on public.security_ip_blocks (ip)
  where unblocked_at is null;

-- ============================================================================
-- 2. HELPER
-- ============================================================================

create or replace function public._is_ip_blocked(p_ip inet default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ip inet;
begin
  -- Camino común: sin bloqueos activos no hay nada que comprobar y no se
  -- llega a tocar las cabeceras de la petición.
  if not exists (
    select 1 from public.security_ip_blocks
    where unblocked_at is null
      and (expires_at is null or expires_at > now())
  ) then
    return false;
  end if;

  v_ip := coalesce(p_ip, public._security_event_client_ip());
  if v_ip is null then
    return false;
  end if;

  return exists (
    select 1 from public.security_ip_blocks
    where ip = v_ip
      and unblocked_at is null
      and (expires_at is null or expires_at > now())
  );
exception when others then
  -- Falla en abierto: ver nota 1 de la cabecera.
  return false;
end;
$$;

revoke all on function public._is_ip_blocked(inet) from public, anon, authenticated;

-- ============================================================================
-- 3. PUERTAS DE CASA
--    Idénticas a las desplegadas salvo el nuevo AND.
-- ============================================================================

create or replace function public.is_house_member(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid()
  ) and not public._is_account_blocked()
    and not public._is_ip_blocked();
$$;

create or replace function public.is_house_admin(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid() and role = 'admin'
  ) and not public._is_account_blocked()
    and not public._is_ip_blocked();
$$;

-- ============================================================================
-- 4. PUERTAS DE ECONOMÍA
--    OJO: can_access_financial_space sigue SIN comprobar _is_account_blocked().
--    Eso es el hallazgo M-4, que está fuera del alcance de A-3 y se deja tal
--    cual a propósito. Aquí solo se añade la comprobación de IP.
-- ============================================================================

create or replace function public.can_access_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(p_space_id, auth.uid()) is not null
    and not public._is_ip_blocked();
$$;

create or replace function public.can_contribute_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('contributor', 'manager', 'owner'), false)
    and not public._is_account_blocked()
    and not public._is_ip_blocked();
$$;

create or replace function public.can_manage_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('manager', 'owner'), false)
    and not public._is_account_blocked()
    and not public._is_ip_blocked();
$$;

create or replace function public.is_workspace_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) = 'owner', false)
    and not public._is_account_blocked()
    and not public._is_ip_blocked();
$$;

-- ============================================================================
-- 5. log_security_event: una IP bloqueada deja de poder escribir eventos
--    Idéntica a la versión de 20260831_078 salvo el bloque marcado A-3.
--    Se sale en silencio (return), como ya hace ante el rate limit o un claim
--    cross-* no verificado: registrar el evento sería justo el vector de abuso.
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
  v_caller_id uuid;
  v_user_id uuid;
  v_ip inet;
  v_rate_key text;
begin
  v_caller_id := auth.uid();

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
    when 'authz_unauthorized_financial_operation' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_rpc_rejected' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_permission_bypass_attempt' then v_severity := 'warning'; v_result := 'denied';
    else
      raise exception 'Tipo de evento de seguridad no válido: %', p_event_type;
  end case;

  if v_caller_id is null
     and p_event_type not in ('auth_login_failure', 'auth_password_reset_requested') then
    raise exception 'No autorizado: este evento de seguridad requiere sesión'
      using errcode = '42501';
  end if;

  v_user_id := v_caller_id;

  v_ip := public._security_event_client_ip();

  -- A-3: IP bloqueada -> no se registra nada. Salida silenciosa deliberada.
  if public._is_ip_blocked(v_ip) then
    return;
  end if;

  if p_event_type in ('authz_cross_account_access',
                      'authz_cross_personal_economy_access',
                      'authz_cross_workspace_access') then
    if not public._verify_cross_access_claim(p_event_type, p_resource_type, p_resource_id, v_user_id) then
      return;
    end if;
  end if;

  v_rate_key := coalesce(v_user_id::text, host(v_ip), 'unknown');

  if not public._security_event_rate_limit_ok(v_rate_key) then
    return;
  end if;

  if v_severity = 'critical' and exists (
    select 1 from public.security_events
    where event_type = p_event_type
      and user_id is not distinct from v_user_id
      and resource_id is not distinct from p_resource_id
      and created_at >= now() - interval '30 minutes'
  ) then
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

  if v_result in ('denied', 'failure')
     and v_caller_id is not null
     and v_user_id = v_caller_id then
    begin
      perform public._maybe_log_suspicious_activity(v_user_id, v_ip);
    exception when others then
      null;
    end;
  end if;

  if v_result in ('denied', 'failure') or p_event_type = 'auth_password_reset_requested' then
    begin
      perform public._maybe_log_suspicious_activity_by_ip(v_ip);
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- EOF
