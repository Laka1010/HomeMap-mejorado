-- Migration: notify_user exige que llamante y destinatario sean de la casa
-- (hallazgo M-1 de la auditoría)
-- Date: 2026-09-01
--
-- notify_user es SECURITY DEFINER, está concedida a `authenticated` y su único
-- control era `if p_house_id is null or p_user_id is null then return`. No
-- comprobaba que el llamante fuera miembro de p_house_id, ni que p_user_id lo
-- fuera. Cualquier usuario autenticado podía insertar notificaciones con
-- título, cuerpo, prioridad 'critical' y payload `action` arbitrarios para
-- cualquier par (casa, usuario) cuyos UUID conociera -- en la práctica, sus
-- convivientes. Vector de phishing dentro de la app, y de spam ilimitado
-- porque el dedupe_key lleva un gen_random_uuid() y no deduplica nunca.
--
-- Llamantes legítimos (verificado): request_economy_access,
-- respond_to_economy_access_request, grant_economy_access y
-- revoke_economy_access. En las cuatro, auth.uid() es un miembro de la casa
-- compartida y el destinatario también, así que la comprobación no las rompe.
--
-- Se usa un EXISTS directo sobre home_members en vez de is_house_member(),
-- a propósito: is_house_member() incorpora _is_account_blocked(), y esas cuatro
-- RPCs ya gestionan la suspensión por su cuenta. No queremos acoplar aquí dos
-- reglas distintas.
--
-- auth.uid() nulo significa contexto de servidor (service_role): notify_user no
-- está concedida a anon, así que ahí no hay llamante que validar y se deja
-- pasar para no romper un futuro job programado.
--
-- REVERSIBLE: reaplicar la definición de 20260819_070_notify_user_i18n_keys.sql.

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
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if p_house_id is null or p_user_id is null then
    return;
  end if;

  -- M-1: el llamante tiene que pertenecer a la casa sobre la que notifica.
  if v_caller is not null and not exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = v_caller
  ) then
    raise exception 'No autorizado: no perteneces a esta casa'
      using errcode = '42501';
  end if;

  -- M-1: y el destinatario también, o la notificación no la vería nadie
  -- (la política RLS de notifications exige is_house_member) y solo serviría
  -- para ensuciar la tabla.
  if not exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = p_user_id
  ) then
    raise exception 'El destinatario no pertenece a esta casa'
      using errcode = '42501';
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
$$;

-- EOF
