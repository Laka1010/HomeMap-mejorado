-- Migration: tabla de tipos de cambio para totales combinados multi-divisa
-- Date: 2026-09-16
--
-- ============================================================================
-- QUÉ HACE
-- ============================================================================
--
-- Cada financial_accounts.currency_code ya podía ser distinto del
-- houses.currency_code (la "divisa principal"), pero no existía ningún tipo
-- de cambio en la base de datos: el patrimonio neto, las estadísticas y el
-- resumen del dashboard simplemente sumaban los importes en crudo como si
-- todas las cuentas compartieran divisa. Esta migración añade la tabla de
-- tipos de cambio que el cliente necesita para convertir antes de sumar
-- (ver src/currency.jsx, función `convert`).
--
-- El transporte reutiliza EXACTAMENTE el patrón que ya usa el espejo a
-- Google Sheets (20260910_093_export_security_to_sheet.sql): pg_cron -> una
-- función SECURITY DEFINER que lee el secreto compartido de Vault ->
-- net.http_post asíncrono a una Edge Function
-- (supabase/functions/refresh-exchange-rates), que llama a una API pública
-- gratuita (Frankfurter, datos del BCE, sin API key) y hace el upsert final
-- con el service_role. Nada nuevo en la arquitectura del proyecto.
--
-- ============================================================================
-- DECISIONES DE DISEÑO
-- ============================================================================
--
-- 1. BASE FIJA: EUR. rate_to_eur = cuántas unidades de esa divisa vale 1 EUR
--    (la fila 'EUR' vale siempre 1). Coincide con DEFAULT_CURRENCY en
--    src/utils/currencyUtils.js. Convertir A -> B es: (importe / rate_A) *
--    rate_B, hecho en el cliente (convert() en src/currency.jsx).
--
-- 2. SOLO LAS 11 DIVISAS QUE HAVEN YA CONOCE (CURRENCIES en
--    src/utils/currencyUtils.js). No tiene sentido guardar tipos de cambio
--    de divisas que la app no deja elegir en ningún selector.
--
-- 3. SEED CON UN SNAPSHOT RAZONABLE. El cron tarda hasta 24h en correr por
--    primera vez tras el despliegue; sin seed, los totales combinados
--    saldrían en 0 o rotos mientras tanto. Los valores de abajo son una
--    foto aproximada de septiembre de 2026 — el cron los sobrescribe en
--    cuanto corre una vez.
--
-- 4. LECTURA ABIERTA A CUALQUIER USUARIO AUTENTICADO. No es un dato
--    sensible (son tipos de cambio públicos), así que no hace falta
--    filtrar por hogar ni por rol. Escritura SOLO desde el service_role
--    (la Edge Function), igual que security_sheet_export_state.
--
-- 5. FAIL-OPEN. Si el cron no llega a correr nunca (Vault sin secreto, Edge
--    Function no desplegada), la tabla se queda con el seed: los totales
--    combinados siguen funcionando, solo que con un tipo de cambio que no
--    se actualiza. Nunca rompe nada existente (no hay triggers ni cambios
--    a otras tablas).
--
-- ============================================================================
-- PASOS DE DESPLIEGUE (esta migración es inerte hasta completarlos)
-- ============================================================================
--
--   a) Generar un secreto aleatorio:
--        exchange_rates_trigger_secret : cron/Postgres <-> Edge Function
--   b) Guardarlo en Supabase Vault con ESE nombre:
--        select vault.create_secret('<valor>', 'exchange_rates_trigger_secret');
--   c) Secreto de la Edge Function (Dashboard o `supabase secrets set`):
--        EXCHANGE_RATES_TRIGGER_SECRET = <mismo valor que el de Vault>
--      (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase.)
--   d) Desplegar: supabase functions deploy refresh-exchange-rates
--   e) Aplicar esta migración.
--
-- ============================================================================
-- 0. Extensiones (ya presentes por 20260811_065 / 20260910_093; idempotente)
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ============================================================================
-- 1. Tabla de tipos de cambio
-- ============================================================================

create table public.exchange_rates (
  currency_code text primary key check (currency_code ~ '^[A-Z]{3}$'),
  rate_to_eur numeric not null check (rate_to_eur > 0),
  updated_at timestamptz not null default now()
);

comment on table public.exchange_rates is
  'Tipos de cambio contra EUR, para convertir importes entre las divisas de las cuentas al mostrar totales combinados. Se actualiza vía refresh-exchange-rates (cron diario); ver cabecera de esta migración.';

alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from public, anon, authenticated;
grant select on public.exchange_rates to authenticated;
grant select, update, insert on public.exchange_rates to service_role;

create policy exchange_rates_select_authenticated
  on public.exchange_rates for select
  to authenticated
  using (true);

-- Snapshot aproximado (septiembre 2026); el cron lo sobrescribe en su primer tick.
insert into public.exchange_rates (currency_code, rate_to_eur) values
  ('EUR', 1),
  ('USD', 1.08),
  ('GBP', 0.84),
  ('CHF', 0.94),
  ('CAD', 1.49),
  ('AUD', 1.64),
  ('JPY', 161.0),
  ('CNY', 7.75),
  ('MXN', 19.8),
  ('BRL', 6.0),
  ('ARS', 1450.0);

-- ============================================================================
-- 2. Disparador del cron: lee el secreto de Vault y llama a la Edge Function.
--    Mismo patrón que _run_security_sheet_export (20260910_093).
-- ============================================================================

create or replace function public._run_exchange_rates_refresh()
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
  where name = 'exchange_rates_trigger_secret'
  limit 1;

  if v_secret is null or length(v_secret) = 0 then
    -- Sin secreto configurado: la actualización automática está "apagada".
    -- No es un error — la tabla se queda con su último valor conocido.
    return;
  end if;

  perform net.http_post(
    url := 'https://issxagrlwqubrzorahsn.supabase.co/functions/v1/refresh-exchange-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-exchange-rates-trigger-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
exception when others then
  -- Un fallo aquí nunca debe afectar al resto de la app.
  null;
end;
$$;

revoke all on function public._run_exchange_rates_refresh() from public, anon, authenticated;

-- ============================================================================
-- 3. Programación (una vez al día, 06:00 UTC). unschedule previo por si se
--    reaplica: cron.schedule no es idempotente por nombre en todas las
--    versiones.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'exchange_rates_refresh_daily') then
    perform cron.unschedule('exchange_rates_refresh_daily');
  end if;
end;
$$;

select cron.schedule(
  'exchange_rates_refresh_daily',
  '0 6 * * *',
  $$ select public._run_exchange_rates_refresh(); $$
);

-- EOF
