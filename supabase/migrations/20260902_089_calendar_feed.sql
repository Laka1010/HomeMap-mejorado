-- Migration: calendar_feed (feed .ics por hogar)
-- Date: 2026-09-02
--
-- Permite suscribirse a los eventos manuales del hogar (public.calendar_events,
-- migración 088) desde Google Calendar / Apple Calendar mediante un feed
-- iCalendar de solo lectura. Las apps de calendario piden la URL sin ninguna
-- cabecera de autenticación, así que la autorización es un token secreto por
-- hogar embebido en la URL (?token=...), que la Edge Function `calendar-feed`
-- resuelve a un house_id.
--
-- Mismo patrón de RPCs `security definer` + `set search_path` que
-- 20260828_071_harden_invite_codes.sql, y misma tabla-sin-políticas (acceso
-- solo por RPC / service_role) que public.house_join_attempts.

create table if not exists public.house_calendar_feeds (
  house_id uuid primary key references public.houses(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.house_calendar_feeds enable row level security;
revoke all on public.house_calendar_feeds from public, anon, authenticated;

-- ============================================================================
-- Generador de tokens: 64 hex, URL-safe, único. Se arma con dos
-- gen_random_uuid() (en pg_catalog, siempre disponible) en vez de
-- gen_random_bytes() -- esa vive en la extensión pgcrypto, que no está en el
-- search_path 'public' de esta función.
-- ============================================================================
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

-- ============================================================================
-- calendar_feed_token(house_id): devuelve el token del hogar, creándolo la
-- primera vez. Cualquier miembro puede obtenerlo (cualquier miembro ya puede
-- leer todos los calendar_events del hogar).
-- ============================================================================
create or replace function public.calendar_feed_token(p_house_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_house_member(p_house_id) then
    raise exception 'No eres miembro de esta casa';
  end if;

  insert into public.house_calendar_feeds (house_id, token, created_by)
  values (p_house_id, public._gen_calendar_feed_token(), auth.uid())
  on conflict (house_id) do nothing;

  select token into v_token from public.house_calendar_feeds where house_id = p_house_id;
  return v_token;
end;
$$;

revoke execute on function public.calendar_feed_token(uuid) from public, anon;
grant execute on function public.calendar_feed_token(uuid) to authenticated;

-- ============================================================================
-- regenerate_calendar_feed_token(house_id): rota el token (rompe las
-- suscripciones existentes). Solo admin, igual que regenerate_invite_code.
-- ============================================================================
create or replace function public.regenerate_calendar_feed_token(p_house_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := public._gen_calendar_feed_token();
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede regenerar el enlace del calendario';
  end if;

  insert into public.house_calendar_feeds (house_id, token, created_by)
  values (p_house_id, v_token, auth.uid())
  on conflict (house_id) do update set token = excluded.token, created_by = excluded.created_by;

  return v_token;
end;
$$;

revoke execute on function public.regenerate_calendar_feed_token(uuid) from public, anon;
grant execute on function public.regenerate_calendar_feed_token(uuid) to authenticated;

-- EOF
