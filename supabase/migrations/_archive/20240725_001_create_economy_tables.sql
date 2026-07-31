-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLA: economy_bills (Facturas)
-- ============================================================================
create table if not exists economy_bills (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  
  -- Información básica
  name text not null,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',
  
  -- Fechas
  due_date date not null,
  paid_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Estado
  status text not null default 'pending' check (status in ('pending', 'paid')),
  
  -- Frecuencia (mensual, trimestral, etc. - para futuras automatizaciones)
  frequency text default 'once' check (frequency in ('once', 'monthly', 'quarterly', 'yearly')),
  
  -- Datos adicionales
  description text,
  notes text,
  reminder_enabled boolean default false,
  reminder_days integer default 3,
  
  -- Adjuntos
  attachment_url text,
  attachment_type text check (attachment_type in ('pdf', 'image', null)),
  
  constraint valid_paid_date check (paid_date is null or status = 'paid')
);

-- ============================================================================
-- TABLA: economy_expenses (Gastos)
-- ============================================================================
create table if not exists economy_expenses (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  
  -- Información básica
  name text not null,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',
  
  -- Fechas
  date date not null default current_date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Datos adicionales
  description text,
  notes text,
  
  -- Foto del ticket (preparado para IA futura)
  receipt_image_url text,
  
  -- Usuario que realizó el gasto (puede ser diferente del creador si un adulto registra el gasto de otro)
  performed_by uuid references auth.users(id) on delete set null
);

-- ============================================================================
-- TABLA: economy_income (Ingresos)
-- ============================================================================
create table if not exists economy_income (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  
  -- Información básica
  name text not null,
  amount numeric(12, 2) not null,
  category text not null default 'Otros',
  
  -- Fechas
  date date not null default current_date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Datos adicionales
  description text,
  notes text
);

-- ============================================================================
-- ÍNDICES PARA RENDIMIENTO
-- ============================================================================

-- Bills indexes
create index if not exists economy_bills_house_id_idx on economy_bills(house_id);
create index if not exists economy_bills_status_idx on economy_bills(status);
create index if not exists economy_bills_due_date_idx on economy_bills(due_date);
create index if not exists economy_bills_house_status_idx on economy_bills(house_id, status);
create index if not exists economy_bills_house_due_date_idx on economy_bills(house_id, due_date);

-- Expenses indexes
create index if not exists economy_expenses_house_id_idx on economy_expenses(house_id);
create index if not exists economy_expenses_category_idx on economy_expenses(category);
create index if not exists economy_expenses_date_idx on economy_expenses(date);
create index if not exists economy_expenses_house_date_idx on economy_expenses(house_id, date);

-- Income indexes
create index if not exists economy_income_house_id_idx on economy_income(house_id);
create index if not exists economy_income_category_idx on economy_income(category);
create index if not exists economy_income_date_idx on economy_income(date);
create index if not exists economy_income_house_date_idx on economy_income(house_id, date);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
alter table economy_bills enable row level security;
alter table economy_expenses enable row level security;
alter table economy_income enable row level security;

-- ============================================================================
-- BILLS RLS POLICIES
-- ============================================================================

-- Users can view bills from houses they are members of
create policy "Users can view bills from their houses"
  on economy_bills for select
  using (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_bills.house_id
      and hm.user_id = auth.uid()
    )
  );

-- Users can insert bills in houses where they are members (will be checked in application for role)
create policy "Users can insert bills in their houses"
  on economy_bills for insert
  with check (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_bills.house_id
      and hm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- EXPENSES RLS POLICIES
-- ============================================================================

-- Users can view expenses from houses they are members of
create policy "Users can view expenses from their houses"
  on economy_expenses for select
  using (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_expenses.house_id
      and hm.user_id = auth.uid()
    )
  );

-- Users can insert expenses in houses where they are members (will be checked in application for role)
create policy "Users can insert expenses in their houses"
  on economy_expenses for insert
  with check (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_expenses.house_id
      and hm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- INCOME RLS POLICIES
-- ============================================================================

-- Users can view income from houses they are members of
create policy "Users can view income from their houses"
  on economy_income for select
  using (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_income.house_id
      and hm.user_id = auth.uid()
    )
  );

-- Users can insert income in houses where they are members (will be checked in application for role)
create policy "Users can insert income in their houses"
  on economy_income for insert
  with check (
    exists (
      select 1 from public.home_members hm
      where hm.house_id = economy_income.house_id
      and hm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Bills trigger
create trigger update_economy_bills_updated_at
  before update on economy_bills
  for each row
  execute function update_updated_at_column();

-- Expenses trigger
create trigger update_economy_expenses_updated_at
  before update on economy_expenses
  for each row
  execute function update_updated_at_column();

-- Income trigger
create trigger update_economy_income_updated_at
  before update on economy_income
  for each row
  execute function update_updated_at_column();
