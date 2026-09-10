-- Migration: espejo de todo el Security Center a una Google Sheet (append-only)
-- Date: 2026-09-10
--
-- ============================================================================
-- QUÉ HACE
-- ============================================================================
--
-- Copia, de forma incremental y en un solo sentido, las filas nuevas de las
-- cuatro tablas del Security Center a una hoja de cálculo de Google:
--
--   security_events            -> pestaña "security_events"
--   security_admin_audit_log   -> pestaña "security_admin_audit_log"
--   security_ip_blocks         -> pestaña "security_ip_blocks"
--   account_security_state     -> pestaña "account_security_state"
--
-- El transporte reutiliza EXACTAMENTE el patrón que ya usa la alerta de
-- Telegram (ver 20260811_065 / 20260830_076): pg_cron -> una función
-- SECURITY DEFINER que lee el secreto compartido de Vault -> net.http_post
-- asíncrono a una Edge Function (supabase/functions/export-security-to-sheet),
-- que con el service_role lee las vistas de abajo y hace el POST final a un
-- Web App de Google Apps Script. Nada nuevo en la arquitectura del proyecto.
--
-- ============================================================================
-- DECISIONES DE DISEÑO (confirmadas con el usuario del proyecto)
-- ============================================================================
--
-- 1. LOTES CADA 5 MIN, NO UN TRIGGER POR FILA. Un AFTER INSERT como el de
--    Telegram es "dispara y olvida": si la hoja está caída en ese instante,
--    esa fila se pierde para siempre. Un log de seguridad tiene que estar
--    completo. Aquí una marca de agua por tabla (security_sheet_export_state)
--    avanza SOLO cuando el POST a la hoja responde 2xx; si un lote falla, la
--    marca no se mueve y el siguiente tick lo reintenta. Coste: hasta ~5 min
--    de retardo.
--
-- 2. CERO DIRECCIONES IP EN LA HOJA. security_events.ip_address,
--    security_admin_audit_log.target_ip y security_ip_blocks.ip NO se
--    exportan. Motivo: la IP es dato personal con una política deliberada de
--    anonimización a 90 días (purge_stale_security_event_ip_addresses) y de
--    visibilidad por-admin (security_admins.can_view_ip); una Google Sheet no
--    tiene ninguna de esas dos cosas y se comparte por enlace. Para
--    investigar una IP se sigue usando el Security Center, que sí conserva el
--    dato con sus controles. Si en el futuro se quiere la IP objetivo de un
--    bloqueo (que es el asunto de la acción, no rastreo encubierto), basta
--    con añadir la columna a security_sheet_ip_blocks_v y a la Edge Function.
--
-- 3. SOLO LO NUEVO DESDE EL DESPLIEGUE. Las marcas de agua se siembran en
--    now() al aplicar esta migración: no hay volcado del histórico. Para
--    hacer un backfill puntual, poner last_exported_at a una fecha anterior
--    en security_sheet_export_state (una tabla, cuatro filas) y esperar a
--    que el cron lo drene de 500 en 500.
--
-- 4. EMAIL SÍ, uuid TAMBIÉN. Las vistas resuelven user_id/admin_id a email
--    vía profiles (igual que hacen las RPCs del panel) y además dejan el
--    uuid, para poder cruzar con el Security Center sin ambigüedad.
--
-- 5. FAIL-OPEN Y NO INVASIVO. Esta migración NO añade triggers a las tablas
--    de origen, NO toca RLS y NO modifica ninguna función existente. Si Vault
--    no tiene el secreto, o la Edge Function no está desplegada, o Google
--    responde error: el Security Center sigue funcionando igual y el cron
--    simplemente no consigue exportar hasta que se arregle. Revertir =
--    cron.unschedule('security_sheet_export_5min') + drop de los objetos de
--    abajo; no se pierde ni un dato de origen.
--
-- ============================================================================
-- PASOS DE DESPLIEGUE (esta migración es inerte hasta completarlos)
-- ============================================================================
--
--   a) Crear la Google Sheet y su Apps Script Web App
--      (ver supabase/functions/export-security-to-sheet/apps-script.gs y el
--      README de esa carpeta).
--   b) Generar dos secretos aleatorios distintos:
--        - export_sheet_trigger_secret : cron/Postgres <-> Edge Function
--        - sheet_webapp_secret         : Edge Function  <-> Apps Script
--   c) Guardar export_sheet_trigger_secret en Supabase Vault con ESE nombre:
--        select vault.create_secret('<valor>', 'export_sheet_trigger_secret');
--   d) Secrets de la Edge Function (Dashboard o `supabase secrets set`):
--        EXPORT_TRIGGER_SECRET = <mismo valor que el de Vault>
--        SHEET_WEBAPP_URL      = https://script.google.com/macros/s/AKfy.../exec
--        SHEET_WEBAPP_SECRET   = <sheet_webapp_secret>
--      (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase.)
--   e) Desplegar: supabase functions deploy export-security-to-sheet
--   f) Aplicar esta migración.
--
-- ============================================================================
-- LÍMITES CONOCIDOS
-- ============================================================================
--
--   * Google Sheets: tope duro de 10M celdas (~900k filas con estas columnas).
--     A escala de una app familiar sobra durante años; si algún día se acerca,
--     rotar de pestaña/hoja por año.
--   * Apps Script: ~20.000 llamadas UrlFetch/día y 6 min por ejecución en
--     cuentas de consumidor. Un tick cada 5 min hace como mucho 4
--     POST (uno por tabla) => ~1.150/día. Amplio margen.
--   * account_security_state se UPSERTEA (una fila por user_id): la marca de
--     agua va por updated_at, así que cada cambio de estado añade una fila
--     NUEVA a la hoja. La pestaña es un historial de transiciones, no un
--     reflejo 1:1 de la tabla. Es lo que se quiere para un log.
--   * Si dos filas comparten el mismo timestamp exacto justo en el borde de
--     un lote, la comparación `>` estricta podría saltarse una. Con
--     resolución de microsegundos y lotes de 5 min es despreciable; si
--     alguna vez importa, subir el límite del lote reduce la probabilidad a
--     cero en la práctica.
--
-- ============================================================================
-- 0. Extensiones (ya presentes por 20260811_065 / 20260808_048; idempotente)
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ============================================================================
-- 1. Marca de agua por tabla de origen
-- ============================================================================

create table public.security_sheet_export_state (
  source_table text primary key,
  watermark_column text not null,
  last_exported_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.security_sheet_export_state is
  'Marca de agua del espejo a Google Sheets. last_exported_at solo avanza cuando el POST a la hoja confirma 2xx (lo hace la Edge Function export-security-to-sheet con service_role).';

alter table public.security_sheet_export_state enable row level security;
revoke all on public.security_sheet_export_state from public, anon, authenticated;
grant select, update on public.security_sheet_export_state to service_role;

-- now() = "solo lo nuevo desde el despliegue" (decisión 3).
insert into public.security_sheet_export_state (source_table, watermark_column, last_exported_at) values
  ('security_events',          'created_at', now()),
  ('security_admin_audit_log', 'created_at', now()),
  ('security_ip_blocks',       'created_at', now()),
  ('account_security_state',   'updated_at', now());

-- ============================================================================
-- 2. Vistas de forma para la exportación
--    - SIN ninguna columna inet (decisión 2).
--    - metadata como texto JSON compacto (una celda por fila).
--    - emails resueltos vía profiles, igual que las RPCs del panel.
--    Solo las lee el service_role desde la Edge Function; se revoca del resto.
-- ============================================================================

create view public.security_sheet_events_v as
select
  e.event_id,
  e.created_at,
  e.event_type,
  e.severity,
  e.result,
  e.user_id,
  coalesce(p.email, '')                                   as user_email,
  coalesce(p.display_name, p.email, e.user_id::text, '')  as user_display,
  coalesce(e.resource_type, '')                           as resource_type,
  e.resource_id,
  coalesce(e.session_id, '')                              as session_id,
  e.metadata::text                                        as metadata_json
from public.security_events e
left join public.profiles p on p.id = e.user_id;

create view public.security_sheet_audit_v as
select
  l.id,
  l.created_at,
  l.action,
  l.admin_id,
  coalesce(ap.email, '')  as admin_email,
  l.target_user_id,
  coalesce(tp.email, '')  as target_user_email,
  coalesce(l.reason, '')  as reason,
  l.metadata::text        as metadata_json
from public.security_admin_audit_log l
left join public.profiles ap on ap.id = l.admin_id
left join public.profiles tp on tp.id = l.target_user_id;

create view public.security_sheet_ip_blocks_v as
select
  b.id,
  b.created_at,
  coalesce(b.reason, '')   as reason,
  b.severity,
  b.created_by,
  coalesce(cp.email, '')   as created_by_email,
  b.expires_at,
  b.unblocked_at,
  b.unblocked_by,
  coalesce(up.email, '')   as unblocked_by_email
from public.security_ip_blocks b
left join public.profiles cp on cp.id = b.created_by
left join public.profiles up on up.id = b.unblocked_by;

create view public.security_sheet_account_state_v as
select
  s.user_id,
  coalesce(p.email, '')         as user_email,
  s.status,
  coalesce(s.status_reason, '') as status_reason,
  s.status_set_by,
  coalesce(sp.email, '')        as status_set_by_email,
  s.status_set_at,
  s.updated_at
from public.account_security_state s
left join public.profiles p  on p.id = s.user_id
left join public.profiles sp on sp.id = s.status_set_by;

revoke all on public.security_sheet_events_v        from public, anon, authenticated;
revoke all on public.security_sheet_audit_v         from public, anon, authenticated;
revoke all on public.security_sheet_ip_blocks_v     from public, anon, authenticated;
revoke all on public.security_sheet_account_state_v from public, anon, authenticated;

grant select on public.security_sheet_events_v        to service_role;
grant select on public.security_sheet_audit_v         to service_role;
grant select on public.security_sheet_ip_blocks_v     to service_role;
grant select on public.security_sheet_account_state_v to service_role;

-- ============================================================================
-- 3. Disparador del cron: lee el secreto de Vault y llama a la Edge Function.
--    Mismo patrón, mismas garantías (EXCEPTION -> null) que
--    _notify_critical_security_event / _notify_admin_audit_event.
-- ============================================================================

create or replace function public._run_security_sheet_export()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'export_sheet_trigger_secret'
  limit 1;

  if v_secret is null or length(v_secret) = 0 then
    -- Sin secreto configurado: el espejo está "apagado". No es un error.
    return;
  end if;

  perform net.http_post(
    url := 'https://issxagrlwqubrzorahsn.supabase.co/functions/v1/export-security-to-sheet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-export-trigger-secret', v_secret
    ),
    body := '{}'::jsonb,
    -- El primer tick tras un arranque en frío de la función puede tardar
    -- varios segundos; el timeout por defecto de pg_net (5 s) lo cortaba. La
    -- función termina su trabajo por dentro aunque pg_net deje de esperar,
    -- pero con 30 s el registro de net._http_response queda completo.
    timeout_milliseconds := 30000
  );
exception when others then
  -- El espejo a Google nunca debe afectar a nada del Security Center.
  null;
end;
$$;

revoke all on function public._run_security_sheet_export() from public, anon, authenticated;

-- ============================================================================
-- 4. Programación (cada 5 minutos). unschedule previo por si se reaplica:
--    cron.schedule no es idempotente por nombre en todas las versiones.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'security_sheet_export_5min') then
    perform cron.unschedule('security_sheet_export_5min');
  end if;
end;
$$;

select cron.schedule(
  'security_sheet_export_5min',
  '*/5 * * * *',
  $$ select public._run_security_sheet_export(); $$
);

-- EOF
