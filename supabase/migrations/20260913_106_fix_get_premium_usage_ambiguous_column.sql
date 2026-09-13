-- Fix: el parámetro de salida `feature_key` de la tabla que devuelve
-- get_premium_usage crea una variable PL/pgSQL del mismo nombre, que
-- ensombrecía la columna feature_key de premium_limits/ai_usage_events
-- (error 42702 "column reference is ambiguous"). Se cualifican todas las
-- referencias a esa columna con el nombre de tabla.
create or replace function public.get_premium_usage(p_feature_key text)
returns table(
  feature_key text,
  used int,
  limit_value int,
  remaining int,
  allowed boolean,
  cycle_start timestamptz,
  cycle_end timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_limit int;
  v_is_premium boolean;
  v_used int;
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
begin
  select pl.monthly_limit into v_limit from public.premium_limits pl where pl.feature_key = p_feature_key;
  if v_limit is null then
    raise exception 'Función Premium desconocida: %', p_feature_key;
  end if;

  select exists (
    select 1 from public.profiles
    where id = auth.uid() and subscription_status in ('trial', 'premium')
  ) into v_is_premium;

  select cb.cycle_start, cb.cycle_end into v_cycle_start, v_cycle_end
  from public._premium_cycle_bounds(auth.uid()) cb;

  select count(*) into v_used
  from public.ai_usage_events ue
  where ue.user_id = auth.uid()
    and ue.feature_key = p_feature_key
    and ue.success = true
    and ue.created_at >= v_cycle_start
    and ue.created_at < v_cycle_end;

  return query select
    p_feature_key,
    v_used,
    v_limit,
    greatest(v_limit - v_used, 0),
    (v_is_premium and v_used < v_limit),
    v_cycle_start,
    v_cycle_end;
end;
$function$;
