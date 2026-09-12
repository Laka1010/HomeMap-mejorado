-- Migration: consumables.shopping_list_id
-- Date: 2026-09-12
--
-- Permite elegir a qué lista de la compra va el producto que Haven genera al
-- auto-añadir un consumible (antes siempre iba a la lista sin asignar). Si es
-- null, se mantiene el comportamiento anterior (lista sin asignar).

alter table public.consumables
  add column if not exists shopping_list_id uuid references public.shopping_lists(id) on delete set null;

create index if not exists consumables_shopping_list_id_idx on public.consumables(shopping_list_id);

-- EOF
