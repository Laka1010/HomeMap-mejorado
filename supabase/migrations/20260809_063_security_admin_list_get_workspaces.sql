-- Migration: security_admin_list_workspaces() + security_admin_get_workspace_detail()
-- Fase 5 de Admin Console (Workspaces)
-- Date: 2026-08-09
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Igual que con Houses: ninguna de las ~20 RPCs de Economy relacionadas con
-- financial_spaces/financial_space_members comprueba is_security_admin() --
-- todas gatean en is_workspace_owner()/can_manage_financial_space(), es
-- decir, en el propio rol del llamante en ESE workspace. No existe ninguna
-- vía administrativa hoy. Esta fase es DELIBERADAMENTE de solo lectura --
-- no se crea ninguna vía de escritura, no se toca ninguna RPC ni tabla del
-- dominio Economy, no se modifica RLS.
--
-- my_financial_spaces (vista existente) está filtrada por auth.uid() -- un
-- admin solo vería sus propios Workspaces con ella.
--
-- ============================================================================
-- "MIEMBROS" NO ES UNA ÚNICA TABLA -- se resuelve por tipo, replicando (para
-- LECTURA, no para autorización -- get_workspace_role() no se toca) la
-- misma lógica que ya usa esa función:
--
--   type = 'personal'  -> un único miembro: el owner (financial_spaces.
--                         owner_id). economy_access_requests (quién más
--                         puede ver esa economía personal) queda fuera de
--                         alcance -- decisión de producto confirmada, es
--                         dato de Finance, no de Workspaces.
--   type = 'shared'     -> financial_space_members tal cual (única tabla
--                         que existe para este tipo -- forzado por el
--                         trigger financial_space_members_only_shared_trg).
--   type = 'household'  -> derivado de home_members (rol de casa +
--                         economy_role override), exactamente la misma
--                         rama de get_workspace_role, pero para mostrar,
--                         no para decidir acceso. Se incluyen TODOS los
--                         miembros de la casa, incluso los que no tienen
--                         acceso a Economía (resolved_role = null), para
--                         que el admin vea el cuadro completo, no una
--                         vista parcial.
--
-- "OWNER" tampoco es uniforme entre tipos -- comprobado leyendo
-- transfer_house_ownership (20260801_020): esa función SOLO actualiza
-- home_members.role, nunca financial_spaces.owner_id. Para household,
-- financial_spaces.owner_id se fija una vez al crear la casa y puede
-- quedar desactualizado tras una transferencia de propiedad -- no es un
-- dato "propietario" vivo para ese tipo, a diferencia de personal/shared,
-- donde owner_id sí es la fuente de verdad real (así lo usa
-- get_workspace_role). Por eso: owner_id/owner_display_name/owner_email
-- solo se devuelven para personal y shared; para household quedan NULL
-- (no se fabrica un propietario que el modelo real no tiene) -- created_by
-- (que nunca se reescribe) sí se devuelve siempre, para los 3 tipos.
--
-- ============================================================================
-- 1. Listado + búsqueda + paginación
-- ============================================================================

create or replace function public.security_admin_list_workspaces(
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  workspace_id uuid,
  type text,
  name text,
  icon text,
  house_id uuid,
  created_at timestamptz,
  archived_at timestamptz,
  created_by uuid,
  created_by_display_name text,
  created_by_email text,
  owner_id uuid,
  owner_display_name text,
  owner_email text,
  member_count bigint,
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
    fs.id, fs.type, fs.name, fs.icon, fs.house_id, fs.created_at, fs.archived_at,
    fs.created_by, cp.display_name, cp.email,
    case when fs.type in ('personal', 'shared') then fs.owner_id else null end,
    case when fs.type in ('personal', 'shared') then op.display_name else null end,
    case when fs.type in ('personal', 'shared') then op.email else null end,
    case
      when fs.type = 'shared' then (select count(*) from public.financial_space_members m where m.space_id = fs.id)
      when fs.type = 'household' then (select count(*) from public.home_members hm where hm.house_id = fs.house_id)
      else 1
    end as member_count,
    count(*) over() as total_count
  from public.financial_spaces fs
  join public.profiles cp on cp.id = fs.created_by
  left join public.profiles op on op.id = fs.owner_id
  where (
    p_query is null or length(trim(p_query)) = 0
    or fs.name ilike '%' || trim(p_query) || '%'
    or cp.display_name ilike '%' || trim(p_query) || '%'
    or cp.email ilike '%' || trim(p_query) || '%'
  )
  order by fs.name nulls last, fs.id
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.security_admin_list_workspaces(text, integer, integer) from public, anon;
grant execute on function public.security_admin_list_workspaces(text, integer, integer) to authenticated;

-- ============================================================================
-- 2. Detalle + miembros resueltos por tipo
-- ============================================================================

create or replace function public.security_admin_get_workspace_detail(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_house_id uuid;
  v_owner_id uuid;
  v_result jsonb;
  v_members jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select type, house_id, owner_id into v_type, v_house_id, v_owner_id
  from public.financial_spaces where id = p_workspace_id;

  if v_type is null then
    raise exception 'Workspace no encontrado';
  end if;

  if v_type = 'personal' then
    select jsonb_agg(jsonb_build_object(
      'user_id', p.id, 'display_name', p.display_name, 'email', p.email, 'role', 'owner'
    ))
    into v_members
    from public.profiles p where p.id = v_owner_id;
  elsif v_type = 'shared' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'display_name', mp.display_name, 'email', mp.email, 'role', m.role
    ) order by m.added_at), '[]'::jsonb)
    into v_members
    from public.financial_space_members m
    join public.profiles mp on mp.id = m.user_id
    where m.space_id = p_workspace_id;
  else
    -- household: misma resolución que get_workspace_role() para esta rama,
    -- replicada solo para lectura -- esa función no se toca.
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', hm.user_id, 'display_name', hp.display_name, 'email', hp.email,
      'house_role', hm.role,
      'resolved_role', case
        when hm.economy_role is not null then nullif(hm.economy_role, 'none')
        else case hm.role when 'admin' then 'manager' when 'adult' then 'contributor' else null end
      end
    ) order by hm.joined_at), '[]'::jsonb)
    into v_members
    from public.home_members hm
    join public.profiles hp on hp.id = hm.user_id
    where hm.house_id = v_house_id;
  end if;

  select jsonb_build_object(
    'workspace_id', fs.id,
    'type', fs.type,
    'name', fs.name,
    'icon', fs.icon,
    'house_id', fs.house_id,
    'created_at', fs.created_at,
    'archived_at', fs.archived_at,
    'created_by', fs.created_by,
    'created_by_display_name', cp.display_name,
    'created_by_email', cp.email,
    'owner_id', case when fs.type in ('personal', 'shared') then fs.owner_id else null end,
    'owner_display_name', case when fs.type in ('personal', 'shared') then op.display_name else null end,
    'owner_email', case when fs.type in ('personal', 'shared') then op.email else null end,
    'members', coalesce(v_members, '[]'::jsonb)
  ) into v_result
  from public.financial_spaces fs
  join public.profiles cp on cp.id = fs.created_by
  left join public.profiles op on op.id = fs.owner_id
  where fs.id = p_workspace_id;

  return v_result;
end;
$$;

revoke all on function public.security_admin_get_workspace_detail(uuid) from public, anon;
grant execute on function public.security_admin_get_workspace_detail(uuid) to authenticated;

-- EOF
