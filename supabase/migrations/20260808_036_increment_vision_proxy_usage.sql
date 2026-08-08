-- Migration: atomic increment for the vision-proxy daily usage counter
-- Date: 2026-08-08
--
-- Called only by the vision-proxy Edge Function via the service_role key
-- (service_role bypasses RLS, so this is the one legitimate writer of
-- vision_proxy_usage). Not granted to authenticated/anon -- there is no
-- reason a client should ever call this directly, it exists purely to make
-- the "insert or increment" a single atomic statement instead of a
-- select-then-update race.

create or replace function public.increment_vision_proxy_usage(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.vision_proxy_usage (user_id, day, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day)
  do update set count = public.vision_proxy_usage.count + 1
  returning count;
$$;

revoke execute on function public.increment_vision_proxy_usage(uuid) from public, anon, authenticated;

-- EOF
