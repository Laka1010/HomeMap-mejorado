-- Migration: delete_house — borrado completo de una casa y todos sus datos
-- Date: 2026-08-03
--
-- Todas las tablas con house_id ya tienen `on delete cascade` (rooms,
-- containers, objects, zones, categories, tasks, shopping_lists/items/
-- purchases, notes, notifications, house_activity, entity_photos,
-- home_members, economy_bills/expenses/income/goals, financial_spaces —
-- y desde financial_spaces, en cascada, financial_accounts,
-- economy_expenses/income/financial_transfers de Personal/Shared también
-- atados a esa casa). Verificado contra information_schema antes de
-- escribir esto: un simple `delete from houses` ya limpia todo el árbol,
-- no hace falta borrar tabla por tabla aquí.

create or replace function public.delete_house(p_house_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede eliminarla';
  end if;

  delete from public.houses where id = p_house_id;
  if not found then
    raise exception 'Casa no encontrada';
  end if;
end;
$$;

grant execute on function public.delete_house(uuid) to authenticated;

-- EOF
