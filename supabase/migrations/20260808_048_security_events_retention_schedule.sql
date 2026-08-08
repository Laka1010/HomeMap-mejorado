-- Migration: programación automática de la retención de IP de security_events
-- Date: 2026-08-08
--
-- Periodo elegido: 90 días para anonimizar ip_address (poner a null),
-- SIN borrar nunca la fila del evento en sí. Motivo:
--   - Es lo bastante largo para investigar patrones lentos (credential
--     stuffing repartido en semanas, no solo picos de fuerza bruta), que es
--     justo el tipo de caso donde la IP importa más.
--   - Es lo bastante corto para no acumular un dato sensible (IP = dato
--     personal) más tiempo del que su propósito de seguridad justifica --
--     alineado con el rango habitual (30-90 días) que usan la mayoría de
--     marcos de retención de logs de seguridad.
--   - El evento en sí (event_type, severity, result, user_id, resource,
--     metadata, created_at) NO caduca en esta fase: sigue teniendo valor
--     para analítica de seguridad a más largo plazo (tendencias, auditoría
--     de una cuenta concreta) una vez despojado de la IP. Decidir un
--     periodo de borrado del EVENTO completo es una decisión de producto
--     distinta (retención de logs vs. retención de datos personales) que
--     no se toma aquí — purge_stale_security_event_ip_addresses() nunca
--     hace DELETE sobre security_events, solo UPDATE de ip_address.
--
-- Scheduler: pg_cron, ya disponible como extensión del proyecto (no hay
-- backend propio que pudiera correr un cron externo -- ver contexto en
-- 20260808_045_security_events.sql). Un único job diario hace dos cosas
-- inofensivas e idempotentes:
--   1. Anonimiza IPs de eventos con más de 90 días.
--   2. Poda filas de security_event_rate_limits de ventanas ya cerradas
--      hace más de un día (contador de spam de vida corta, sin valor
--      pasada su ventana de 1 minuto -- ver 20260808_047).
-- Ninguna de las dos toca la fila de security_events salvo la columna
-- ip_address; ninguna borra eventos de seguridad.

create extension if not exists pg_cron;

-- Job de limpieza de contadores de rate limit — se define aquí (no en la
-- migración 047) porque solo tiene sentido junto al mecanismo de
-- programación.
create or replace function public._cleanup_security_event_rate_limits()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.security_event_rate_limits
    where window_start < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public._cleanup_security_event_rate_limits() from public, anon, authenticated;

-- select cron.schedule() no es idempotente por nombre en todas las
-- versiones de pg_cron (puede duplicar el job si la migración se
-- reaplicase) -- se desprograma primero por si ya existiera.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'security_events_retention_daily') then
    perform cron.unschedule('security_events_retention_daily');
  end if;
end;
$$;

select cron.schedule(
  'security_events_retention_daily',
  '17 3 * * *',  -- 03:17 UTC a diario; hora de baja actividad, minuto impar para no competir con otros jobs "en punto"
  $$
    select public.purge_stale_security_event_ip_addresses(90);
    select public._cleanup_security_event_rate_limits();
  $$
);

-- EOF
