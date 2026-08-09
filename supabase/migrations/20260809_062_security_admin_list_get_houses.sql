-- Migration: security_admin_list_houses() + security_admin_get_house_detail()
-- Fase 4 de Admin Console (Houses)
-- Date: 2026-08-09
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Ninguna de las 9 RPCs de gestión de casas (rename_house, delete_house,
-- transfer_house_ownership, set_member_role, remove_member,
-- set_house_currency, set_member_economy_access, create_house,
-- join_house_by_code) comprueba is_security_admin() -- todas gatean en
-- is_house_admin(p_house_id), es decir, en ser el administrador de esa
-- casa concreta. Un Security Admin no tiene hoy ningún camino para
-- gestionar la casa de otro. Esta fase es DELIBERADAMENTE de solo
-- lectura -- no se crea ninguna vía de escritura nueva, ni se toca
-- ninguna de esas 9 funciones.
--
-- my_houses (vista existente) está filtrada por auth.uid() -- un admin
-- solo vería sus propias casas con ella, igual que cualquier usuario. Por
-- eso hacen falta estas 2 RPCs SECURITY DEFINER nuevas, aditivas, mismo
-- patrón exacto que security_admin_list_users/get_user_detail.
--
-- Datos deliberadamente excluidos (decisión de producto confirmada):
--   - invite_code: secreto de invitación, no dato administrativo.
--   - contenido de house_activity: puede llevar nombres de objetos/tareas
--     escritos por el usuario -- solo se expone max(created_at) agregado
--     (last_activity_at), nunca title ni ninguna fila.
--   - contenido de rooms/objects/tasks/notes/shopping_lists: solo
--     count(*), nunca nombres/descripciones/fotos.
--   - cualquier tabla economy_*/financial_*.
--
-- Las 5 tablas de recuento (rooms, objects, tasks, notes, shopping_lists)
-- tienen todas columna house_id directa y unívoca (confirmado contra el
-- catálogo real antes de escribir esto) -- no hace falta ninguna relación
-- inventada.
--
-- ============================================================================
-- 1. Listado + búsqueda + paginación
-- ============================================================================

create or replace function public.security_admin_list_houses(
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  house_id uuid,
  name text,
  created_at timestamptz,
  created_by uuid,
  owner_display_name text,
  owner_email text,
  member_count bigint,
  currency_code text,
  photo text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 200);
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  return query
  select
    h.id, h.name, h.created_at, h.created_by,
    p.display_name, p.email,
    (select count(*) from public.home_members hm where hm.house_id = h.id) as member_count,
    h.currency_code, h.photo,
    count(*) over() as total_count
  from public.houses h
  join public.profiles p on p.id = h.created_by
  where (
    p_query is null or length(trim(p_query)) = 0
    or h.name ilike '%' || trim(p_query) || '%'
    or p.display_name ilike '%' || trim(p_query) || '%'
    or p.email ilike '%' || trim(p_query) || '%'
  )
  order by h.name nulls last, h.id
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.security_admin_list_houses(text, integer, integer) from public, anon;
grant execute on function public.security_admin_list_houses(text, integer, integer) to authenticated;

-- ============================================================================
-- 2. Detalle + miembros + recuentos agregados + última actividad
-- ============================================================================

create or replace function public.security_admin_get_house_detail(p_house_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'house_id', h.id,
    'name', h.name,
    'created_at', h.created_at,
    'created_by', h.created_by,
    'owner_display_name', p.display_name,
    'owner_email', p.email,
    'currency_code', h.currency_code,
    'photo', h.photo,
    'rooms_count', (select count(*) from public.rooms r where r.house_id = h.id),
    'objects_count', (select count(*) from public.objects o where o.house_id = h.id),
    'tasks_count', (select count(*) from public.tasks t where t.house_id = h.id),
    'notes_count', (select count(*) from public.notes n where n.house_id = h.id),
    'shopping_lists_count', (select count(*) from public.shopping_lists sl where sl.house_id = h.id),
    'last_activity_at', (select max(ha.created_at) from public.house_activity ha where ha.house_id = h.id),
    'members', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id', hm.user_id,
            'display_name', mp.display_name,
            'email', mp.email,
            'role', hm.role,
            'joined_at', hm.joined_at
          )
          order by hm.joined_at
        ),
        '[]'::jsonb
      )
      from public.home_members hm
      join public.profiles mp on mp.id = hm.user_id
      where hm.house_id = h.id
    )
  ) into v_result
  from public.houses h
  join public.profiles p on p.id = h.created_by
  where h.id = p_house_id;

  if v_result is null then
    raise exception 'Casa no encontrada';
  end if;

  return v_result;
end;
$$;

revoke all on function public.security_admin_get_house_detail(uuid) from public, anon;
grant execute on function public.security_admin_get_house_detail(uuid) to authenticated;

-- EOF
