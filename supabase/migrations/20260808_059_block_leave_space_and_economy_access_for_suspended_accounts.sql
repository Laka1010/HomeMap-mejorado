-- Migration: cerrar leave_financial_space y las 5 RPC de
-- economy_access_requests para cuentas suspended/banned — encontradas
-- durante la verificación de consistencia posterior a la Fase 7, fuera del
-- alcance de los 5 hallazgos originales y de is_workspace_owner.
-- Date: 2026-08-08
--
-- ============================================================================
-- ANÁLISIS PREVIO (hecho antes de tocar nada)
-- ============================================================================
--
-- A diferencia de los 6 fixes anteriores (H-1, H-2, H-3, M-1, M-2, y
-- is_workspace_owner), ninguna de estas 6 funciones comparte un único
-- helper de autorización al que enganchar la comprobación:
--
--   leave_financial_space                 -- sin ningún helper; solo
--                                             auth.uid() = v_space.owner_id
--   request_economy_access                -- are_housemates(auth.uid(), p_owner_user_id)
--   grant_economy_access                  -- are_housemates(auth.uid(), p_requester_user_id)
--   respond_to_economy_access_request     -- comprobación directa de fila
--   revoke_economy_access                 -- comprobación directa de fila
--   cancel_economy_access_request         -- comprobación directa de fila
--
-- Se descartó tocar are_housemates/is_housemate_of (el único helper
-- compartido por 2 de las 6): is_housemate_of se usa en la política RLS
-- financial_spaces_select (visibilidad de existencia del espacio Personal
-- de un compañero de casa) -- tocarlo ahí bloquearía esa lectura para
-- terceros no relacionados con la suspensión, y la relación es simétrica
-- (A↔B), no distingue quién es el llamante a proteger. Mismo motivo por el
-- que is_workspace_owner (no get_workspace_role) fue el punto correcto en
-- la migración anterior.
--
-- Consecuencia: sin punto de centralización posible, se añade la misma
-- comprobación directamente al principio de cada una de las 6 funciones --
-- mismo patrón que pay_bill_from_account en la Fase 5 (que tampoco tenía
-- un helper compartido al que engancharse).
--
-- Verificado antes de tocar nada:
--   - Ningún trigger de sistema depende de que estas funciones tengan éxito
--     para una cuenta bloqueada (economy_access_revoke_on_leave_trg actúa
--     sobre home_members, no invoca ninguna de estas 6).
--   - Ninguna de las 6 toca financial_accounts/economy_income/economy_
--     expenses directamente -- cero riesgo de regresión sobre las
--     operaciones financieras ya protegidas.
--   - Las 6 tienen uso real confirmado en src/ (financialSpacesService.js,
--     economyAccessService.js), una llamada cada una.
--
-- Sin problema de NULL/three-valued logic: _is_account_blocked() nunca es
-- NULL (usa exists()).
--
-- Alcance: exactamente estas 6 funciones. Ninguna RLS, tabla, trigger, otro
-- helper ni el comportamiento de 'restricted' se modifican.

create or replace function public.leave_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo se puede abandonar un espacio compartido';
  end if;
  if auth.uid() = v_space.owner_id then
    raise exception 'El propietario no puede abandonar el espacio; archívalo en su lugar';
  end if;

  delete from public.financial_space_members where space_id = p_space_id and user_id = auth.uid();
  if not found then
    raise exception 'No perteneces a este espacio';
  end if;
end;
$$;

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
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

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
    'important',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver solicitud')
  );
end;
$$;

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
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

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
    end,
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver')
  );
end;
$$;

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
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

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
    coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa') || ' ha dejado de compartir su economía contigo.',
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver')
  );
end;
$$;

create or replace function public.cancel_economy_access_request(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

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

create or replace function public.grant_economy_access(p_requester_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_owner_name text;
  v_changed int;
begin
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

  if p_requester_user_id = auth.uid() then
    raise exception 'No puedes concederte acceso a ti mismo';
  end if;

  if not public.are_housemates(auth.uid(), p_requester_user_id) then
    raise exception 'Solo puedes compartir tu economía con un compañero de casa';
  end if;

  insert into public.economy_access_requests (owner_user_id, requester_user_id, status, responded_at)
  values (auth.uid(), p_requester_user_id, 'accepted', now())
  on conflict (owner_user_id, requester_user_id) do update
    set status = 'accepted',
        responded_at = now(),
        revoked_at = null,
        updated_at = now()
    where public.economy_access_requests.status <> 'accepted';

  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    return;
  end if;

  v_house_id := public.shared_house_id(auth.uid(), p_requester_user_id);
  select coalesce(display_name, email, '') into v_owner_name from public.profiles where id = auth.uid();

  perform public.notify_user(
    v_house_id,
    p_requester_user_id,
    'finanzas',
    'economy_access_granted',
    coalesce(nullif(v_owner_name, ''), 'Un compañero de casa') || ' ha compartido su economía contigo.',
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver')
  );
end;
$$;

-- EOF
