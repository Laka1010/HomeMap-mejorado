-- Migration: capture categories/notes/shopping_lists/shopping_items into history
-- Date: 2026-08-08
--
-- Security audit finding: these 4 tables exist in production with correct
-- RLS (is_house_member(house_id), verified live) but were never created by
-- any tracked migration -- they were made directly against the database at
-- some point, outside code review and without a record of their original
-- schema/policies. This migration is a no-op on the live database (every
-- statement is IF NOT EXISTS / DROP+CREATE, safe to run against the
-- existing tables) -- its only purpose is to give the migration history a
-- complete, reviewable record of what already exists, so future changes to
-- these tables go through the same review process as everything else.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  text text not null,
  pinned boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  category text,
  price numeric(12, 2),
  link text,
  notes text,
  photo text,
  quantity integer default 1,
  priority text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  list_id uuid references public.shopping_lists(id) on delete set null,
  source_task_id text,
  favorite boolean not null default false
);

create index if not exists categories_house_id_idx on public.categories(house_id);
create index if not exists notes_house_id_idx on public.notes(house_id);
create index if not exists shopping_lists_house_id_idx on public.shopping_lists(house_id);
create index if not exists shopping_items_house_id_idx on public.shopping_items(house_id);
create index if not exists shopping_items_list_id_idx on public.shopping_items(list_id);

alter table public.categories enable row level security;
alter table public.notes enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "categories_rw_members" on public.categories;
create policy "categories_rw_members" on public.categories
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

drop policy if exists "notes_rw_members" on public.notes;
create policy "notes_rw_members" on public.notes
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

drop policy if exists "shopping_lists_rw_members" on public.shopping_lists;
create policy "shopping_lists_rw_members" on public.shopping_lists
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

drop policy if exists "shopping_items_rw_members" on public.shopping_items;
create policy "shopping_items_rw_members" on public.shopping_items
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;

-- EOF
