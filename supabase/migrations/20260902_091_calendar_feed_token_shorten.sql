-- Migration: calendar_feed_token_shorten
-- Date: 2026-09-02
--
-- El token del feed .ics se generaba con dos gen_random_uuid() concatenados
-- (64 hex). La URL resultante era incómodamente larga en la pantalla de
-- Ajustes de la casa. 128 bits (un solo uuid, 32 hex) son de sobra para un
-- enlace de calendario de solo lectura. Ningún hogar tenía token generado en
-- producción, así que no hay datos que migrar.
--
-- 20260902_089 en el repo ya lleva esta versión de 32 hex.

create or replace function public._gen_calendar_feed_token()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_token text;
begin
  loop
    v_token := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from public.house_calendar_feeds where token = v_token);
  end loop;
  return v_token;
end;
$$;

revoke all on function public._gen_calendar_feed_token() from public, anon, authenticated;

-- EOF
