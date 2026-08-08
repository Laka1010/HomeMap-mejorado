-- Migration: el dueño puede compartir su economía directamente, sin esperar
-- una solicitud
-- Date: 2026-08-08
--
-- Complementa (no sustituye) el flujo de solicitud de 20260808_042: además
-- de que alguien te pida acceso y tú lo aceptes, ahora el propio dueño
-- puede elegir directamente a un compañero de casa y concederle acceso de
-- una vez, sin que haga falta que esa persona lo pida antes. Sigue siendo
-- consentimiento explícito (una acción deliberada del dueño) y sigue sin
-- depender de pertenecer a la misma casa por sí solo -- are_housemates es
-- un requisito, no la causa del acceso.

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

grant execute on function public.grant_economy_access(uuid) to authenticated;
revoke execute on function public.grant_economy_access(uuid) from public, anon;

-- EOF
