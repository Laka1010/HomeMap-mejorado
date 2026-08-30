-- Migration: guardar la última casa visitada en el perfil (cross-device)
-- Date: 2026-08-30
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- La última casa visitada se guardaba solo en localStorage
-- (20260830: feat(casas) ...), así que no seguía al usuario entre
-- dispositivos. Se añade una columna en public.profiles para persistirla
-- server-side.
--
-- public.profiles solo tiene políticas de SELECT (self + housemates); no hay
-- UPDATE para el usuario. Para no abrir un UPDATE genérico sobre la tabla se
-- expone una RPC mínima set_last_home(p_home_id) que solo toca esa columna,
-- solo la fila de auth.uid(), y solo si el usuario pertenece a esa casa
-- (si no, se ignora en silencio -- no es un error que deba romper la app).
--
-- La lectura la hace el cliente directamente vía la policy profiles_select_self
-- ya existente (select last_home_id where id = auth.uid()).
--
-- ============================================================================

alter table public.profiles
  add column if not exists last_home_id uuid references public.houses(id) on delete set null;

comment on column public.profiles.last_home_id is
  'Última casa que el usuario abrió; el cliente entra directamente en ella al arrancar. Se pone a null sola si la casa se borra (FK on delete set null).';

create or replace function public.set_last_home(p_home_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_home_id is not null and not exists (
    select 1 from public.home_members
    where user_id = auth.uid() and house_id = p_home_id
  ) then
    -- No perteneces (ya) a esa casa: no se guarda, pero tampoco se falla.
    return;
  end if;

  update public.profiles
  set last_home_id = p_home_id
  where id = auth.uid();
end;
$$;

revoke all on function public.set_last_home(uuid) from public, anon;
grant execute on function public.set_last_home(uuid) to authenticated;

-- EOF
