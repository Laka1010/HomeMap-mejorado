-- Migration: security_admin_platform_stats() — Fase 2 de Admin Console
-- (Overview / salud general de la plataforma)
-- Date: 2026-08-09
--
-- ============================================================================
-- POR QUÉ ESTA RPC Y NO OTRA COSA
-- ============================================================================
--
-- security_admin_dashboard_stats() (20260808_050_security_center.sql) ya
-- devuelve accounts_active/restricted/suspended/banned, events_24h_*,
-- sessions_active y ip_blocks_active. Recalcular eso aquí sería exactamente
-- la duplicación de lógica que se pidió evitar. Esta función SOLO añade lo
-- que hoy no existe en ningún sitio: usuarios totales, casas, workspaces y
-- miembros activos. El frontend del Overview compone ambas RPCs (esta +
-- security_admin_dashboard_stats), no recalcula nada dos veces.
--
-- Naming: se llama security_admin_platform_stats() (no admin_platform_
-- stats() como se propuso inicialmente) para seguir exactamente el prefijo
-- security_admin_* de las 22 RPCs ya existentes del panel de administración
-- — es el mismo "patrón exacto" que se pidió seguir, aplicado también al
-- nombre.
--
-- Alcance deliberadamente excluido: NINGÚN dato de financial_accounts
-- (saldos, tipos de cuenta) ni de economy_* (gastos/ingresos/facturas) —
-- Finance queda fuera de esta fase, tal y como se pidió. total_workspaces
-- es un recuento (count(*)) de financial_spaces, no expone nombres,
-- propietarios ni importes.
--
-- users_with_house = count(distinct user_id) de home_members — mide
-- activación (cuántos usuarios registrados han llegado a unirse/crear una
-- casa), no identifica a nadie individualmente en la respuesta.
--
-- signups_last_7_days: serie de 7 días (incluye hoy) con el recuento de
-- auth.users.created_at por día — mismo dato (fecha de alta) que ya lee
-- security_admin_search_users() hoy, aquí solo agregado por día, sin PII.
--
-- ============================================================================

create or replace function public.security_admin_platform_stats()
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
    'total_users', (select count(*) from auth.users where deleted_at is null),
    'total_houses', (select count(*) from public.houses),
    'total_workspaces', (select count(*) from public.financial_spaces where archived_at is null),
    'users_with_house', (select count(distinct user_id) from public.home_members),
    'signups_last_7_days', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'), 'count', coalesce(u.cnt, 0))
          order by d.day
        ),
        '[]'::jsonb
      )
      from generate_series(current_date - interval '6 days', current_date, interval '1 day') as d(day)
      left join (
        select date_trunc('day', created_at)::date as day, count(*) as cnt
        from auth.users
        where deleted_at is null and created_at >= current_date - interval '6 days'
        group by 1
      ) u on u.day = d.day::date
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.security_admin_platform_stats() from public, anon;
grant execute on function public.security_admin_platform_stats() to authenticated;

-- EOF
