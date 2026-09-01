-- Migration: borrar una cuenta no debe destruir datos de otras personas
-- (hallazgo A-4 de la auditoría)
-- Date: 2026-08-31
--
-- PROBLEMA
-- houses.created_by referencia auth.users(id) ON DELETE CASCADE. La Edge
-- Function delete-account protege el caso comprobando home_members.role =
-- 'admin', pero transfer_house_ownership degrada al creador a 'adult' sin
-- tocar created_by. Secuencia: A crea la casa -> A transfiere a B -> A borra
-- su cuenta -> la guarda no salta -> el CASCADE elimina la casa entera y, en
-- cadena, sus espacios financieros, cuentas, gastos, tareas y compras. B y el
-- resto de miembros pierden todo sin haber hecho nada.
--
-- Y no es solo houses. El mapa completo de claves foráneas hacia auth.users
-- mostró que TODAS las columnas de autoría son NOT NULL + CASCADE:
--   houses.created_by, financial_spaces.created_by, financial_spaces.owner_id
--   (que en un espacio 'household' es simplemente el creador de la casa),
--   financial_accounts.created_by (la "Cuenta Común"), economy_bills/expenses/
--   income/goals.created_by, financial_transfers.created_by,
--   financial_space_members.added_by.
-- Es decir: aunque la casa sobreviviera, borrar al creador se llevaba por
-- delante el espacio financiero del hogar y su cuenta común.
--
-- Además shopping_purchases.created_by era NO ACTION (sin ON DELETE), así que
-- BLOQUEABA el borrado de cualquier cuenta que hubiera registrado una compra:
-- delete-account habría devuelto 500 por violación de clave foránea.
--
-- SOLUCIÓN: dos mecanismos que se cubren mutuamente
--
--   1. Las columnas de AUTORÍA pasan a nullable + ON DELETE SET NULL. Es el
--      patrón que el proyecto ya usa para lo mismo en otras tablas
--      (economy_*.performed_by, house_activity.user_id, security_events.user_id,
--      security_ip_blocks.created_by). Red de seguridad declarativa: pase lo
--      que pase, borrar un usuario no puede destruir una fila compartida.
--
--   2. Un trigger BEFORE DELETE sobre auth.users que, antes de que se dispare
--      ninguna acción referencial, reasigna la autoría a un miembro que
--      sobreviva. Así created_by sigue sin ser NULL en la práctica y los
--      INNER JOIN contra profiles de security_admin_list_houses,
--      _get_house_detail, _list_workspaces y _get_workspace_detail siguen
--      funcionando sin tocarlos.
--
-- El trigger además:
--   * BORRA explícitamente el espacio financiero PERSONAL del usuario. Con
--     owner_id ya en SET NULL, sin esto quedaría huérfano e inaccesible en la
--     base de datos: datos personales que deben irse con la cuenta.
--   * BORRA las casas donde el usuario era el ÚNICO miembro, que es lo que
--     hacía el CASCADE hasta ahora y sigue siendo lo correcto.
--
-- FALLA EN ABIERTO EN LA REASIGNACIÓN, EN CERRADO EN LO PERSONAL
-- Si la reasignación falla, se deja continuar: los FK en SET NULL preservan
-- igualmente los datos, y bloquear para siempre el borrado de una cuenta sería
-- peor. El borrado del espacio personal sí propaga el error: ahí preferimos
-- que el borrado falle y se reintente antes que retener datos personales.
--
-- LO QUE NO CAMBIA
--   * delete-account: su guarda ("eres admin de una casa con más miembros")
--     sigue siendo una regla de producto razonable y no era el fallo. El fallo
--     era que fuera la ÚNICA protección, y encima solo en la ruta de la app:
--     un borrado desde el panel de Supabase la saltaba por completo. Ahora la
--     protección vive en el modelo de datos y cubre todas las rutas.
--   * create_house, transfer_house_ownership y las RPCs administrativas.
--
-- REVERSIBLE: volver a poner los FK en CASCADE con NOT NULL y borrar el
-- trigger y la función. No se destruyen datos en ningún sentido.

-- ============================================================================
-- 1. AUTORÍA: nullable + SET NULL
-- ============================================================================

alter table public.houses                  alter column created_by drop not null;
alter table public.financial_spaces        alter column created_by drop not null;
alter table public.financial_spaces        alter column owner_id   drop not null;
alter table public.financial_accounts      alter column created_by drop not null;
alter table public.economy_bills           alter column created_by drop not null;
alter table public.economy_expenses        alter column created_by drop not null;
alter table public.economy_income          alter column created_by drop not null;
alter table public.economy_goals           alter column created_by drop not null;
alter table public.financial_transfers     alter column created_by drop not null;
alter table public.financial_space_members alter column added_by   drop not null;

alter table public.houses
  drop constraint houses_created_by_fkey,
  add  constraint houses_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.financial_spaces
  drop constraint financial_spaces_created_by_fkey,
  add  constraint financial_spaces_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.financial_spaces
  drop constraint financial_spaces_owner_id_fkey,
  add  constraint financial_spaces_owner_id_fkey
       foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.financial_accounts
  drop constraint financial_accounts_created_by_fkey,
  add  constraint financial_accounts_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.economy_bills
  drop constraint economy_bills_created_by_fkey,
  add  constraint economy_bills_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.economy_expenses
  drop constraint economy_expenses_created_by_fkey,
  add  constraint economy_expenses_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.economy_income
  drop constraint economy_income_created_by_fkey,
  add  constraint economy_income_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.economy_goals
  drop constraint economy_goals_created_by_fkey,
  add  constraint economy_goals_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.financial_transfers
  drop constraint financial_transfers_created_by_fkey,
  add  constraint financial_transfers_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

alter table public.financial_space_members
  drop constraint financial_space_members_added_by_fkey,
  add  constraint financial_space_members_added_by_fkey
       foreign key (added_by) references auth.users(id) on delete set null;

-- NO ACTION -> SET NULL. Esta no destruía nada: BLOQUEABA el borrado.
alter table public.shopping_purchases
  drop constraint shopping_purchases_created_by_fkey,
  add  constraint shopping_purchases_created_by_fkey
       foreign key (created_by) references auth.users(id) on delete set null;

-- ============================================================================
-- 2. TRIGGER DE BORRADO DE USUARIO
-- ============================================================================

create or replace function public.handle_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_successor uuid;
begin
  -- 2.1 Datos PERSONALES: se van con la cuenta. Con owner_id en SET NULL ya no
  --     cascadean solos. Si esto falla, el error propaga y el borrado se
  --     aborta: preferimos reintentar antes que retener datos personales.
  delete from public.financial_spaces
  where owner_id = old.id and type = 'personal';

  -- 2.2 Casas donde era el ÚNICO miembro: se borran, igual que hacía el
  --     CASCADE. Una casa sin miembros no le sirve a nadie.
  delete from public.houses h
  where h.created_by = old.id
    and not exists (
      select 1 from public.home_members m
      where m.house_id = h.id and m.user_id <> old.id
    );

  -- 2.3 Reasignación de autoría en lo que sobrevive. Fail-open: si algo falla,
  --     los FK en SET NULL preservan igualmente los datos.
  begin
    for r in
      select h.id as house_id
      from public.houses h
      where h.created_by = old.id
    loop
      select m.user_id into v_successor
      from public.home_members m
      where m.house_id = r.house_id and m.user_id <> old.id
      order by (m.role = 'admin') desc, m.user_id
      limit 1;

      if v_successor is null then
        continue;
      end if;

      update public.houses
        set created_by = v_successor
      where id = r.house_id;

      update public.financial_spaces
        set created_by = case when created_by = old.id then v_successor else created_by end,
            owner_id   = case when owner_id   = old.id then v_successor else owner_id   end
      where house_id = r.house_id;

      update public.financial_accounts a
        set created_by = v_successor
      where a.created_by = old.id
        and a.financial_space_id in (
          select s.id from public.financial_spaces s where s.house_id = r.house_id
        );
    end loop;

    -- Espacios compartidos (type='shared') que creó y que aún tienen a alguien
    -- más dentro: la autoría pasa a un miembro que quede.
    for r in
      select s.id as space_id
      from public.financial_spaces s
      where s.type = 'shared' and (s.created_by = old.id or s.owner_id = old.id)
    loop
      select fm.user_id into v_successor
      from public.financial_space_members fm
      where fm.space_id = r.space_id and fm.user_id <> old.id
      order by (fm.role = 'manager') desc, fm.user_id
      limit 1;

      if v_successor is null then
        continue;
      end if;

      update public.financial_spaces
        set created_by = case when created_by = old.id then v_successor else created_by end,
            owner_id   = case when owner_id   = old.id then v_successor else owner_id   end
      where id = r.space_id;

      update public.financial_accounts
        set created_by = v_successor
      where created_by = old.id and financial_space_id = r.space_id;
    end loop;
  exception when others then
    null;
  end;

  return old;
end;
$$;

revoke all on function public.handle_user_deletion() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.handle_user_deletion();

-- EOF
