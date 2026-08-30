-- Migration: aviso de Telegram también al DESBANEAR una cuenta
-- Date: 2026-08-30
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Hasta ahora el trigger _notify_critical_security_event solo avisaba para
-- severity = 'critical' (baneo, suspensión, acceso no autorizado...). El
-- desbaneo (admin_account_unbanned, generado por security_admin_unban_account
-- vía _security_admin_set_status) es severity 'info', así que no llegaba
-- ningún mensaje.
--
-- Este cambio:
--   1. _security_event_telegram_summary: etiqueta legible para
--      admin_account_unbanned (antes caía en el fallback genérico "Evento de
--      seguridad crítico", que además de feo era incorrecto para un
--      desbaneo).
--   2. _notify_critical_security_event: además de todos los 'critical',
--      dispara para una allowlist explícita de event_type no-críticos que
--      SÍ queremos notificar -- de momento solo 'admin_account_unbanned'.
--      Fácil de ampliar añadiendo a la lista. El resto del mecanismo no
--      cambia (mismo trigger AFTER INSERT, mismo pg_net.http_post envuelto
--      en EXCEPTION, misma auth por TELEGRAM_TRIGGER_SECRET, misma
--      resolución de user_email / actor_email de 20260830_074).
--   3. El body que va a la Edge Function lleva ahora 'severity', para que
--      el mensaje no ponga "🔴 CRITICAL" en un desbaneo. La Edge Function
--      (supabase/functions/notify-security-telegram) lo traduce a la
--      cabecera adecuada; si el campo falta, asume 'critical' (compatibilidad
--      hacia atrás).
--
-- ============================================================================
-- 1. Etiqueta legible para el desbaneo.
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
    when 'admin_account_unbanned' then
      v_label := 'Cuenta desbaneada por un administrador';
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
-- 2. Trigger: 'critical' + allowlist de no-críticos notificables.
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
  v_actor_email text;
  v_admin_id uuid;
  v_summary jsonb;
  v_body jsonb;
begin
  -- Se notifica todo lo 'critical' y, además, una lista corta y explícita
  -- de eventos no-críticos que también interesa recibir.
  if new.severity <> 'critical'
     and new.event_type not in ('admin_account_unbanned') then
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

    begin
      v_admin_id := nullif(new.metadata ->> 'admin_id', '')::uuid;
    exception when others then
      v_admin_id := null;
    end;

    if v_admin_id is not null then
      select email into v_actor_email from public.profiles where id = v_admin_id;
    end if;

    v_summary := public._security_event_telegram_summary(new.event_type, new.metadata);

    v_body := jsonb_build_object(
      'event_label', v_summary ->> 'label',
      'severity', new.severity,
      'user_email', v_email,
      'actor_email', v_actor_email,
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

-- El trigger ya existe (Fase 7B) y apunta a esta función por nombre.

-- EOF
