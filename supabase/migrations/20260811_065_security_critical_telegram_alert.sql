-- Migration: Security Telegram Alerts (Fase 7B) — sustituye a la Fase 7
-- (push FCM, revertida en 20260811191852 / commit dfc2804) por una única
-- notificación de Telegram cuando se inserta un security_event crítico.
-- Date: 2026-08-11
--
-- ============================================================================
-- CONTEXTO Y DECISIONES DE DISEÑO
-- ============================================================================
--
-- Se reutiliza EXACTAMENTE el mismo mecanismo que ya existía en la Fase 7
-- (y que el revert desmontó por completo: trigger, función, pg_net,
-- secreto de Vault): un trigger AFTER INSERT en security_events que, solo
-- para severity='critical', llama de forma asíncrona (pg_net.http_post) a
-- una Edge Function, envuelto en su propio bloque EXCEPTION para que un
-- fallo de Telegram nunca pueda impedir ni deshacer el INSERT original.
-- Nada de esto es nuevo en el proyecto, solo se recrea (pg_net fue
-- desinstalada en el revert) apuntando a una Edge Function de Telegram en
-- vez de FCM.
--
-- Diferencias deliberadas respecto a la Fase 7 (más simple, no menos
-- seguro):
--   - Sin tabla de destinatarios (push_tokens): Telegram no tiene
--     "destinatarios" por usuario que gestionar -- el chat de destino es
--     un único grupo privado fijo, ya configurado como Secret de la Edge
--     Function (TELEGRAM_CHAT_ID). No hay nada equivalente que registrar
--     ni RPC de alta/baja que crear.
--   - Sin tabla de delivery/idempotencia (security_push_delivery_log): un
--     trigger AFTER INSERT FOR EACH ROW dispara EXACTAMENTE una vez por
--     fila insertada -- es una garantía del motor de Postgres, no una
--     condición de carrera que haga falta mitigar con una tabla propia.
--     Un INSERT critical -> una llamada pg_net.http_post. warning/info ->
--     cero llamadas. pg_net ya registra sus propias peticiones/respuestas
--     en net._http_response para diagnóstico, así que tampoco hace falta
--     una tabla de log adicional.
--   - El payload que viaja del trigger a la Edge Function va vacío
--     ('{}'::jsonb): el mensaje de Telegram es fijo y genérico, así que la
--     función no necesita ---y por tanto nunca recibe--- ningún dato del
--     evento (nada de user_id, IP, metadata, tipo de evento...).
--
-- Autenticación interna: el secreto compartido trigger<->Edge Function
-- (TELEGRAM_TRIGGER_SECRET) se generó de forma criptográficamente segura
-- fuera de esta migración y vive exclusivamente en Supabase Vault (lado
-- Postgres) y como Secret de la Edge Function (lado Deno.env) -- nunca en
-- este fichero, nunca en Git. Es un secreto DISTINTO de
-- TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID (esos dos solo los usa la Edge
-- Function, nunca el trigger).
--
-- ============================================================================
-- 0. pg_net -- el revert de la Fase 7 la desinstaló tras confirmar que no
--    la usaba nada más; se vuelve a crear aquí porque este mecanismo la
--    necesita para llamar a la Edge Function sin bloquear la transacción
--    del INSERT original.
-- ============================================================================

create extension if not exists pg_net;

-- ============================================================================
-- 1. Trigger -- únicamente severity='critical', asíncrono, nunca aborta
--    el INSERT original.
-- ============================================================================

create or replace function public._notify_critical_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
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
      -- Sin secreto configurado en Vault: no se intenta el envío. No es un
      -- error -- security_events debe seguir funcionando igual con o sin
      -- el sistema de alertas de Telegram activo.
      return new;
    end if;

    perform net.http_post(
      url := 'https://issxagrlwqubrzorahsn.supabase.co/functions/v1/notify-security-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-telegram-trigger-secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    -- El fallo del sistema de alertas de Telegram nunca debe impedir que
    -- se registre security_events (mismo principio que log_security_event
    -- y que la Fase 7 original).
    null;
  end;

  return new;
end;
$$;

-- Igual que el resto de funciones de trigger del proyecto
-- (_notify_critical_security_event en la Fase 7 original, documentado en
-- 20260808_033_harden_execute_grants_and_policy_roles.sql): un trigger no
-- necesita EXECUTE concedido a ningún rol para disparar, pero Postgres
-- concede EXECUTE a PUBLIC por defecto en toda función nueva. Se revoca
-- explícitamente para que no aparezca en el advisor de seguridad.
revoke all on function public._notify_critical_security_event() from public, anon, authenticated;

drop trigger if exists security_events_notify_critical_telegram on public.security_events;
create trigger security_events_notify_critical_telegram
  after insert on public.security_events
  for each row execute function public._notify_critical_security_event();

-- EOF
