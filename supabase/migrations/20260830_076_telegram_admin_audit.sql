-- Migration: cada entrada del log de auditoría de admin -> aviso a Telegram
-- Date: 2026-08-30
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- La sección "Auditoría" del panel de admin (SecurityAuditLogView -> RPC
-- security_admin_list_audit_log) lee public.security_admin_audit_log: una
-- fila por CADA acción de un Security Admin (suspender, banear, restringir y
-- sus reversos, revocar sesión(es), bloquear/desbloquear IP, conceder/quitar
-- rol de Security Admin). Se quiere recibir TODAS esas entradas por Telegram.
--
-- Diseño (mismo patrón que _notify_critical_security_event de la Fase 7B):
--   1. Trigger AFTER INSERT FOR EACH ROW en security_admin_audit_log que
--      llama de forma asíncrona (net.http_post) a la Edge Function de
--      Telegram ya existente, envuelto en su propio EXCEPTION -> un fallo de
--      Telegram nunca puede impedir ni deshacer la acción de admin ni su
--      registro de auditoría.
--   2. Reutiliza el MISMO body/Edge Function que las alertas de
--      security_events (event_label / severity / user_email / actor_email /
--      created_at / details). admin_id y target_user_id se resuelven a email
--      (join a profiles); nunca se manda el uuid crudo ni la metadata
--      entera, solo 'reason' (texto que escribe el propio admin) y, para
--      BLOCK_IP/UNBLOCK_IP, la IP objetivo (que es el asunto de la acción).
--   3. _security_admin_audit_telegram_summary traduce cada 'action' a una
--      etiqueta legible y le asigna un nivel para la cabecera del mensaje
--      (🟠 para acciones que aplican una sanción / escalan privilegios,
--      🟢 para las que la retiran). Fallback fijo para acciones futuras.
--
-- Para no duplicar avisos: _notify_critical_security_event deja de notificar
-- los event_type 'admin_*' de security_events (baneo, suspensión,
-- desbaneo...) -- ahora esos llegan por este trigger, con más contexto
-- (motivo exacto, acción). El trigger de security_events sigue cubriendo lo
-- que NO pasa por el log de admin: detección automática de actividad
-- sospechosa, accesos cruzados, intentos de saltarse permisos.
--
-- ============================================================================
-- 1. Traducción de action -> etiqueta + nivel + detalle corto.
-- ============================================================================

create or replace function public._security_admin_audit_telegram_summary(
  p_action text,
  p_reason text,
  p_target_ip inet,
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_label text;
  v_severity text;
  v_details text := null;
begin
  case p_action
    when 'GRANT_SECURITY_ADMIN'  then v_label := 'Rol de Security Admin concedido'; v_severity := 'warning';
    when 'REVOKE_SECURITY_ADMIN' then v_label := 'Rol de Security Admin retirado';  v_severity := 'warning';
    when 'SUSPEND_ACCOUNT'       then v_label := 'Cuenta suspendida';               v_severity := 'warning';
    when 'UNSUSPEND_ACCOUNT'     then v_label := 'Suspensión retirada';             v_severity := 'info';
    when 'RESTRICT_ACCOUNT'      then v_label := 'Cuenta restringida';              v_severity := 'warning';
    when 'UNRESTRICT_ACCOUNT'    then v_label := 'Restricción retirada';            v_severity := 'info';
    when 'BAN_ACCOUNT'           then v_label := 'Cuenta baneada';                  v_severity := 'warning';
    when 'UNBAN_ACCOUNT'         then v_label := 'Cuenta desbaneada';               v_severity := 'info';
    when 'REVOKE_SESSION'        then v_label := 'Sesión revocada';                 v_severity := 'info';
    when 'REVOKE_ALL_SESSIONS'   then v_label := 'Todas las sesiones revocadas';    v_severity := 'warning';
    when 'BLOCK_IP'              then v_label := 'IP bloqueada';                    v_severity := 'warning';
    when 'UNBLOCK_IP'            then v_label := 'IP desbloqueada';                 v_severity := 'info';
    else
      v_label := 'Acción de administración: ' || coalesce(p_action, '?');
      v_severity := 'info';
  end case;

  if p_target_ip is not null then
    v_details := 'IP: ' || host(p_target_ip);
  end if;

  if p_action = 'REVOKE_ALL_SESSIONS' and p_metadata ? 'sessions_revoked' then
    v_details := coalesce(v_details || ' — ', '') || (p_metadata ->> 'sessions_revoked') || ' sesiones';
  end if;

  if p_reason is not null and length(trim(p_reason)) > 0 then
    v_details := coalesce(v_details || ' — ', '') || 'Motivo: ' || trim(p_reason);
  end if;

  return jsonb_build_object('label', v_label, 'severity', v_severity, 'details', v_details);
end;
$$;

revoke all on function public._security_admin_audit_telegram_summary(text, text, inet, jsonb) from public, anon, authenticated;

-- ============================================================================
-- 2. Trigger sobre security_admin_audit_log.
-- ============================================================================

create or replace function public._notify_admin_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_actor_email text;
  v_target_email text;
  v_summary jsonb;
  v_body jsonb;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'telegram_trigger_secret'
    limit 1;

    if v_secret is null or length(v_secret) = 0 then
      return new;
    end if;

    if new.admin_id is not null then
      select email into v_actor_email from public.profiles where id = new.admin_id;
    end if;
    if new.target_user_id is not null then
      select email into v_target_email from public.profiles where id = new.target_user_id;
    end if;

    v_summary := public._security_admin_audit_telegram_summary(new.action, new.reason, new.target_ip, new.metadata);

    v_body := jsonb_build_object(
      'event_label', v_summary ->> 'label',
      'severity', v_summary ->> 'severity',
      'user_email', v_target_email,
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
    -- El aviso de Telegram nunca debe romper ni deshacer la acción de admin.
    null;
  end;

  return new;
end;
$$;

revoke all on function public._notify_admin_audit_event() from public, anon, authenticated;

drop trigger if exists security_admin_audit_notify_telegram on public.security_admin_audit_log;
create trigger security_admin_audit_notify_telegram
  after insert on public.security_admin_audit_log
  for each row execute function public._notify_admin_audit_event();

-- ============================================================================
-- 3. security_events: dejar de notificar los admin_* (los cubre el trigger
--    de arriba). Se mantiene todo lo demás igual que en 20260830_075/074.
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
  -- Los eventos admin_* ahora los notifica el trigger de
  -- security_admin_audit_log (mensaje con motivo y acción exactos).
  if starts_with(new.event_type, 'admin_') then
    return new;
  end if;

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
    null;
  end;

  return new;
end;
$$;

revoke all on function public._notify_critical_security_event() from public, anon, authenticated;

-- EOF
