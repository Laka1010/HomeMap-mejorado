-- Migration: notificaciones de acceso a economía traducibles
-- Date: 2026-08-19
--
-- Complementa 20260819_069. Aquella hizo traducibles las notificaciones que
-- genera el motor de reglas en JS (src/notifications/rules/*.js), pero hay un
-- SEGUNDO generador que se quedó fuera: public.notify_user, llamado desde las
-- cuatro RPC de acceso a economía. Esas cinco notificaciones se insertaban con
-- el título y la etiqueta del botón ya montados en español, así que un usuario
-- con la app en inglés las seguía viendo en español.
--
-- Enfoque: notify_user acepta ahora title_key / title_vars / action_label_key,
-- y cada RPC pasa la clave y el nombre por separado en vez de concatenarlos.
-- El título en español se sigue guardando en la columna title como respaldo
-- (filas antiguas, y cualquier lector que no sea la interfaz).
--
-- De las cuatro RPC solo cambia el bloque `perform notify_user(...)` final.
-- La lógica de autorización (_is_account_blocked, are_housemates, los checks
-- de propiedad y estado) y los UPDATE/INSERT sobre economy_access_requests se
-- reproducen aquí tal y como están hoy en la base de datos: esta migración no
-- relaja ni cambia ningún permiso.

-- notify_user se borra y se recrea en vez de usar solo CREATE OR REPLACE:
-- añadir parámetros nuevos crea una SOBRECARGA, y entonces las llamadas con
-- ocho argumentos quedarían ambiguas.
drop function if exists public.notify_user(uuid, uuid, text, text, text, text, text, jsonb);

create or replace function public.notify_user(
  p_house_id uuid,
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text default null,
  p_priority text default 'info',
  p_action jsonb default null,
  p_title_key text default null,
  p_title_vars jsonb default null,
  p_action_label_key text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_house_id is null or p_user_id is null then
    return;
  end if;

  insert into public.notifications (
    house_id, user_id, category, type, priority, dedupe_key,
    title, body, action, title_key, title_vars, action_label_key
  )
  values (
    p_house_id, p_user_id, p_category, p_type, p_priority,
    p_type || ':' || gen_random_uuid()::text,
    p_title, p_body, p_action, p_title_key, p_title_vars, p_action_label_key
  );
end;
$function$;

revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, text, jsonb, text, jsonb, text) from public, anon;

-- ---------------------------------------------------------------------------

create or replace function public.request_economy_access(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_owner_name := coalesce(nullif(v_owner_name, ''), 'Un compañero de casa');

  perform public.notify_user(
    v_house_id,
    p_owner_user_id,
    'finanzas',
    'economy_access_requested',
    v_owner_name || ' quiere ver tu economía personal.',
    null,
    'important',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver solicitud'),
    'notifications.economyAccessRequested',
    jsonb_build_object('name', v_owner_name),
    'notifications.viewRequestAction'
  );
end;
$function$;

create or replace function public.grant_economy_access(p_requester_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    -- ya estaba compartido con esta persona -- idempotente, nada que notificar.
    return;
  end if;

  v_house_id := public.shared_house_id(auth.uid(), p_requester_user_id);
  select coalesce(display_name, email, '') into v_owner_name from public.profiles where id = auth.uid();
  v_owner_name := coalesce(nullif(v_owner_name, ''), 'Un compañero de casa');

  perform public.notify_user(
    v_house_id,
    p_requester_user_id,
    'finanzas',
    'economy_access_granted',
    v_owner_name || ' ha compartido su economía contigo.',
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver'),
    'notifications.economyAccessGranted',
    jsonb_build_object('name', v_owner_name),
    'notifications.viewAction'
  );
end;
$function$;

create or replace function public.respond_to_economy_access_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_owner_name := coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa');

  perform public.notify_user(
    v_house_id,
    v_request.requester_user_id,
    'finanzas',
    case when p_accept then 'economy_access_accepted' else 'economy_access_rejected' end,
    case
      when p_accept then v_owner_name || ' ha aceptado tu solicitud para compartir su economía.'
      else v_owner_name || ' ha rechazado tu solicitud.'
    end,
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver'),
    case when p_accept then 'notifications.economyAccessAccepted' else 'notifications.economyAccessRejected' end,
    jsonb_build_object('name', v_owner_name),
    'notifications.viewAction'
  );
end;
$function$;

create or replace function public.revoke_economy_access(p_requester_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_owner_name := coalesce(nullif(v_owner_name, ''), 'Tu compañero de casa');

  perform public.notify_user(
    v_house_id,
    p_requester_user_id,
    'finanzas',
    'economy_access_revoked',
    v_owner_name || ' ha dejado de compartir su economía contigo.',
    null,
    'info',
    jsonb_build_object('type', 'open_house_settings', 'label', 'Ver'),
    'notifications.economyAccessRevoked',
    jsonb_build_object('name', v_owner_name),
    'notifications.viewAction'
  );
end;
$function$;

grant execute on function public.request_economy_access(uuid) to authenticated;
grant execute on function public.grant_economy_access(uuid) to authenticated;
grant execute on function public.respond_to_economy_access_request(uuid, boolean) to authenticated;
grant execute on function public.revoke_economy_access(uuid) to authenticated;
revoke execute on function public.request_economy_access(uuid) from public, anon;
revoke execute on function public.grant_economy_access(uuid) from public, anon;
revoke execute on function public.respond_to_economy_access_request(uuid, boolean) from public, anon;
revoke execute on function public.revoke_economy_access(uuid) from public, anon;

-- EOF
