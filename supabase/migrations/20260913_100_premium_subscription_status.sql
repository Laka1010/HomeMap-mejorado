-- Migration: estado de suscripción Premium (fase de prueba)
-- Date: 2026-09-13
--
-- Haven IA introduce 4 funciones (inventario IA de consumibles, escáner de
-- tickets, varias casas, iconos premium) pensadas para ser Premium en el
-- futuro. Por ahora no hay pagos: se añade un estado interno por usuario
-- (no por casa -- el gate de "varias casas" se evalúa para un usuario que
-- quiere una casa MÁS, antes de que exista contexto de esa casa nueva, y
-- "activar Premium" es algo que la persona hace, no la casa) que el propio
-- usuario activa a mano desde el hub de Haven IA ("Activar Premium
-- (prueba)"), sin automatismo ni valor por defecto distinto de 'free'.
--
-- can_use_premium_feature(p_feature_key) es la única puerta de entrada que
-- debe consultar cualquier función/RPC que necesite saber si el usuario
-- puede usar una función premium -- incluida la propia base de datos (ver
-- 20260913_102_multiple_homes_premium.sql). Se deja el parámetro desde ya
-- aunque hoy todas las claves se comporten igual, para poder diferenciar
-- reglas por función más adelante sin cambiar la firma en ningún call site.

alter table public.profiles
  add column if not exists subscription_status text not null default 'free',
  add column if not exists trial_activated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;
alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('free', 'trial', 'premium', 'expired'));

create or replace function public.get_my_subscription_status()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select subscription_status from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_subscription_status() from public, anon;
grant execute on function public.get_my_subscription_status() to authenticated;

create or replace function public.can_use_premium_feature(p_feature_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and subscription_status in ('trial', 'premium')
  );
$$;

revoke all on function public.can_use_premium_feature(text) from public, anon;
grant execute on function public.can_use_premium_feature(text) to authenticated;

-- Idempotente a propósito: solo pasa de 'free' a 'trial'. Repetir la
-- llamada (doble tap, reintento de red) nunca reinicia trial_activated_at
-- ni saca a alguien de 'premium'/'expired' de vuelta a 'trial'.
create or replace function public.activate_premium_trial()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set subscription_status = 'trial', trial_activated_at = now()
  where id = auth.uid() and subscription_status = 'free';
end;
$$;

revoke all on function public.activate_premium_trial() from public, anon;
grant execute on function public.activate_premium_trial() to authenticated;

-- EOF
