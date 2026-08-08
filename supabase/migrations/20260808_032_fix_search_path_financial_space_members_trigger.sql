-- Migration: set search_path on financial_space_members_only_shared
-- Date: 2026-08-08
--
-- Supabase linter finding (function_search_path_mutable): this was the only
-- function in the schema without an explicit search_path, flagged as a
-- theoretical search_path-hijack vector. All references inside it are
-- already schema-qualified (public.financial_spaces), so risk was low, but
-- fixing for consistency with every other function in the codebase.

create or replace function public.financial_space_members_only_shared()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = new.space_id;
  if v_type is distinct from 'shared' then
    raise exception 'Solo los espacios compartidos tienen miembros';
  end if;
  return new;
end;
$$;

-- EOF
