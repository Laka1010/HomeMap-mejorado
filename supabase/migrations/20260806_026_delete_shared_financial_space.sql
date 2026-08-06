-- Migration: delete_shared_financial_space — borrado real (no archivo) de un
-- espacio compartido y todos sus datos.
-- Date: 2026-08-06
--
-- Personal y Household siguen siendo permanentes (mismo criterio que ya
-- aplica archive_financial_space): esta función solo opera sobre
-- type = 'shared'. La cascada ya existe en el esquema — financial_accounts,
-- economy_bills/expenses/income/goals y financial_space_members referencian
-- financial_spaces(id) on delete cascade (20260803_022/023), y
-- financial_transfers referencia financial_accounts(id) on delete cascade —
-- así que borrar la fila de financial_spaces limpia todo el árbol sin
-- necesidad de borrar tabla por tabla.

create or replace function public.delete_shared_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_type <> 'shared' then
    raise exception 'Solo los espacios compartidos se pueden eliminar (Personal y Hogar son permanentes)';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo el creador del espacio puede eliminarlo';
  end if;

  delete from public.financial_spaces where id = p_space_id;
end;
$$;

-- Por defecto Postgres concede EXECUTE a PUBLIC (incluye anon) al crear la
-- función; se revoca explícitamente para que solo usuarios autenticados
-- puedan siquiera intentar llamarla (el chequeo de permiso interno ya la
-- protege igualmente, pero anon no debería poder invocarla vía REST).
revoke execute on function public.delete_shared_financial_space(uuid) from public, anon;
grant execute on function public.delete_shared_financial_space(uuid) to authenticated;

-- EOF
