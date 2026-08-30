-- Migration: alerta de "actividad repetitiva sospechosa" también por IP
-- Date: 2026-08-30
--
-- ============================================================================
-- QUÉ RESUELVE
-- ============================================================================
--
-- La Fase 2 (20260808_049_security_events_cross_access.sql) ya detecta
-- actividad repetitiva sospechosa: si un mismo user_id acumula >= 5 eventos
-- denied/failure en 10 min, se inserta un security_suspicious_activity
-- (severity 'critical'), y el trigger de Fase 7B/7C
-- (20260811_065/066) manda un aviso a Telegram.
--
-- El hueco: ese detector SOLO mira user_id. Un atacante anónimo que
-- machaca el login con emails al azar (o que aún no tiene sesión) genera
-- eventos con user_id NULL -> nunca se cruza el umbral -> ningún aviso.
-- Justo el caso "alguien intentando algo muy repetitivamente" que se
-- quería cubrir.
--
-- Esta migración añade un detector HERMANO basado en la IP del cliente,
-- que corre en paralelo al de user_id (no lo sustituye ni lo modifica):
--
--   - Ventana: 10 min. Umbral: 12 eventos "malos" desde la misma IP, donde
--     "malo" = result IN ('denied','failure') O
--     event_type = 'auth_password_reset_requested' (el spam de "olvidé mi
--     contraseña" cuenta como success/info, así que hay que incluirlo a
--     mano). Umbral más alto que el de user_id (5) porque una IP puede
--     tener detrás varios miembros legítimos de una casa (NAT doméstico) y
--     no queremos falsos positivos por 2-3 personas equivocándose de
--     contraseña a la vez.
--   - Cooldown: 30 min por IP (mismo criterio que el detector de user_id).
--   - Inserta un security_suspicious_activity con user_id NULL y
--     metadata.scope = 'ip'. Es 'critical' -> dispara el aviso de Telegram
--     existente sin tocar nada de ese mecanismo.
--   - Nunca invocable por el cliente (revoke all) y envuelto por el
--     llamante en su propio EXCEPTION: si falla, log_security_event sigue
--     registrando el evento principal igual que hoy.
--
-- NO cubre (mismo límite documentado que el rate-limit de Fase 1): abuso
-- distribuido entre muchas IPs a la vez -- eso es capa de red/WAF.
--
-- ============================================================================
-- 1. Detector por IP.
-- ============================================================================

create or replace function public._maybe_log_suspicious_activity_by_ip(p_ip inet)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_bad integer;
  v_already_flagged boolean;
begin
  if p_ip is null then
    return;
  end if;

  select count(*) into v_recent_bad
  from public.security_events
  where ip_address = p_ip
    and created_at >= now() - interval '10 minutes'
    and (
      result in ('denied', 'failure')
      or event_type = 'auth_password_reset_requested'
    );

  if v_recent_bad < 12 then
    return;
  end if;

  select exists (
    select 1 from public.security_events
    where ip_address = p_ip
      and event_type = 'security_suspicious_activity'
      and created_at >= now() - interval '30 minutes'
  ) into v_already_flagged;

  if v_already_flagged then
    return;
  end if;

  insert into public.security_events (
    user_id, event_type, severity, result, ip_address, session_id, metadata
  ) values (
    null, 'security_suspicious_activity', 'critical', 'denied',
    p_ip, public._security_event_session_id(),
    jsonb_build_object('recent_denials', v_recent_bad, 'window_minutes', 10, 'scope', 'ip')
  );
end;
$$;

revoke all on function public._maybe_log_suspicious_activity_by_ip(inet) from public, anon, authenticated;

-- ============================================================================
-- 2. log_security_event: además del detector por user_id, se llama al
--    detector por IP siempre que el evento sea "malo" (denied/failure) o una
--    solicitud de recuperación de contraseña, haya sesión o no. Cada
--    detector va en su propio bloque EXCEPTION -- un fallo en la detección
--    nunca deshace el INSERT del evento principal. El resto de la función es
--    idéntico a la versión de 20260808_049 (misma derivación de severity/
--    result, mismo rate limit, misma verificación cross-access).
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
    -- un tipo que el cliente pueda pedir directamente (lo escriben solo
    -- _maybe_log_suspicious_activity / _maybe_log_suspicious_activity_by_ip).
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

  if v_result in ('denied', 'failure') or p_event_type = 'auth_password_reset_requested' then
    begin
      perform public._maybe_log_suspicious_activity_by_ip(v_ip);
    exception when others then
      null;
    end;
  end if;
end;
$$;

revoke all on function public.log_security_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_security_event(text, text, uuid, jsonb, text) to authenticated, anon;

-- ============================================================================
-- 3. Mensaje de Telegram: distinguir si el patrón es por usuario o por IP.
--    Sigue SIN mandar la IP en claro (decisión de 20260811_066: la IP es
--    dato restringido vía security_admins.can_view_ip) -- solo se indica el
--    "scope" para que quien reciba el aviso sepa si mirar un usuario
--    concreto o un origen anónimo en el Security Center.
-- ============================================================================

create or replace function public._security_event_telegram_summary(p_event_type text, p_metadata jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_label text;
  v_details text := null;
begin
  case p_event_type
    when 'authz_cross_account_access' then
      v_label := 'Acceso no autorizado a una cuenta financiera';
    when 'authz_unauthorized_financial_operation' then
      v_label := 'Operación financiera no autorizada';
    when 'authz_permission_bypass_attempt' then
      v_label := 'Intento de saltarse permisos';
    when 'security_suspicious_activity' then
      if (p_metadata ->> 'scope') = 'ip' then
        v_label := 'Actividad repetitiva sospechosa desde una misma IP';
      else
        v_label := 'Actividad sospechosa detectada';
      end if;
      if p_metadata ? 'recent_denials' and p_metadata ? 'window_minutes' then
        v_details := (p_metadata ->> 'recent_denials') || ' intentos fallidos/denegados en ' || (p_metadata ->> 'window_minutes') || ' min';
      end if;
    when 'admin_account_suspended' then
      v_label := 'Cuenta suspendida por un administrador';
    when 'admin_account_banned' then
      v_label := 'Cuenta baneada por un administrador';
    when 'admin_ip_blocked' then
      v_label := 'IP bloqueada por un administrador';
      if p_metadata ? 'ip' then
        v_details := 'IP bloqueada: ' || (p_metadata ->> 'ip');
      end if;
    else
      -- Fallback seguro: nunca se inventa una traducción para un
      -- event_type desconocido o futuro.
      v_label := 'Evento de seguridad crítico';
  end case;

  return jsonb_build_object('label', v_label, 'details', v_details);
end;
$$;

revoke all on function public._security_event_telegram_summary(text, jsonb) from public, anon, authenticated;

-- EOF
