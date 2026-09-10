-- Migration: categorías de Economía editables por hogar
-- Date: 2026-09-11
--
-- Hasta ahora las categorías de gastos e ingresos eran un catálogo fijo en el
-- cliente (EXPENSE_CATEGORIES / INCOME_CATEGORIES en
-- src/modules/economy/economyCategories.js). Esta tabla las hace editables y
-- persistentes por hogar, igual que `categories` (objetos) — ver
-- 20260808_037_capture_untracked_tables.sql, del que se copia el patrón:
-- lectura/escritura para cualquier miembro de la casa, sin RPC, borrado en
-- cascada con la casa.
--
-- `kind` separa las dos listas. El cliente reemplaza el conjunto completo de
-- un `kind` en cada cambio (economyCategoriesService.replace), no hace CRUD
-- por fila; `position` conserva el orden.

create table if not exists public.economy_categories (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists economy_categories_house_id_idx on public.economy_categories(house_id);

alter table public.economy_categories enable row level security;

drop policy if exists "economy_categories_rw_members" on public.economy_categories;
create policy "economy_categories_rw_members" on public.economy_categories
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

grant select, insert, update, delete on public.economy_categories to authenticated;

-- EOF
