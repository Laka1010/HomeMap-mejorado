-- Migration: añade el botón de acción a las notificaciones de acceso a economía
-- Date: 2026-08-08
--
-- notify_user() (20260808_042) se quedó sin pasar `action`, así que las
-- notificaciones de solicitud/aceptación/rechazo/revocación no tenían botón
-- para llevar directo a gestionarlas (src/notifications/notificationActions.js
-- espera notification.action.type/.label). Se añade el parámetro y se pasa
-- `open_house_settings` desde los 3 RPCs que sí notifican a otro usuario.

create or replace function public.notify_user(
  p_house_id uuid,
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text default null,
  p_priority text default 'info',
  p_action jsonb default null
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

  insert into public.notifications (house_id, user_id, category, type, priority, dedupe_key, title, body, action)
  values (p_house_id, p_user_id, p_category, p_type, p_priority, p_type || ':' || gen_random_uuid()::text, p_title, p_body, p_action);
end;
$$;

grant execute on function public.notify_user(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;
revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;

-- La firma anterior (7 argumentos, sin p_action) deja de usarse.
drop function if exists public.notify_user(uuid, uuid, text, text, text, text, text);


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

-- EOF
