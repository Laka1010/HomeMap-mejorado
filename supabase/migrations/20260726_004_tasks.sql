-- Migration: tasks (shared home tasks)
-- Date: 2026-07-26
--
-- Moves state.tasks from per-browser localStorage to Supabase. Like
-- rooms/zones/containers/objects (20260726_003), there is no role
-- restriction — every member (admin/adult/child) can read and write tasks,
-- since children should see and complete their own tasks. Reuses
-- public.is_house_member(uuid) from 20260726_001_houses_members_roles.sql.

create table if not exists public.tasks (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  title text not null,
  description text,
  priority text,
  date date,
  time text,
  repeat text,
  assignee text,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_house_id_idx on public.tasks(house_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.economy_set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_rw_members" on public.tasks
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

grant select, insert, update, delete on public.tasks to authenticated;

-- EOF
