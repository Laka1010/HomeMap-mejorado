-- Migration: consumables (inventario inteligente de consumibles)
-- Date: 2026-09-12
--
-- Productos que se gastan/reponen (leche, detergente, comida de mascota...)
-- asociados a una zona o caja, a diferencia de public.objects que representa
-- elementos que permanecen en el hogar. Cada consumible tiene una cantidad
-- actual y, opcionalmente, una cantidad mínima: al llegar a ese mínimo, si
-- auto_add_to_shopping está activo, la app crea un producto en
-- public.shopping_items (lista sin asignar) y guarda su id en
-- linked_shopping_item_id para no duplicar el alta mientras siga pendiente.
-- Cuando ese producto se compra o se borra, la app limpia
-- linked_shopping_item_id (ver unlinkConsumablesForShoppingItems en
-- src/App.jsx) para que el consumible pueda volver a auto-añadirse si baja
-- de mínimo otra vez.
--
-- Mismo patrón que 20260726_003_home_content.sql: id de texto generado en
-- cliente, ubicación opcional room/zone/container, RLS via
-- public.is_house_member(uuid), trigger de updated_at reusando
-- public.economy_set_updated_at().

create table if not exists public.consumables (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  room_id text references public.rooms(id) on delete set null,
  zone_id text references public.zones(id) on delete set null,
  container_id text references public.containers(id) on delete set null,
  name text not null,
  current_quantity numeric not null default 1,
  min_quantity numeric,
  auto_add_to_shopping boolean not null default false,
  linked_shopping_item_id text references public.shopping_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists consumables_house_id_idx on public.consumables(house_id);
create index if not exists consumables_room_id_idx on public.consumables(room_id);
create index if not exists consumables_zone_id_idx on public.consumables(zone_id);
create index if not exists consumables_container_id_idx on public.consumables(container_id);
create index if not exists consumables_linked_shopping_item_id_idx on public.consumables(linked_shopping_item_id);

-- ============================================================================
-- updated_at TRIGGER (reuses the function created for economy tables)
-- ============================================================================

drop trigger if exists consumables_set_updated_at on public.consumables;
create trigger consumables_set_updated_at
  before update on public.consumables
  for each row execute function public.economy_set_updated_at();

-- ============================================================================
-- RLS — any house member (any role) can read/write, same as objects
-- ============================================================================

alter table public.consumables enable row level security;

create policy "consumables_rw_members" on public.consumables
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select, insert, update, delete on public.consumables to authenticated;

-- EOF
