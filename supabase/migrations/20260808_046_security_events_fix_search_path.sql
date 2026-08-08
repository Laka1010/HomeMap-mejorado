-- Migration: fix search_path mutable warning on the two internal
-- security_events helpers (Supabase security advisor flagged them right
-- after 20260808_045_security_events.sql — same fix every other function in
-- this schema already has). No behavior change, just `set search_path =
-- public` added. This file mirrors, statement for statement, what was
-- already applied directly to the remote project as migration
-- 20260808181530 ("security_events_fix_search_path") so the local migration
-- history stops diverging from what's actually deployed.
-- Date: 2026-08-08

create or replace function public._security_event_client_ip()
returns inet
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw text;
begin
  v_raw := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  if v_raw is null or trim(v_raw) = '' then
    return inet_client_addr();
  end if;
  return trim(split_part(v_raw, ',', 1))::inet;
exception when others then
  return null;
end;
$$;

revoke all on function public._security_event_client_ip() from public, anon, authenticated;

create or replace function public._security_event_session_id()
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  return current_setting('request.jwt.claims', true)::json ->> 'session_id';
exception when others then
  return null;
end;
$$;

revoke all on function public._security_event_session_id() from public, anon, authenticated;

-- EOF
