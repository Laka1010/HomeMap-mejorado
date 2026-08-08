-- Migration: consentimiento explícito para ver la economía Personal de otro
-- Date: 2026-08-08
--
-- Reemplaza por completo el mecanismo anterior (20260808_041,
-- shared_with_house): aquel era un interruptor global -- "comparto mi
-- Personal con TODA la casa de golpe". El producto quiere algo más fino:
-- una solicitud explícita entre dos usuarios concretos (A pide ver la
-- economía de B; B acepta/rechaza/revoca cuando quiera), sin que
-- pertenecer a la misma casa conceda nada por sí solo.
--
-- La visibilidad de "existencia" de un espacio Personal ajeno (financial_
-- spaces_select, tarjeta bloqueada en el switcher) NO cambia -- sigue
-- dependiendo de is_housemate_of/are_housemates, es infraestructura
-- independiente de quién puede ENTRAR a leer los datos.

-- ============================================================================
-- 1. are_housemates: versión simétrica de is_housemate_of que no asume que
--    uno de los dos lados es auth.uid(). is_housemate_of se redefine como un
--    envoltorio para no romper a quien ya la llama (financial_spaces_select,
--    listHousematesPersonalSpaces).
-- ============================================================================

create or replace function public.are_housemates(p_user_a uuid, p_user_b uuid)
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
      where hm1.user_id = p_user_a and hm2.user_id = p_user_b
    ),
    false
  );
$$;

grant execute on function public.are_housemates(uuid, uuid) to authenticated;
revoke execute on function public.are_housemates(uuid, uuid) from public, anon;

create or replace function public.is_housemate_of(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.are_housemates(p_user_id, auth.uid());
$$;

grant execute on function public.is_housemate_of(uuid) to authenticated;
revoke execute on function public.is_housemate_of(uuid) from public, anon;

-- ============================================================================
-- 2. Tabla de solicitudes de acceso
-- ============================================================================

create table public.economy_access_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint economy_access_requests_no_self check (owner_user_id <> requester_user_id),
  unique (owner_user_id, requester_user_id)
);

create index economy_access_requests_owner_idx on public.economy_access_requests(owner_user_id, status);
create index economy_access_requests_requester_idx on public.economy_access_requests(requester_user_id, status);

alter table public.economy_access_requests enable row level security;

-- Solo las dos partes implicadas pueden ver la fila. Sin políticas de
-- insert/update/delete: toda escritura pasa por los RPCs de abajo (mismo
-- patrón que financial_space_members/home_members en este esquema).
create policy "economy_access_requests_select" on public.economy_access_requests
  for select
  to authenticated
  using (auth.uid() = owner_user_id or auth.uid() = requester_user_id);

-- ============================================================================
-- 3. has_accepted_economy_access: el único punto que consulta
--    get_workspace_role/my_financial_spaces para decidir acceso de lectura.
--    No re-chequea housemates en vivo -- eso lo mantiene correcto el
--    trigger de la sección 7, igual que cleanup_financial_space_membership_
--    on_leave ya hace para financial_space_members.
-- ============================================================================

create or replace function public.has_accepted_economy_access(p_owner_user_id uuid, p_requester_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.economy_access_requests r
      where r.owner_user_id = p_owner_user_id
        and r.requester_user_id = p_requester_user_id
        and r.status = 'accepted'
    ),
    false
  );
$$;

grant execute on function public.has_accepted_economy_access(uuid, uuid) to authenticated;
revoke execute on function public.has_accepted_economy_access(uuid, uuid) from public, anon;

-- ============================================================================
-- 4. notify_user: helper compartido para notificaciones dirigidas a OTRO
--    usuario (el cliente no puede insertar una fila con user_id distinto de
--    sí mismo, ver notifications_rw_members en 20260728_007). dedupe_key
--    lleva un uuid porque cada evento (solicitud/aceptación/rechazo/
--    revocación) es puntual, no una condición reevaluada como las del motor
--    de reglas -- no tiene sentido intentar deduplicar por clave estable.
--    Nunca debe recibir cifras económicas en p_title/p_body.
-- ============================================================================

create or replace function public.notify_user(
  p_house_id uuid,
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text default null,
  p_priority text default 'info'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_house_id is null or p_user_id is null then
    return;
  end if;

  insert into public.notifications (house_id, user_id, category, type, priority, dedupe_key, title, body)
  values (p_house_id, p_user_id, p_category, p_type, p_priority, p_type || ':' || gen_random_uuid()::text, p_title, p_body);
end;
$$;

grant execute on function public.notify_user(uuid, uuid, text, text, text, text, text) to authenticated;
revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, text) from public, anon;

-- Casa que comparten dos usuarios, para enrutar la notificación. Devuelve
-- una cualquiera si comparten varias -- el acceso en sí nunca depende de
-- esto (has_accepted_economy_access no mira house_id), solo la notificación.
create or replace function public.shared_house_id(p_user_a uuid, p_user_b uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm1.house_id
  from public.home_members hm1
  join public.home_members hm2 on hm2.house_id = hm1.house_id
  where hm1.user_id = p_user_a and hm2.user_id = p_user_b
  limit 1;
$$;

grant execute on function public.shared_house_id(uuid, uuid) to authenticated;
revoke execute on function public.shared_house_id(uuid, uuid) from public, anon;

-- ============================================================================
-- 5. RPCs de escritura
-- ============================================================================

create or replace function public.request_economy_access(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_status text;
  v_owner_name text;
begin
  if p_owner_user_id = auth.uid() then
    raise exception 'No puedes solicitarte acceso a ti mismo';
  end if;

  if not public.are_housemates(auth.uid(), p_owner_user_id) then
    raise exception 'Solo puedes solicitar acceso a la economía de un compañero de casa';
  end if;

  v_house_id := public.shared_house_id(auth.uid(), p_owner_user_id);

  insert into public.economy_access_requests (owner_user_id, requester_user_id, status)
  values (p_owner_user_id, auth.uid(), 'pending')
  on conflict (owner_user_id, requester_user_id) do update
    set status = 'pending',
        responded_at = null,
        revoked_at = null,
        updated_at = now()
    where public.economy_access_requests.status in ('rejected', 'revoked')
  returning status into v_status;

  if v_status is null then
    select status into v_status
    from public.economy_access_requests
    where owner_user_id = p_owner_user_id and requester_user_id = auth.uid();

    if v_status = 'accepted' then
      raise exception 'Ya tienes acceso concedido a esta economía';
    else
      raise exception 'Ya existe una solicitud pendiente';
    end if;
  end if;

  select coalesce(display_name, email, '') into v_owner_name from public.profiles where id = auth.uid();

  perform public.notify_user(
    v_house_id,
    p_owner_user_id,
    'finanzas',
    'economy_access_requested',
    coalesce(nullif(v_owner_name, ''), 'Un compañero de casa') || ' quiere ver tu economía personal.',
    null,
    'important'
  );
end;
$$;

grant execute on function public.request_economy_access(uuid) to authenticated;
revoke execute on function public.request_economy_access(uuid) from public, anon;


create or replace function public.respond_to_economy_access_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.economy_access_requests;
  v_house_id uuid;
  v_owner_name text;
begin
  select * into v_request from public.economy_access_requests where id = p_request_id;

  if v_request is null or v_request.owner_user_id <> auth.uid() then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Esta solicitud ya no está pendiente';
  end if;

  update public.economy_access_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = now(),
      updated_at = now()
  where id = p_request_id;

  v_house_id := public.shared_house_id(auth.uid(), v_request.requester_user_id);
  select coalesce(display_name, email, '') into v_owner_name from public.profiles where id = auth.uid();

  perform public.notify_user(
    v_house_id,
    v_request.requester_user_id,
    'finanzas',
    case when p_accept then 'economy_access_accepted' else 'economy_access_rejected' end,
    case
      when p_accept then coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa') || ' ha aceptado tu solicitud para compartir su economía.'
      else coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa') || ' ha rechazado tu solicitud.'
    end
  );
end;
$$;

grant execute on function public.respond_to_economy_access_request(uuid, boolean) to authenticated;
revoke execute on function public.respond_to_economy_access_request(uuid, boolean) from public, anon;


create or replace function public.revoke_economy_access(p_requester_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_owner_name text;
  v_updated int;
begin
  update public.economy_access_requests
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where owner_user_id = auth.uid()
    and requester_user_id = p_requester_user_id
    and status = 'accepted';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'No hay acceso concedido que revocar';
  end if;

  v_house_id := public.shared_house_id(auth.uid(), p_requester_user_id);
  select coalesce(display_name, email, '') into v_owner_name from public.profiles where id = auth.uid();

  perform public.notify_user(
    v_house_id,
    p_requester_user_id,
    'finanzas',
    'economy_access_revoked',
    coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa') || ' ha dejado de compartir su economía contigo.'
  );
end;
$$;

grant execute on function public.revoke_economy_access(uuid) to authenticated;
revoke execute on function public.revoke_economy_access(uuid) from public, anon;


-- El propio requester retira una solicitud suya que sigue pendiente. Como
-- nunca llegó a 'accepted' no hay nada que "revocar" en sentido estricto,
-- así que se borra en vez de reusar el estado 'revoked' (evitaría un
-- estado engañoso: "revocado" algo que nunca se llegó a conceder).
create or replace function public.cancel_economy_access_request(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.economy_access_requests
  where owner_user_id = p_owner_user_id
    and requester_user_id = auth.uid()
    and status = 'pending';

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'No hay ninguna solicitud pendiente que cancelar';
  end if;
end;
$$;

grant execute on function public.cancel_economy_access_request(uuid) to authenticated;
revoke execute on function public.cancel_economy_access_request(uuid) from public, anon;

-- ============================================================================
-- 6. get_workspace_role / my_financial_spaces: sustituir la rama
--    shared_with_house por has_accepted_economy_access.
-- ============================================================================

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
  v_role_override text;
  v_house_role text;
begin
  select type, house_id, owner_id into v_type, v_house_id, v_owner_id
  from public.financial_spaces
  where id = p_space_id and archived_at is null;

  if v_type is null then
    return null;
  end if;

  if v_type = 'personal' then
    if v_owner_id = p_user_id then
      return 'owner';
    end if;
    if public.has_accepted_economy_access(v_owner_id, p_user_id) then
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

grant execute on function public.get_workspace_role(uuid, uuid) to authenticated;
revoke execute on function public.get_workspace_role(uuid, uuid) from public, anon;

drop view if exists public.my_financial_spaces;

create view public.my_financial_spaces
with (security_invoker = true)
as
select
  s.id, s.type, s.visibility, s.name, s.icon,
  s.owner_id, s.house_id, s.created_by, s.created_at, s.updated_at,
  (s.owner_id = auth.uid()) as is_owner
from public.financial_spaces s
where s.archived_at is null
  and (
    (s.type = 'personal' and (
      s.owner_id = auth.uid()
      or public.has_accepted_economy_access(s.owner_id, auth.uid())
    ))
    or (s.type = 'shared' and exists (
      select 1 from public.financial_space_members m
      where m.space_id = s.id and m.user_id = auth.uid()
    ))
    or (s.type = 'household' and public.can_manage_economy(s.house_id))
  );

grant select on public.my_financial_spaces to authenticated;

-- ============================================================================
-- 7. Revocación automática al dejar de ser compañeros de casa. Mismo patrón
--    que cleanup_financial_space_membership_on_leave (trigger AFTER DELETE
--    en home_members). Se ejecuta para cada fila borrada; si dos usuarios
--    ya no comparten NINGUNA casa (are_housemates en vivo, no restringido a
--    la casa que se acaba de dejar), se revoca el acceso concedido y se
--    borran las solicitudes pendientes que hayan quedado huérfanas. Sin
--    notificación en este camino -- no hay una casa clara a la que atarla.
-- ============================================================================

create or replace function public.economy_access_revoke_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.economy_access_requests
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where status = 'accepted'
    and (owner_user_id = old.user_id or requester_user_id = old.user_id)
    and not public.are_housemates(owner_user_id, requester_user_id);

  delete from public.economy_access_requests
  where status = 'pending'
    and (owner_user_id = old.user_id or requester_user_id = old.user_id)
    and not public.are_housemates(owner_user_id, requester_user_id);

  return old;
end;
$$;

revoke execute on function public.economy_access_revoke_on_leave() from public, anon;

drop trigger if exists economy_access_revoke_on_leave_trg on public.home_members;
create trigger economy_access_revoke_on_leave_trg
  after delete on public.home_members
  for each row
  execute function public.economy_access_revoke_on_leave();

-- ============================================================================
-- 8. Retirar el mecanismo antiguo (shared_with_house). Debe ir al final:
--    la vista y la función de arriba ya no referencian la columna, así que
--    ahora se puede borrar sin que Postgres se queje de la dependencia.
-- ============================================================================

drop function if exists public.set_personal_space_privacy(boolean);

alter table public.financial_spaces
  drop constraint if exists financial_spaces_shared_with_house_only_personal;

alter table public.financial_spaces
  drop column if exists shared_with_house;

-- EOF
