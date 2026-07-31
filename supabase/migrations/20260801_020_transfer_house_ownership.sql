-- Migration: transfer_house_ownership
-- Date: 2026-08-01
--
-- Hoy solo puede haber un 'admin' (propietario) por casa: create_house lo
-- fija al crearla y set_member_role rechaza explícitamente asignar 'admin'
-- a nadie más. No existía ninguna vía para que ese propietario le pasase el
-- puesto a otro miembro sin salir de la casa (remove_member ni siquiera deja
-- eliminar filas con role='admin'). Esta función cubre ese único hueco:
-- el admin actual pasa a 'adult' y el miembro elegido pasa a 'admin', en la
-- misma transacción. Mismo patrón de permisos que el resto de RPCs de
-- home_members (SECURITY DEFINER + comprobación de is_house_admin dentro).

create or replace function public.transfer_house_ownership(p_house_id uuid, p_new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el propietario puede transferir la propiedad';
  end if;

  if p_new_owner_user_id = auth.uid() then
    raise exception 'Ya eres el propietario de esta casa';
  end if;

  if not exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'El nuevo propietario debe ser miembro de esta casa';
  end if;

  update public.home_members
  set role = 'admin'
  where house_id = p_house_id and user_id = p_new_owner_user_id;

  update public.home_members
  set role = 'adult'
  where house_id = p_house_id and user_id = auth.uid();
end;
$$;

grant execute on function public.transfer_house_ownership(uuid, uuid) to authenticated;

-- EOF
