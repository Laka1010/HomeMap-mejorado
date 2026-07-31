-- Migration: rooms, zones, containers, objects (shared home content)
-- Date: 2026-07-26
--
-- Moves the house's inventory (rooms/zones/containers/objects) from
-- per-browser localStorage to Supabase so every member of the house sees
-- the same content from their own account/device. Unlike the economy
-- tables, there is no role restriction here: admin/adult/child can all
-- read and write (matches the product requirement that children see the
-- house's rooms and their own tasks). Reuses public.is_house_member(uuid)
-- from 20260726_001_houses_members_roles.sql.
--
-- ids are client-generated text (e.g. "r-ab12cd"), matching the existing
-- uid() scheme in src/App.jsx, so every existing cross-reference
-- (roomId/zoneId/containerId/parentId) keeps working unchanged.

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.rooms (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  icon text,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.zones (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  name text not null,
  icon text,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.containers (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  zone_id text references public.zones(id) on delete set null,
  parent_id text references public.containers(id) on delete set null,
  name text not null,
  color text,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.objects (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  room_id text references public.rooms(id) on delete set null,
  zone_id text references public.zones(id) on delete set null,
  container_id text references public.containers(id) on delete set null,
  name text not null,
  category text,
  description text,
  notes text,
  photo text,
  price numeric(12, 2),
  purchase_date date,
  width numeric,
  height numeric,
  depth numeric,
  location_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists rooms_house_id_idx on public.rooms(house_id);

create index if not exists zones_house_id_idx on public.zones(house_id);
create index if not exists zones_room_id_idx on public.zones(room_id);

create index if not exists containers_house_id_idx on public.containers(house_id);
create index if not exists containers_room_id_idx on public.containers(room_id);
create index if not exists containers_zone_id_idx on public.containers(zone_id);
create index if not exists containers_parent_id_idx on public.containers(parent_id);

create index if not exists objects_house_id_idx on public.objects(house_id);
create index if not exists objects_room_id_idx on public.objects(room_id);
create index if not exists objects_zone_id_idx on public.objects(zone_id);
create index if not exists objects_container_id_idx on public.objects(container_id);

-- ============================================================================
-- updated_at TRIGGER (reuses the function created for economy tables)
-- ============================================================================

drop trigger if exists objects_set_updated_at on public.objects;
create trigger objects_set_updated_at
  before update on public.objects
  for each row execute function public.economy_set_updated_at();

-- ============================================================================
-- RLS — any house member (any role) can read/write
-- ============================================================================

alter table public.rooms enable row level security;
alter table public.zones enable row level security;
alter table public.containers enable row level security;
alter table public.objects enable row level security;

create policy "rooms_rw_members" on public.rooms
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

create policy "zones_rw_members" on public.zones
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

create policy "containers_rw_members" on public.containers
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

create policy "objects_rw_members" on public.objects
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.zones to authenticated;
grant select, insert, update, delete on public.containers to authenticated;
grant select, insert, update, delete on public.objects to authenticated;

-- EOF
