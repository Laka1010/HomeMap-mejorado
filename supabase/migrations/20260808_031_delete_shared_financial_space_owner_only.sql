-- Migration: delete_shared_financial_space must require Owner, not Manager
-- Date: 2026-08-08
--
-- Security audit finding: rename_financial_space / archive_financial_space
-- both require is_workspace_owner (20260803_024_workspace_roles.sql), but
-- delete_shared_financial_space -- a strictly more destructive, irreversible
-- action that cascades to every account/movement/transfer/member in the
-- space -- only required can_manage_financial_space (manager-or-owner). The
-- function's own error message already said "solo el creador" (owner-only),
-- so this brings the check in line with both the documented intent and the
-- rest of the permission model.

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
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario del espacio puede eliminarlo';
  end if;

  delete from public.financial_spaces where id = p_space_id;
end;
$$;

-- EOF
