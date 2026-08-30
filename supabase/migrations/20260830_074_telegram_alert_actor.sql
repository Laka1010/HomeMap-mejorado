-- Migration: el aviso de Telegram incluye qué admin ejecutó la acción
-- Date: 2026-08-30
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Los eventos de administración (20260808_050_security_center.sql:
-- admin_account_suspended, admin_account_banned, admin_ip_blocked...) ya
-- guardan quién los ejecutó en metadata.admin_id = auth.uid(). La Fase 7C
-- (20260811_066) decidió NO mandarlo a Telegram "porque es un uuid sin
-- resolver". Ahora sí se quiere: cuando llega el aviso de un baneo hay que
-- poder ver qué Security Admin lo hizo.
--
-- Esta migración solo cambia el trigger _notify_critical_security_event
-- para, además del email del usuario objetivo, resolver metadata.admin_id
-- a email (mismo join a public.profiles que ya se usa para new.user_id) y
-- mandarlo como campo 'actor_email' del payload. NUNCA se manda el uuid
-- crudo ni la metadata entera -- solo esa extracción concreta, igual que el
-- resto de campos. No toca la arquitectura (mismo trigger AFTER INSERT,
-- mismo filtro severity='critical', mismo pg_net.http_post envuelto en
-- EXCEPTION, misma autenticación por TELEGRAM_TRIGGER_SECRET).
--
-- La Edge Function (supabase/functions/notify-security-telegram) añade una
-- línea "Ejecutado por: <email>" al mensaje cuando actor_email viene
-- informado; para el resto de eventos críticos (que no llevan admin_id) el
-- campo va null y la línea simplemente no aparece.
--
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

    -- Admin que ejecutó la acción, si el evento lo registró (eventos admin_*
    -- de 20260808_050). Se resuelve a email igual que el usuario objetivo;
    -- si metadata.admin_id no es un uuid válido o no tiene perfil, queda null
    -- y el mensaje simplemente omite la línea "Ejecutado por".
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

-- El trigger ya existe (Fase 7B) y apunta a esta función por nombre --
-- CREATE OR REPLACE basta, no hace falta tocar el trigger.

-- EOF
