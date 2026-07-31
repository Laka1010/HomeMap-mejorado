-- Migration: house_activity — real shared "recent activity" feed
-- Date: 2026-07-29
--
-- "Actividad reciente de la casa" (Dashboard, Members) was rendering
-- DEMO_ACTIVITY, a hardcoded fake array seeded once per browser and never
-- updated by real actions (App.jsx even has a comment confirming this: "era
-- una lista de ejemplo, no actividad real de la casa"). This table backs a
-- real, shared-across-members log: any member can log an entry for their own
-- actions; every member of the house can read the whole feed.

create table if not exists public.house_activity (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists house_activity_house_id_idx on public.house_activity(house_id, created_at desc);

alter table public.house_activity enable row level security;

create policy "house_activity_select_members" on public.house_activity
  for select
  to authenticated
  using (public.is_house_member(house_id));

create policy "house_activity_insert_own" on public.house_activity
  for insert
  to authenticated
  with check (public.is_house_member(house_id) and user_id = auth.uid());

grant select, insert on public.house_activity to authenticated;

-- EOF
