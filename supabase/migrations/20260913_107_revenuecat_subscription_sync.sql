-- Sincronización de suscripciones reales de RevenueCat con profiles.
-- subscription_status. El cliente (SDK móvil) nunca es la fuente de verdad
-- -- solo inicia la compra; el estado real lo manda siempre el webhook de
-- RevenueCat -> revenuecat-webhook -> sync_subscription_from_revenuecat,
-- vía service_role (nunca RLS-scoped, no hay usuario en esa petición).

alter table public.profiles
  add column if not exists subscription_platform text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_last_event_at timestamptz;

-- Ancla del ciclo de los límites de uso (get_premium_usage): una vez hay
-- suscripción real, el ciclo se alinea con esa fecha en vez de con la de
-- activación de la prueba interna.
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
      coalesce(p.subscription_started_at, p.trial_activated_at, p.created_at) as anchor,
      (
        extract(year from age(now(), coalesce(p.subscription_started_at, p.trial_activated_at, p.created_at)))::int * 12
        + extract(month from age(now(), coalesce(p.subscription_started_at, p.trial_activated_at, p.created_at)))::int
      ) as months_elapsed
    from public.profiles p
    where p.id = p_user_id
  ) s;
$function$;

-- Log de eventos de webhook ya procesados -- RevenueCat puede reenviar el
-- mismo evento si no respondemos 200 a tiempo. RLS activado sin políticas:
-- solo accesible con service_role, igual que security_admin_audit_log.
create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.revenuecat_webhook_events enable row level security;

-- Única función que puede cambiar subscription_status a partir de datos de
-- RevenueCat. SECURITY DEFINER sin grant a authenticated/anon a propósito
-- (revoke explícito abajo) -- solo invocable con la service_role key desde
-- revenuecat-webhook, nunca desde el navegador del usuario.
--
-- Regla de precedencia EXPLÍCITA entre pago real y prueba interna (no "gana
-- el más reciente"):
--   entitlement activo en RevenueCat            -> premium
--   sin nada activo pero con prueba interna concedida (trial_activated_at) -> trial
--   ninguno de los dos                          -> free
create or replace function public.sync_subscription_from_revenuecat(
  p_user_id uuid,
  p_event_id text,
  p_event_at timestamptz,
  p_entitlement_active boolean,
  p_expires_at timestamptz,
  p_started_at timestamptz,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted boolean;
  v_last_event_at timestamptz;
  v_trial_activated_at timestamptz;
  v_new_status text;
begin
  -- 1. De-duplicación: si este event_id ya se procesó, no hacer nada más.
  insert into public.revenuecat_webhook_events (event_id)
  values (p_event_id)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if not v_inserted then
    return;
  end if;

  select p.subscription_last_event_at, p.trial_activated_at
  into v_last_event_at, v_trial_activated_at
  from public.profiles p
  where p.id = p_user_id;

  -- 2. Orden: ignorar eventos más antiguos que el último ya aplicado
  -- (RevenueCat no garantiza entrega en orden).
  if v_last_event_at is not null and p_event_at <= v_last_event_at then
    return;
  end if;

  -- 3. Regla de precedencia explícita.
  if p_entitlement_active then
    v_new_status := 'premium';
  elsif v_trial_activated_at is not null then
    v_new_status := 'trial';
  else
    v_new_status := 'free';
  end if;

  update public.profiles
  set
    subscription_status = v_new_status,
    subscription_platform = p_platform,
    subscription_expires_at = p_expires_at,
    subscription_started_at = coalesce(subscription_started_at, p_started_at),
    subscription_last_event_at = p_event_at
  where id = p_user_id;
end;
$function$;

revoke all on function public.sync_subscription_from_revenuecat(uuid, text, timestamptz, boolean, timestamptz, timestamptz, text) from public, authenticated, anon;

-- record_ai_usage_event ya sigue el mismo patrón (SECURITY DEFINER,
-- auth.uid()-based) para el resto de la app; aquí no aplica porque este
-- RPC actúa sobre OTRO usuario (p_user_id), nunca sobre quien lo llama --
-- por eso el revoke explícito de arriba es la única defensa, no auth.uid().
