-- Migration: economy_goals (spending limits and savings targets)
-- Date: 2026-07-31
--
-- Objetivos económicos simples, sin periodo que gestionar: "type" decide
-- cómo se calcula el progreso (siempre sobre el mes actual, igual que el
-- resto de Economía) y "name" hace doble función según el tipo — para
-- spending_limit es la categoría de gasto a vigilar (texto libre, igual que
-- economy_expenses.category, sin catálogo fijo porque tampoco lo hay ahí),
-- para savings_target es solo la etiqueta que se muestra. Mismo patrón de
-- RLS que el resto de tablas de economía: can_manage_economy (admin/adult,
-- 'child' denegado también a nivel de base de datos).

create table if not exists public.economy_goals (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  type text not null check (type in ('spending_limit', 'savings_target')),
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists economy_goals_house_id_idx on public.economy_goals(house_id);

drop trigger if exists economy_goals_set_updated_at on public.economy_goals;
create trigger economy_goals_set_updated_at
  before update on public.economy_goals
  for each row execute function public.economy_set_updated_at();

alter table public.economy_goals enable row level security;

create policy "economy_goals_rw" on public.economy_goals
  for all
  to authenticated
  using (public.can_manage_economy(house_id))
  with check (public.can_manage_economy(house_id));

grant select, insert, update, delete on public.economy_goals to authenticated;

-- EOF
