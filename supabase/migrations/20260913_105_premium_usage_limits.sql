-- Límites de uso mensuales para Haven IA Premium (chat, análisis de fotos
-- de consumibles, escáner de tickets). Hasta ahora can_use_premium_feature
-- solo sabía responder "¿es Premium?" -- aquí se añade "¿y ha superado ya
-- su cupo de este ciclo?" sin tocar el resto de features (multiple_homes,
-- premium_icons siguen sin límite de uso, tal como se pidió).

-- request_id: de-dupe de reintentos (una misma operación reintentada no
-- debe gastar dos créditos). success: solo lo que success=true cuenta para
-- el límite -- un fallo técnico no debe consumir cupo del usuario.
alter table public.ai_usage_events
  add column if not exists request_id text,
  add column if not exists success boolean not null default true;

create unique index if not exists ai_usage_events_dedupe_idx
  on public.ai_usage_events (user_id, feature_key, request_id)
  where request_id is not null;

-- Única fuente de verdad de los límites: cambiar un número es un UPDATE,
-- nunca una migración ni un redeploy. Sin insert/update/delete de cliente
-- (RLS solo permite lectura) -- se edita a mano por SQL cuando haga falta.
create table if not exists public.premium_limits (
  feature_key text primary key,
  monthly_limit int not null,
  updated_at timestamptz not null default now()
);

alter table public.premium_limits enable row level security;

drop policy if exists premium_limits_select_all on public.premium_limits;
create policy premium_limits_select_all on public.premium_limits
  for select using (true);

insert into public.premium_limits (feature_key, monthly_limit) values
  ('ai_chat', 200),
  ('ai_consumables', 50),
  ('receipt_scanner', 30)
on conflict (feature_key) do nothing;

-- Ancla del ciclo: sin integración de pagos real todavía, se usa la fecha
-- de activación de la prueba (o de creación del perfil si nunca activó
-- prueba) y se suman meses completos con make_interval. Cuando exista
-- integración real de suscripción (Google Play), este es el único sitio a
-- reemplazar por el ciclo real de facturación.
create or replace function public._premium_cycle_bounds(p_user_id uuid)
returns table(cycle_start timestamptz, cycle_end timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    anchor + make_interval(months => months_elapsed) as cycle_start,
    anchor + make_interval(months => months_elapsed + 1) as cycle_end
  from (
    select
      coalesce(p.trial_activated_at, p.created_at) as anchor,
      (
        extract(year from age(now(), coalesce(p.trial_activated_at, p.created_at)))::int * 12
        + extract(month from age(now(), coalesce(p.trial_activated_at, p.created_at)))::int
      ) as months_elapsed
    from public.profiles p
    where p.id = p_user_id
  ) s;
$function$;

-- Función central reutilizada por cliente y servidor: una sola llamada
-- devuelve uso/límite/restante y si la operación está permitida ("allowed"
-- ya exige Premium activo Y estar bajo el límite). Los Edge Functions solo
-- necesitan comprobar "allowed" antes de gastar una llamada a un proveedor
-- de IA.
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
  select monthly_limit into v_limit from public.premium_limits where feature_key = p_feature_key;
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
  from public.ai_usage_events
  where user_id = auth.uid()
    and feature_key = p_feature_key
    and success = true
    and created_at >= v_cycle_start
    and created_at < v_cycle_end;

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

-- multiple_homes/premium_icons siguen siendo solo "¿es Premium?" (sin
-- límite de uso, tal como se pidió explícitamente); ai_chat/ai_consumables/
-- receipt_scanner delegan en get_premium_usage para incorporar también el
-- cupo del ciclo actual.
create or replace function public.can_use_premium_feature(p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_allowed boolean;
begin
  if p_feature_key in ('ai_chat', 'ai_consumables', 'receipt_scanner') then
    select allowed into v_allowed from public.get_premium_usage(p_feature_key);
    return coalesce(v_allowed, false);
  end if;

  return exists (
    select 1 from public.profiles
    where id = auth.uid() and subscription_status in ('trial', 'premium')
  );
end;
$function$;

create or replace function public.record_ai_usage_event(
  p_feature_key text,
  p_request_id text default null,
  p_success boolean default true
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.ai_usage_events (user_id, feature_key, request_id, success)
  values (auth.uid(), p_feature_key, p_request_id, p_success)
  on conflict (user_id, feature_key, request_id) where request_id is not null do nothing;
end;
$function$;

-- El pedido nombra la categoría de chat "ai_chat"; el código ya desplegado
-- usaba "ai_assistant" -- se renombra el valor (no el identificador JS
-- PREMIUM_FEATURES.AI_ASSISTANT) y se migran los eventos ya registrados.
update public.ai_usage_events set feature_key = 'ai_chat' where feature_key = 'ai_assistant';
