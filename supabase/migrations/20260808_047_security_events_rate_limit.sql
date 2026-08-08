-- Migration: rate limit server-side para log_security_event
-- Date: 2026-08-08
--
-- log_security_event sigue siendo callable por anon (imprescindible: login
-- fallido y "olvidé mi contraseña" ocurren sin sesión) y por authenticated.
-- Sin límite, cualquiera podría llamarla en bucle y llenar security_events
-- de basura -- no compromete la autorización de nada (esa sigue viviendo
-- por completo en las RPCs de negocio, sin cambios), pero sí degradaría el
-- propio sistema de logging. Este límite vive dentro de la función, no en
-- el cliente: nada que el frontend haga o deje de hacer lo evita ni lo
-- activa.
--
-- Diseño:
--   - Contador de ventana fija de 1 minuto por "identidad" (user_id si hay
--     sesión, si no la IP resuelta, si no una clave 'unknown' compartida).
--     Ventana fija en vez de sliding window: una tabla y un UPSERT
--     atómico bastan, sin extensiones ni jobs adicionales para mantenerla.
--   - Límite: 20 eventos/minuto por identidad. Cubre con margen el uso
--     legítimo más intenso previsible (varios intentos de login seguidos,
--     una ráfaga de RPCs rechazadas por un bug de UI) y acota el peor caso
--     de una identidad concreta machacando el endpoint a ~28.800 filas/día
--     en vez de un número sin techo.
--   - Por encima del límite: la llamada NO lanza error (log_security_event
--     sigue devolviendo void con normalidad) -- simplemente no inserta la
--     fila. Es un descarte silencioso, no un bloqueo visible: no le da a
--     quien esté abusando ninguna señal de que ha sido detectado, y no
--     puede romper ningún flujo real (login, cambio de contraseña...) que
--     dependa de que esta llamada nunca fallé.
--   - Si el propio limitador falla por cualquier motivo (fail-open): se
--     deja pasar el evento en vez de perderlo. Preferible arriesgarse a
--     unas pocas filas de más a arriesgarse a perder el registro de un
--     intento de fraude real por un bug en el contador.
--   - No amplía el alcance de la Fase 1: no es detección de abuso ni un
--     nuevo evento de seguridad (no se registra "has superado el límite" en
--     security_events -- eso sería auto-detección, explícitamente fuera de
--     alcance todavía), solo protege al propio almacén de logs de spam.
--
-- No cubre (riesgo documentado, ver informe): spam DISTRIBUIDO entre muchas
-- identidades/IPs distintas a la vez (un límite por identidad no frena eso
-- por diseño) -- mitigarlo pertenece a la capa de red/WAF, no a esta tabla.

-- ============================================================================
-- 1. Tabla de contadores. Vida corta y sin valor propio más allá de la
--    ventana actual -- se poda en la misma tarea programada que anonimiza
--    IPs (ver 20260808_048_security_events_retention_schedule.sql).
-- ============================================================================

create table public.security_event_rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (bucket_key, window_start)
);

alter table public.security_event_rate_limits enable row level security;

revoke all on public.security_event_rate_limits from public, anon, authenticated;

-- ============================================================================
-- 2. Contador atómico. UPSERT con ON CONFLICT DO UPDATE es la forma segura
--    de incrementar bajo concurrencia sin carreras (el lock de fila lo
--    gestiona Postgres); no hace falta bloqueo explícito.
-- ============================================================================

create or replace function public._security_event_rate_limit_ok(p_bucket_key text, p_limit integer default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  insert into public.security_event_rate_limits (bucket_key, window_start, count)
  values (p_bucket_key, v_window, 1)
  on conflict (bucket_key, window_start)
  do update set count = public.security_event_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
exception when others then
  return true;
end;
$$;

revoke all on function public._security_event_rate_limit_ok(text, integer) from public, anon, authenticated;

-- ============================================================================
-- 3. log_security_event: se añade el check de rate limit justo antes del
--    insert. Nada más de la función cambia (misma derivación de severity/
--    result, misma resolución de user_id, mismo comportamiento con email).
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
    when 'security_suspicious_activity' then v_severity := 'critical'; v_result := 'denied';
    else
      raise exception 'Tipo de evento de seguridad no válido: %', p_event_type;
  end case;

  v_user_id := auth.uid();

  if v_user_id is null and p_email is not null
     and p_event_type in ('auth_login_failure', 'auth_password_reset_requested') then
    select id into v_user_id from public.profiles where lower(email) = lower(trim(p_email));
  end if;

  v_ip := public._security_event_client_ip();

  -- Identidad para el límite: user_id si hay sesión; si no, la IP; si
  -- tampoco hay IP resoluble, un cubo 'unknown' compartido (caso raro fuera
  -- de tráfico real vía el edge de Supabase, ver nota en el helper de IP).
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
end;
$$;

revoke all on function public.log_security_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_security_event(text, text, uuid, jsonb, text) to authenticated, anon;

-- EOF
