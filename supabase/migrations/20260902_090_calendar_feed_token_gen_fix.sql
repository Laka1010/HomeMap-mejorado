-- Migration: calendar_feed_token_gen_fix
-- Date: 2026-09-02
--
-- Corrige _gen_calendar_feed_token() de 20260902_089: usaba
-- gen_random_bytes(18), que vive en la extensión pgcrypto y NO está en el
-- search_path 'public' de la función (falla con "function gen_random_bytes
-- does not exist"). Se rehace con dos gen_random_uuid() (pg_catalog, siempre
-- disponible) -> 64 hex. Ningún token se había generado todavía, así que no
-- hay datos que migrar.
--
-- 20260902_089 en el repo ya lleva esta versión corregida; esta migración
-- existe solo para que la base de datos remota, donde 089 se aplicó con la
-- versión rota, quede alineada.

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
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from public.house_calendar_feeds where token = v_token);
  end loop;
  return v_token;
end;
$$;

revoke all on function public._gen_calendar_feed_token() from public, anon, authenticated;

-- EOF
