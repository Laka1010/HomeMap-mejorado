-- Migration: economy_bills, economy_expenses, economy_income
-- Date: 2026-07-26
--
-- Consolidates the two conflicting, never-applied versions of this schema
-- that used to live in this repo (see supabase/migrations/_archive/README.md).
-- house_id now references the houses table created in
-- 20260726_001_houses_members_roles.sql, and RLS requires the caller's role
-- in that house to be 'admin' or 'adult' — the 'child' role is denied at the
-- database level, not just hidden in the UI.

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.economy_bills (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  name text not null,
  provider text,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',

  due_date date not null,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null default 'pending' check (status in ('pending', 'paid')),
  frequency text not null default 'once' check (frequency in ('once', 'monthly', 'quarterly', 'yearly')),

  description text,
  notes text,
  reminder_enabled boolean not null default false,
  reminder_days integer not null default 3,

  attachment_url text,
  attachment_type text check (attachment_type in ('pdf', 'image', null)),

  constraint economy_bills_valid_paid_date check (paid_date is null or status = 'paid')
);

create table if not exists public.economy_expenses (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  performed_by uuid references auth.users(id) on delete set null,

  name text not null,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  description text,
  notes text,
  receipt_image_url text
);

create table if not exists public.economy_income (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  name text not null,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  description text,
  notes text
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists economy_bills_house_id_idx on public.economy_bills(house_id);
create index if not exists economy_bills_house_status_idx on public.economy_bills(house_id, status);
create index if not exists economy_bills_house_due_date_idx on public.economy_bills(house_id, due_date);

create index if not exists economy_expenses_house_id_idx on public.economy_expenses(house_id);
create index if not exists economy_expenses_house_date_idx on public.economy_expenses(house_id, date);
create index if not exists economy_expenses_house_category_idx on public.economy_expenses(house_id, category);

create index if not exists economy_income_house_id_idx on public.economy_income(house_id);
create index if not exists economy_income_house_date_idx on public.economy_income(house_id, date);

-- ============================================================================
-- updated_at TRIGGERS
-- ============================================================================

create or replace function public.economy_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists economy_bills_set_updated_at on public.economy_bills;
create trigger economy_bills_set_updated_at
  before update on public.economy_bills
  for each row execute function public.economy_set_updated_at();

drop trigger if exists economy_expenses_set_updated_at on public.economy_expenses;
create trigger economy_expenses_set_updated_at
  before update on public.economy_expenses
  for each row execute function public.economy_set_updated_at();

drop trigger if exists economy_income_set_updated_at on public.economy_income;
create trigger economy_income_set_updated_at
  before update on public.economy_income
  for each row execute function public.economy_set_updated_at();

-- ============================================================================
-- RLS — requires can_manage_economy(house_id), defined in
-- 20260726_001_houses_members_roles.sql (role admin/adult only)
-- ============================================================================

alter table public.economy_bills enable row level security;
alter table public.economy_expenses enable row level security;
alter table public.economy_income enable row level security;

create policy "economy_bills_rw" on public.economy_bills
  for all
  to authenticated
  using (public.can_manage_economy(house_id))
  with check (public.can_manage_economy(house_id));

create policy "economy_expenses_rw" on public.economy_expenses
  for all
  to authenticated
  using (public.can_manage_economy(house_id))
  with check (public.can_manage_economy(house_id));

create policy "economy_income_rw" on public.economy_income
  for all
  to authenticated
  using (public.can_manage_economy(house_id))
  with check (public.can_manage_economy(house_id));

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select, insert, update, delete on public.economy_bills to authenticated;
grant select, insert, update, delete on public.economy_expenses to authenticated;
grant select, insert, update, delete on public.economy_income to authenticated;

-- EOF
