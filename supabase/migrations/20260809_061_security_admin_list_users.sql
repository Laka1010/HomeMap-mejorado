-- Migration: security_admin_list_users() — Fase 3 de Admin Console (Users)
-- Date: 2026-08-09
--
-- ============================================================================
-- POR QUÉ ESTA RPC Y NO OTRA COSA
-- ============================================================================
--
-- security_admin_search_users(p_query text) (20260808_050_security_center.sql)
-- exige length(trim(p_query)) >= 2 -- no permite "listar todos" ni filtrar
-- por estado (active/restricted/suspended/banned), y no pagina (limit 25
-- fijo, sin offset, sin total_count). La sección Users de Admin Console
-- necesita ambas cosas (listado + filtro de estado), así que esta función
-- es NUEVA Y ADITIVA: security_admin_search_users no se toca, sigue
-- exactamente igual para la pestaña "Security Users" de Security Center.
--
-- Mismo shape de columnas que security_admin_search_users (mismo nivel de
-- exposición de datos, cero campos nuevos) + total_count vía count(*)
-- over(), mismo patrón ya usado en security_admin_list_events(). Mismo
-- clamp de límite (least/greatest, tope 200) que security_admin_list_events.
--
-- Alcance deliberadamente excluido (documentado en el análisis de Fase 3,
-- confirmado por el usuario): sin protección de "último Security Admin"
-- (riesgo preexistente en las RPCs de acción, no en esta), sin datos de
-- casas/financieros.
--
-- Desviación menor respecto al diseño original, encontrada probando la
-- paginación: "order by p.display_name" (mismo criterio que
-- security_admin_search_users) no es determinista cuando varios usuarios
-- comparten el mismo display_name literal (hay 3 "Lucas" reales en esta
-- base) — sin desempate, la misma fila podría aparecer en dos páginas
-- distintas o desaparecer entre ellas. security_admin_search_users nunca
-- lo sufre porque no pagina; esta función sí, así que se añade "u.id"
-- como desempate estable. No afecta a ninguna otra función.
--
-- ============================================================================

create or replace function public.security_admin_list_users(
  p_status text default null,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  recent_events_count bigint,
  high_critical_count bigint,
  active_sessions_count bigint,
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

  if p_status is not null and p_status not in ('active', 'restricted', 'suspended', 'banned') then
    raise exception 'Estado no válido: %', p_status;
  end if;

  return query
  select
    u.id, p.display_name, p.email,
    coalesce(s.status, 'active') as status,
    u.created_at, u.last_sign_in_at,
    (select count(*) from public.security_events e where e.user_id = u.id and e.created_at >= now() - interval '30 days') as recent_events_count,
    (select count(*) from public.security_events e where e.user_id = u.id and e.severity in ('warning', 'critical') and e.created_at >= now() - interval '30 days') as high_critical_count,
    (select count(*) from auth.sessions ses where ses.user_id = u.id) as active_sessions_count,
    count(*) over() as total_count
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.account_security_state s on s.user_id = u.id
  where u.deleted_at is null
    and (p_status is null or coalesce(s.status, 'active') = p_status)
    and (
      p_query is null or length(trim(p_query)) = 0
      or p.email ilike '%' || trim(p_query) || '%'
      or p.display_name ilike '%' || trim(p_query) || '%'
    )
  order by p.display_name nulls last, u.id
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.security_admin_list_users(text, text, integer, integer) from public, anon;
grant execute on function public.security_admin_list_users(text, text, integer, integer) to authenticated;

-- EOF
