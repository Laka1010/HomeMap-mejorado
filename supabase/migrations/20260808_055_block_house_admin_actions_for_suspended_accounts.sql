-- Migration: cerrar H-2 del análisis de la Fase 7 — administración de casa
-- (rename_house, set_member_role, remove_member, transfer_house_ownership,
-- set_house_currency, delete_house, set_member_economy_access) seguía
-- disponible para el House Owner de una cuenta suspended/banned.
-- Date: 2026-08-08
--
-- Mismo patrón que H-1/M-2 (20260808_054): is_house_admin(p_house_id) es el
-- único punto que las 7 RPCs de administración de casa consultan -- nunca
-- se usa dentro de ninguna política RLS (confirmado por grep sobre el
-- historial completo de migraciones antes de tocar nada). Añadir la
-- comprobación aquí las cubre a las 7 sin modificar ninguna de ellas, sin
-- tocar RLS y sin tocar triggers.
--
-- Sin problema de NULL/three-valued logic: exists(...) nunca devuelve NULL,
-- _is_account_blocked() tampoco (usa exists() igual). El AND añadido no
-- introduce ningún camino NULL nuevo.
--
-- Alcance: exactamente esta función. Ninguna RLS, tabla, trigger, RPC ni el
-- comportamiento de 'restricted' se modifican.

create or replace function public.is_house_admin(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid() and role = 'admin'
  ) and not public._is_account_blocked();
$$;

-- EOF
