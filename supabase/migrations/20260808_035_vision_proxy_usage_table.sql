-- Migration: per-user daily usage counter for the vision-proxy Edge Function
-- Date: 2026-08-08
--
-- Security audit finding: vision-proxy calls a paid OpenAI API with no rate
-- limiting or per-user quota, so any authenticated user could script
-- unbounded calls against the project owner's OPENAI_API_KEY budget. This
-- table backs a simple daily counter the function increments atomically per
-- call; RLS is enabled with no policies at all (default-deny for every
-- client role) since it's only ever read/written by the Edge Function using
-- the service_role key, which bypasses RLS -- no user, including the
-- request's own owner, should be able to read or tamper with their own
-- counter directly.

create table if not exists public.vision_proxy_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.vision_proxy_usage enable row level security;

-- EOF
