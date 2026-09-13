-- Migration: registro de uso de IA (Haven IA)
-- Date: 2026-09-13
--
-- Sección 11 del pedido de Haven IA: registrar desde ya el uso de IA por
-- función para poder aplicar límites mensuales más adelante sin
-- rearquitectura. No es lo mismo que vision_proxy_usage
-- (20260808_035_vision_proxy_usage_table.sql): esa tabla es un contador
-- diario TOTAL por usuario para la cuota de la Edge Function vision-proxy,
-- sin distinguir qué función de Haven la disparó. Esta tabla sí distingue
-- por feature_key y guarda cada evento (no un contador acumulado), para
-- poder consultar "uso este mes" por función sin perder el histórico.
--
-- Sin límite aplicado todavía -- el DAILY_CALL_LIMIT=60 de vision-proxy ya
-- actúa de tope global de respaldo. Un tope mensual por función se añade
-- después con un simple `if` sobre get_my_ai_usage_count, sin tocar esta
-- tabla ni las funciones de escritura.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_feature_created_idx
  on public.ai_usage_events (user_id, feature_key, created_at);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_select_own on public.ai_usage_events;
create policy ai_usage_events_select_own
  on public.ai_usage_events for select
  using (user_id = auth.uid());

-- Sin policy de insert a propósito: toda escritura pasa por
-- record_ai_usage_event (security definer), igual que el resto de tablas de
-- eventos de la app (ver security_events).

create or replace function public.record_ai_usage_event(p_feature_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_usage_events (user_id, feature_key)
  values (auth.uid(), p_feature_key);
end;
$$;

revoke all on function public.record_ai_usage_event(text) from public, anon;
grant execute on function public.record_ai_usage_event(text) to authenticated;

create or replace function public.get_my_ai_usage_count(p_feature_key text, p_since timestamptz)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from public.ai_usage_events
  where user_id = auth.uid() and feature_key = p_feature_key and created_at >= p_since;
$$;

revoke all on function public.get_my_ai_usage_count(text, timestamptz) from public, anon;
grant execute on function public.get_my_ai_usage_count(text, timestamptz) to authenticated;

-- EOF
