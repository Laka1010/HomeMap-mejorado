-- Migration: financial_accounts + transfers/contributions + bill payment RPCs
-- Date: 2026-08-03
--
-- Completa el sistema de Financial Spaces (20260803_022): cada Space puede
-- tener varias cuentas (Banco/Tarjeta/Efectivo/Ahorros...), los ingresos y
-- gastos pertenecen siempre a una cuenta y actualizan su saldo, y existen
-- transferencias (entre cuentas del mismo Space) y contribuciones (entre
-- Spaces, ej. Lucas -> Household) como una única operación de saldo con
-- distinta validación según el destino.
--
-- FIX de compatibilidad encontrado durante esta implementación: App.jsx
-- (el "añadir rápido" global: addBill/addExpense/addIncome) inserta en
-- economy_bills/expenses/income pasando solo house_id, nunca
-- financial_space_id — desde 20260803_022 (que hizo financial_space_id
-- NOT NULL) esos tres inserts estaban rotos. Se corrige aquí ampliando
-- economy_sync_house_id() para que también resuelva financial_space_id a
-- partir de house_id cuando falte, sin tocar App.jsx.

-- ============================================================================
-- FIX: economy_sync_house_id ahora también resuelve financial_space_id
-- ============================================================================

create or replace function public.economy_sync_house_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.financial_space_id is null and new.house_id is not null then
    select id into new.financial_space_id
    from public.financial_spaces
    where type = 'household' and house_id = new.house_id;
  end if;

  select house_id into new.house_id
  from public.financial_spaces
  where id = new.financial_space_id;

  return new;
end;
$$;

-- Renombra los triggers existentes con prefijo numérico para garantizar el
-- orden de ejecución frente al nuevo trigger de cuenta por defecto (ver
-- más abajo): la resolución de espacio/casa debe correr antes.
drop trigger if exists economy_bills_sync_house_id on public.economy_bills;
create trigger economy_bills_10_resolve_space
  before insert or update of financial_space_id on public.economy_bills
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_expenses_sync_house_id on public.economy_expenses;
create trigger economy_expenses_10_resolve_space
  before insert or update of financial_space_id on public.economy_expenses
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_income_sync_house_id on public.economy_income;
create trigger economy_income_10_resolve_space
  before insert or update of financial_space_id on public.economy_income
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_goals_sync_house_id on public.economy_goals;
create trigger economy_goals_10_resolve_space
  before insert or update of financial_space_id on public.economy_goals
  for each row execute function public.economy_sync_house_id();

-- ============================================================================
-- TABLE: financial_accounts
-- ============================================================================

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,

  name text not null,
  icon text,
  color text,
  type text not null check (type in ('bank', 'card', 'cash', 'savings', 'other')),
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),

  balance numeric(12, 2) not null default 0,
  initial_balance numeric(12, 2) not null default 0,
  is_default boolean not null default false,
  status text not null check (status in ('active', 'archived')) default 'active',

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una cuenta por defecto por Space (donde caen los movimientos sin cuenta
-- explícita y las contribuciones que recibe ese Space).
create unique index if not exists financial_accounts_one_default_per_space
  on public.financial_accounts (financial_space_id) where is_default = true;

create index if not exists financial_accounts_space_id_idx on public.financial_accounts(financial_space_id);

drop trigger if exists financial_accounts_set_updated_at on public.financial_accounts;
create trigger financial_accounts_set_updated_at
  before update on public.financial_accounts
  for each row execute function public.economy_set_updated_at();

alter table public.financial_accounts enable row level security;

-- Misma regla que economy_bills/expenses/income: cualquiera con acceso al
-- Space puede gestionar sus cuentas (igual que hoy cualquier adult puede
-- editar/borrar cualquier gasto del hogar) — una regla más estricta solo
-- para cuentas sería inconsistente con el resto del módulo.
create policy "financial_accounts_rw" on public.financial_accounts
  for all
  to authenticated
  using (public.can_access_financial_space(financial_space_id))
  with check (public.can_access_financial_space(financial_space_id));

grant select, insert, update, delete on public.financial_accounts to authenticated;

-- ============================================================================
-- AUTO-PROVISIONING: una cuenta por defecto por Space
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'surname')), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('personal', 'private', 'Personal', '👤', new.id, null, new.id)
  on conflict (owner_id) where type = 'personal' do nothing
  returning id into v_space_id;

  if v_space_id is not null then
    insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
    values (v_space_id, 'Efectivo', '💵', '#22C55E', 'cash', 'EUR', true, new.id);
  end if;

  return new;
end;
$$;

create or replace function public.create_house(p_name text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
  v_code text;
  v_space_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  loop
    v_code := 'HM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.houses where invite_code = v_code);
  end loop;

  insert into public.houses (name, invite_code, created_by)
  values (trim(p_name), v_code, auth.uid())
  returning * into v_house;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin');

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('household', 'house', 'Hogar', '🏠', auth.uid(), v_house.id, auth.uid())
  returning id into v_space_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space_id, 'Cuenta Común', '🏦', '#6366F1', 'bank', v_house.currency_code, true, auth.uid());

  return v_house;
end;
$$;

create or replace function public.create_shared_financial_space(p_name text, p_house_id uuid, p_icon text default '❤️')
returns public.financial_spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
  v_currency text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del espacio no puede estar vacío';
  end if;

  if not public.is_house_member(p_house_id) then
    raise exception 'Solo un miembro de la casa puede crear un espacio compartido en ella';
  end if;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('shared', 'invite_only', trim(p_name), p_icon, auth.uid(), p_house_id, auth.uid())
  returning * into v_space;

  insert into public.financial_space_members (space_id, user_id, added_by)
  values (v_space.id, auth.uid(), auth.uid());

  select currency_code into v_currency from public.houses where id = p_house_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space.id, 'Cuenta compartida', '💳', '#EC4899', 'card', coalesce(v_currency, 'EUR'), true, auth.uid());

  return v_space;
end;
$$;

-- Backfill: Spaces creados por el migration anterior, todavía sin cuenta.
insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
select s.id, 'Efectivo', '💵', '#22C55E', 'cash', 'EUR', true, s.owner_id
from public.financial_spaces s
where s.type = 'personal'
  and not exists (select 1 from public.financial_accounts a where a.financial_space_id = s.id);

insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
select s.id, 'Cuenta Común', '🏦', '#6366F1', 'bank', coalesce(h.currency_code, 'EUR'), true, s.owner_id
from public.financial_spaces s
left join public.houses h on h.id = s.house_id
where s.type = 'household'
  and not exists (select 1 from public.financial_accounts a where a.financial_space_id = s.id);

insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
select s.id, 'Cuenta compartida', '💳', '#EC4899', 'card', coalesce(h.currency_code, 'EUR'), true, s.owner_id
from public.financial_spaces s
left join public.houses h on h.id = s.house_id
where s.type = 'shared'
  and not exists (select 1 from public.financial_accounts a where a.financial_space_id = s.id);

-- ============================================================================
-- account_id en economy_expenses / economy_income (economy_bills no tiene
-- saldo propio, solo paid_from_account_id más abajo; economy_goals no
-- mueve dinero) — nullable -> backfill a la cuenta por defecto -> not null.
-- ============================================================================

alter table public.economy_expenses add column if not exists account_id uuid references public.financial_accounts(id) on delete cascade;
alter table public.economy_income add column if not exists account_id uuid references public.financial_accounts(id) on delete cascade;

update public.economy_expenses e set account_id = a.id
from public.financial_accounts a
where a.financial_space_id = e.financial_space_id and a.is_default = true and e.account_id is null;

update public.economy_income i set account_id = a.id
from public.financial_accounts a
where a.financial_space_id = i.financial_space_id and a.is_default = true and i.account_id is null;

alter table public.economy_expenses alter column account_id set not null;
alter table public.economy_income alter column account_id set not null;

create index if not exists economy_expenses_account_id_idx on public.economy_expenses(account_id);
create index if not exists economy_income_account_id_idx on public.economy_income(account_id);

-- Autocompleta account_id con la cuenta por defecto del Space cuando no se
-- especifica (mismo patrón que financial_space_id con house_id) — así
-- economyService.createExpense/createIncome no necesitan cambiar de firma.
create or replace function public.economy_default_account_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is null then
    select id into new.account_id
    from public.financial_accounts
    where financial_space_id = new.financial_space_id and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists economy_expenses_20_default_account on public.economy_expenses;
create trigger economy_expenses_20_default_account
  before insert on public.economy_expenses
  for each row execute function public.economy_default_account_id();

drop trigger if exists economy_income_20_default_account on public.economy_income;
create trigger economy_income_20_default_account
  before insert on public.economy_income
  for each row execute function public.economy_default_account_id();

-- ============================================================================
-- SALDO: cada ingreso/gasto ajusta el saldo de su cuenta automáticamente
-- ============================================================================

create or replace function public.economy_adjust_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign numeric := case TG_ARGV[0] when 'income' then 1 else -1 end;
begin
  if TG_OP = 'INSERT' then
    update public.financial_accounts set balance = balance + v_sign * new.amount where id = new.account_id;
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.account_id is distinct from new.account_id then
      update public.financial_accounts set balance = balance - v_sign * old.amount where id = old.account_id;
      update public.financial_accounts set balance = balance + v_sign * new.amount where id = new.account_id;
    elsif old.amount is distinct from new.amount then
      update public.financial_accounts set balance = balance + v_sign * (new.amount - old.amount) where id = new.account_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.financial_accounts set balance = balance - v_sign * old.amount where id = old.account_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists economy_expenses_adjust_balance on public.economy_expenses;
create trigger economy_expenses_adjust_balance
  after insert or update or delete on public.economy_expenses
  for each row execute function public.economy_adjust_account_balance('expense');

drop trigger if exists economy_income_adjust_balance on public.economy_income;
create trigger economy_income_adjust_balance
  after insert or update or delete on public.economy_income
  for each row execute function public.economy_adjust_account_balance('income');

-- ============================================================================
-- TABLE: financial_transfers — ledger inmutable de transferencias/contribuciones
-- ============================================================================

create table if not exists public.financial_transfers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  to_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('transfer', 'contribution')),
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint financial_transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create index if not exists financial_transfers_from_account_idx on public.financial_transfers(from_account_id);
create index if not exists financial_transfers_to_account_idx on public.financial_transfers(to_account_id);

alter table public.financial_transfers enable row level security;

-- Sin policies de insert/update/delete: solo se escribe vía las funciones
-- SECURITY DEFINER de abajo, igual que houses/home_members/financial_spaces.
create policy "financial_transfers_select" on public.financial_transfers
  for select
  to authenticated
  using (
    public.can_access_financial_space((select financial_space_id from public.financial_accounts where id = from_account_id))
    or public.can_access_financial_space((select financial_space_id from public.financial_accounts where id = to_account_id))
  );

grant select on public.financial_transfers to authenticated;

-- Núcleo interno (sin grant a authenticated — solo se llama desde las
-- funciones públicas de abajo, que ya validan permisos antes de invocarlo).
create or replace function public._execute_financial_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text,
  p_kind text
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.financial_accounts;
  v_to public.financial_accounts;
  v_transfer public.financial_transfers;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'La cuenta de origen y destino no pueden ser la misma';
  end if;

  select * into v_from from public.financial_accounts where id = p_from_account_id;
  if not found then raise exception 'Cuenta de origen no encontrada'; end if;
  if v_from.status <> 'active' then raise exception 'La cuenta de origen no está activa'; end if;

  select * into v_to from public.financial_accounts where id = p_to_account_id;
  if not found then raise exception 'Cuenta de destino no encontrada'; end if;
  if v_to.status <> 'active' then raise exception 'La cuenta de destino no está activa'; end if;

  update public.financial_accounts set balance = balance - p_amount where id = p_from_account_id;
  update public.financial_accounts set balance = balance + p_amount where id = p_to_account_id;

  insert into public.financial_transfers (from_account_id, to_account_id, amount, kind, note, created_by)
  values (p_from_account_id, p_to_account_id, p_amount, p_kind, p_note, auth.uid())
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- Transferencia explícita cuenta -> cuenta (mismo Space o distinto, si el
-- llamante tiene acceso a ambas cuentas directamente).
create or replace function public.transfer_between_accounts(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_space uuid;
  v_to_space uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  select financial_space_id into v_to_space from public.financial_accounts where id = p_to_account_id;

  if v_from_space is null or v_to_space is null then
    raise exception 'Cuenta no encontrada';
  end if;
  if not public.can_access_financial_space(v_from_space) then
    raise exception 'No tienes acceso a la cuenta de origen';
  end if;
  if not public.can_access_financial_space(v_to_space) then
    raise exception 'No tienes acceso a la cuenta de destino';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, p_to_account_id, p_amount, p_note,
    case when v_from_space = v_to_space then 'transfer' else 'contribution' end
  );
end;
$$;

-- "Contribute to Household" / "Contribute to Shared Space": el llamante
-- elige un Space destino (no una cuenta concreta) y el dinero entra en la
-- cuenta por defecto de ese Space. Exige pertenecer también al destino.
create or replace function public.contribute_to_financial_space(
  p_from_account_id uuid,
  p_to_space_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_space uuid;
  v_to_account_id uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  if v_from_space is null then
    raise exception 'Cuenta de origen no encontrada';
  end if;
  if not public.can_access_financial_space(v_from_space) then
    raise exception 'No tienes acceso a la cuenta de origen';
  end if;
  if not public.can_access_financial_space(p_to_space_id) then
    raise exception 'No perteneces al espacio de destino';
  end if;

  select id into v_to_account_id
  from public.financial_accounts
  where financial_space_id = p_to_space_id and is_default = true;

  if v_to_account_id is null then
    raise exception 'El espacio de destino no tiene una cuenta por defecto';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, v_to_account_id, p_amount, p_note,
    case when v_from_space = p_to_space_id then 'transfer' else 'contribution' end
  );
end;
$$;

grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.contribute_to_financial_space(uuid, uuid, numeric, text) to authenticated;

-- ============================================================================
-- FACTURAS: pagar desde una cuenta del Household, o vía una contribución
-- inmediata desde cualquier cuenta accesible del llamante.
-- ============================================================================

alter table public.economy_bills add column if not exists paid_from_account_id uuid references public.financial_accounts(id) on delete set null;

create or replace function public.pay_bill_from_account(p_bill_id uuid, p_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.economy_bills;
  v_account public.financial_accounts;
begin
  select * into v_bill from public.economy_bills where id = p_bill_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  if not public.can_access_financial_space(v_bill.financial_space_id) then
    raise exception 'No tienes acceso a esta factura';
  end if;

  select * into v_account from public.financial_accounts where id = p_account_id;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  if v_account.financial_space_id <> v_bill.financial_space_id then
    raise exception 'La cuenta debe pertenecer al mismo espacio que la factura';
  end if;

  insert into public.economy_expenses (financial_space_id, account_id, created_by, performed_by, name, amount, category, date, description)
  values (v_bill.financial_space_id, p_account_id, auth.uid(), auth.uid(), v_bill.name, v_bill.amount, v_bill.category, current_date, 'Factura: ' || v_bill.name);

  update public.economy_bills
  set status = 'paid', paid_date = current_date, paid_from_account_id = p_account_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

create or replace function public.pay_bill_via_contribution(p_bill_id uuid, p_from_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.economy_bills;
  v_household_account_id uuid;
begin
  select * into v_bill from public.economy_bills where id = p_bill_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  select id into v_household_account_id
  from public.financial_accounts
  where financial_space_id = v_bill.financial_space_id and is_default = true;

  if v_household_account_id is null then
    raise exception 'El hogar no tiene una cuenta por defecto';
  end if;

  -- Aporta el importe a la cuenta del hogar (valida acceso a origen y
  -- destino) y a continuación registra el gasto de la factura desde esa
  -- misma cuenta: el saldo del hogar queda neto en 0, pero ambos eventos
  -- quedan registrados (quién puso el dinero + que la factura se pagó).
  perform public.contribute_to_financial_space(
    p_from_account_id, v_bill.financial_space_id, v_bill.amount, 'Pago de factura: ' || v_bill.name
  );

  insert into public.economy_expenses (financial_space_id, account_id, created_by, performed_by, name, amount, category, date, description)
  values (v_bill.financial_space_id, v_household_account_id, auth.uid(), auth.uid(), v_bill.name, v_bill.amount, v_bill.category, current_date, 'Factura: ' || v_bill.name);

  update public.economy_bills
  set status = 'paid', paid_date = current_date, paid_from_account_id = v_household_account_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

grant execute on function public.pay_bill_from_account(uuid, uuid) to authenticated;
grant execute on function public.pay_bill_via_contribution(uuid, uuid) to authenticated;

-- EOF
