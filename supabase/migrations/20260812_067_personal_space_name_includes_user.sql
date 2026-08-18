-- Migration: El espacio Personal de Economía se llama "Personal (Nombre)"
-- Date: 2026-08-12
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- handle_new_user() (20260803_022_financial_spaces.sql) crea automáticamente
-- el financial_space personal de cada usuario con el nombre fijo "Personal",
-- igual para todo el mundo. En una casa compartida con varios miembros, el
-- SpaceSwitcher (src/modules/economy/SpaceSwitcher.jsx) termina mostrando
-- varias entradas indistinguibles llamadas "Personal" — una por miembro.
--
-- Esta migración:
--   1. Actualiza handle_new_user() para que los NUEVOS usuarios se creen ya
--      con el espacio personal llamado "Personal (<nombre>)", reutilizando
--      el mismo display_name que se calcula para la fila de profiles (no se
--      repite la lógica de coalesce/split_part).
--   2. Hace un backfill de los espacios personales EXISTENTES que todavía
--      tienen el nombre por defecto exacto "Personal" (para no pisar un
--      nombre que el usuario ya haya personalizado a mano).
--
-- No toca create_house() ni el espacio "Hogar": esta migración es solo para
-- el espacio personal.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'surname')), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, email)
  values (new.id, v_display_name, new.email)
  on conflict (id) do nothing;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('personal', 'private', 'Personal (' || v_display_name || ')', '👤', new.id, null, new.id)
  on conflict (owner_id) where type = 'personal' do nothing;

  return new;
end;
$$;

-- Backfill: espacios personales ya existentes que siguen con el nombre
-- genérico por defecto (no se toca ninguno que el usuario haya renombrado).
update public.financial_spaces s
set name = 'Personal (' || p.display_name || ')'
from public.profiles p
where s.type = 'personal'
  and s.owner_id = p.id
  and s.name = 'Personal';
