-- Migration: Security Telegram Alerts — contenido del mensaje (Fase 7C)
-- Date: 2026-08-11
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Fase 7B (20260811_065_security_critical_telegram_alert.sql) mandaba un
-- mensaje fijo y genérico, sin ningún dato del evento. Esta migración NO
-- cambia la arquitectura (mismo trigger AFTER INSERT, mismo filtro
-- severity='critical', mismo pg_net.http_post asíncrono envuelto en
-- EXCEPTION, misma autenticación por TELEGRAM_TRIGGER_SECRET vía Vault) --
-- solo cambia qué payload manda el trigger a la Edge Function, para que el
-- mensaje incluya qué ocurrió.
--
-- Análisis previo (aprobado antes de esta migración): de las columnas de
-- security_events, se decidió incluir en Telegram únicamente:
--   - event_type -> traducido a texto legible por una función nueva
--     (_security_event_telegram_summary), nunca el nombre técnico crudo.
--     Fallback fijo "Evento de seguridad crítico" para cualquier
--     event_type no contemplado explícitamente (nunca se inventa una
--     traducción).
--   - user_id -> email (join a profiles, mismo dato que ya ve cualquier
--     Security Admin en el Security Center).
--   - created_at -> formateado.
--   - Un resumen corto ("details") SOLO para los 2 event_type donde ya se
--     comprobó que su metadata real es segura y útil
--     (security_suspicious_activity: recent_denials/window_minutes;
--     admin_ip_blocked: la IP objetivo del bloqueo, que es el propio
--     asunto de esa acción de admin, no la IP de un usuario). El resto de
--     event_type nunca añade "details" -- en particular, ningún
--     event_type alcanzable por log_security_event() con metadata
--     arbitraria del cliente (authz_*) extrae nada de metadata: esos dos
--     únicos event_type con "details" solo se insertan server-side
--     (_maybe_log_suspicious_activity / security_admin_block_ip), nunca
--     vía log_security_event, así que el cliente no puede inyectar texto
--     en el mensaje de Telegram a través de metadata.
--
-- Explícitamente NO se manda: ip_address (columna) -- el proyecto ya la
-- trata como dato restringido vía security_admins.can_view_ip, un control
-- más granular que "ser Security Admin"; session_id -- sin valor en
-- ningún evento crítico hasta ahora; resource_type/resource_id -- uuids
-- sin contexto legible; metadata.admin_id -- uuid sin resolver, sin
-- aportar nada que el event_type traducido no diga ya; metadata completa
-- de cualquier tipo -- solo extracción explícita por allowlist, nunca
-- JSON.stringify/jsonb_build volcado entero.
--
-- ============================================================================
-- 1. Traducción de event_type -> texto legible + resumen corto opcional.
--    Función pura (sin acceso a tablas), interna: no se concede a ningún
--    rol, solo la llama el trigger de abajo.
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
      v_label := 'Actividad sospechosa detectada';
      if p_metadata ? 'recent_denials' and p_metadata ? 'window_minutes' then
        v_details := (p_metadata ->> 'recent_denials') || ' intentos denegados en ' || (p_metadata ->> 'window_minutes') || ' min';
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

-- ============================================================================
-- 2. Trigger -- mismo mecanismo exacto de la Fase 7B, solo cambia el body
--    que se manda a la Edge Function.
-- ============================================================================

create or replace function public._notify_critical_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_email text;
  v_summary jsonb;
  v_body jsonb;
begin
  if new.severity <> 'critical' then
    return new;
  end if;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'telegram_trigger_secret'
    limit 1;

    if v_secret is null or length(v_secret) = 0 then
      return new;
    end if;

    if new.user_id is not null then
      select email into v_email from public.profiles where id = new.user_id;
    end if;

    v_summary := public._security_event_telegram_summary(new.event_type, new.metadata);

    v_body := jsonb_build_object(
      'event_label', v_summary ->> 'label',
      'user_email', v_email,
      'created_at', to_char(new.created_at at time zone 'UTC', 'DD/MM/YYYY HH24:MI') || ' UTC',
      'details', v_summary ->> 'details'
    );

    perform net.http_post(
      url := 'https://issxagrlwqubrzorahsn.supabase.co/functions/v1/notify-security-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-telegram-trigger-secret', v_secret
      ),
      body := v_body
    );
  exception when others then
    -- El fallo del sistema de alertas de Telegram nunca debe impedir que
    -- se registre security_events.
    null;
  end;

  return new;
end;
$$;

revoke all on function public._notify_critical_security_event() from public, anon, authenticated;

-- El trigger ya existe (creado en Fase 7B) y apunta a esta función por
-- nombre -- CREATE OR REPLACE de la función basta, no hace falta tocar el
-- trigger en sí.

-- EOF
