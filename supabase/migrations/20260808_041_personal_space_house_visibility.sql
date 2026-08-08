-- Migration: let a user opt in to letting housemates view (read-only) their
-- Personal space, while its mere existence stays visible to housemates always.
-- Date: 2026-08-08
--
-- Product request: every housemate should see that a Personal Workspace
-- exists (name + icon, as a locked card -- no balance, no movements) for
-- every other adult/admin member of the house, without being able to open
-- it. If the owner wants to let others actually open it (read-only), they
-- opt in themselves from House Settings -- nobody else, not even the house
-- admin, can flip this on for them. This does NOT change who can WRITE to a
-- Personal space (only the owner ever can); it only extends read-only
-- visibility, and only when the owner explicitly allows it.
--
-- Two independent layers, both gated through the same housemate check:
--   1. Existence-only visibility (financial_spaces row, no sub-resources):
--      always on for type='personal', regardless of the new flag below.
--   2. Full read-only entry (accounts/movements/bills/goals, via the
--      existing can_access_financial_space -> get_workspace_role chain):
--      only when the owner has set shared_with_house = true.

alter table public.financial_spaces
  add column if not exists shared_with_house boolean not null default false;

alter table public.financial_spaces
  add constraint financial_spaces_shared_with_house_only_personal
  check (shared_with_house = false or type = 'personal');

-- True if the two users share at least one house. Mirrors the housemate
-- check already used to scope profiles visibility (20260808_029) --
-- deliberately NULL-safe (coalesce to false) per the audit finding that any
-- predicate feeding an "IF NOT ... THEN RAISE" guard must never return NULL.
create or replace function public.is_housemate_of(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.home_members hm1
      join public.home_members hm2 on hm2.house_id = hm1.house_id
      where hm1.user_id = p_user_id and hm2.user_id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.is_housemate_of(uuid) to authenticated;
revoke execute on function public.is_housemate_of(uuid) from public, anon;

-- get_workspace_role: personal spaces now also resolve to 'viewer' for a
-- housemate of the owner, but only when the owner opted in. Every other
-- branch (household, shared) is unchanged.
create or replace function public.get_workspace_role(p_space_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_house_id uuid;
  v_owner_id uuid;
  v_shared_with_house boolean;
  v_role_override text;
  v_house_role text;
begin
  select type, house_id, owner_id, shared_with_house into v_type, v_house_id, v_owner_id, v_shared_with_house
  from public.financial_spaces
  where id = p_space_id and archived_at is null;

  if v_type is null then
    return null;
  end if;

  if v_type = 'personal' then
    if v_owner_id = p_user_id then
      return 'owner';
    end if;
    if v_shared_with_house and public.is_housemate_of(v_owner_id) and p_user_id = auth.uid() then
      return 'viewer';
    end if;
    return null;
  end if;

  if v_type = 'household' then
    select economy_role, role into v_role_override, v_house_role
    from public.home_members
    where house_id = v_house_id and user_id = p_user_id;

    if v_role_override is not null then
      return nullif(v_role_override, 'none');
    end if;

    return case v_house_role
      when 'admin' then 'manager'
      when 'adult' then 'contributor'
      else null
    end;
  end if;

  return (
    select role from public.financial_space_members
    where space_id = p_space_id and user_id = p_user_id
  );
end;
$$;

-- financial_spaces_select: full-access rows (can_access_financial_space,
-- unchanged) PLUS existence-only visibility of any housemate's Personal
-- space, independent of shared_with_house -- this is what lets the app show
-- a locked card even when entry hasn't been granted.
drop policy if exists "financial_spaces_select" on public.financial_spaces;
create policy "financial_spaces_select" on public.financial_spaces
  for select
  to authenticated
  using (
    public.can_access_financial_space(id)
    or (type = 'personal' and public.is_housemate_of(owner_id))
  );

-- Self-service toggle: only the owner of a Personal space can flip it, for
-- their own space only. No admin override by design (product decision).
create or replace function public.set_personal_space_privacy(p_shared boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id
  from public.financial_spaces
  where type = 'personal' and owner_id = auth.uid();

  if v_space_id is null then
    raise exception 'No se encontró tu espacio personal';
  end if;

  update public.financial_spaces set shared_with_house = p_shared where id = v_space_id;
end;
$$;

grant execute on function public.set_personal_space_privacy(boolean) to authenticated;
revoke execute on function public.set_personal_space_privacy(boolean) from public, anon;

-- my_financial_spaces: include the new flag, and include a housemate's
-- Personal space in "my spaces" (full read-only entry) once shared.
create or replace view public.my_financial_spaces
with (security_invoker = true)
as
select
  s.id, s.type, s.visibility, s.name, s.icon,
  s.owner_id, s.house_id, s.created_by, s.created_at, s.updated_at,
  (s.owner_id = auth.uid()) as is_owner,
  s.shared_with_house
from public.financial_spaces s
where s.archived_at is null
  and (
    (s.type = 'personal' and (
      s.owner_id = auth.uid()
      or (s.shared_with_house and public.is_housemate_of(s.owner_id))
    ))
    or (s.type = 'shared' and exists (
      select 1 from public.financial_space_members m
      where m.space_id = s.id and m.user_id = auth.uid()
    ))
    or (s.type = 'household' and public.can_manage_economy(s.house_id))
  );

grant select on public.my_financial_spaces to authenticated;

-- EOF
