-- Migration: shopping_purchases (historial de compras) + enlaces de integración
-- Date: 2026-07-28
--
-- Añade el historial de compras completadas (para "Historial" + "Repetir
-- compra" en la sección Organización -> Compras) y dos columnas de enlace:
--   - shopping_items.source_task_id: producto generado desde una tarea
--     (integración Tareas -> Compras, permite detectar "ya añadido").
--   - economy_expenses.shopping_purchase_id: gasto generado desde una compra
--     completada (integración Compras -> Finanzas, evita duplicar datos).
-- Reusa public.is_house_member(uuid) de 20260726_001_houses_members_roles.sql,
-- igual que el resto de tablas por-casa.

create table if not exists public.shopping_purchases (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  list_id uuid references public.shopping_lists(id) on delete set null,
  store text,
  amount numeric(12, 2),
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  completed_at timestamptz not null default now()
);

create index if not exists shopping_purchases_house_id_idx on public.shopping_purchases(house_id);
create index if not exists shopping_purchases_completed_at_idx on public.shopping_purchases(completed_at desc);

alter table public.shopping_purchases enable row level security;

create policy "shopping_purchases_rw_members" on public.shopping_purchases
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

grant select, insert, update, delete on public.shopping_purchases to authenticated;

-- ============================================================================
-- Enlace tarea -> producto de compra
-- ============================================================================

alter table public.shopping_items
  add column if not exists source_task_id text references public.tasks(id) on delete set null;

create index if not exists shopping_items_source_task_id_idx on public.shopping_items(source_task_id);

-- ============================================================================
-- Enlace gasto -> compra (opcional, para trazabilidad sin duplicar datos)
-- ============================================================================

alter table public.economy_expenses
  add column if not exists shopping_purchase_id uuid references public.shopping_purchases(id) on delete set null;

-- EOF
