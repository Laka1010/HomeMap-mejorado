-- Migration: una cuenta suspendida deja de ver los datos financieros
-- (hallazgo M-4 de la auditoría)
-- Date: 2026-09-01
--
-- DECISIÓN
-- can_contribute_financial_space, can_manage_financial_space,
-- is_workspace_owner, is_house_member e is_house_admin terminan todas con
-- "and not public._is_account_blocked()". can_access_financial_space era la
-- única que no lo hacía: era simplemente
-- "get_workspace_role(p_space_id, auth.uid()) is not null".
--
-- Como esa función gobierna las políticas SELECT de economy_bills,
-- economy_expenses, economy_income, economy_goals, financial_accounts,
-- financial_space_members y financial_transfers, una cuenta suspendida o
-- baneada perdía el acceso a los datos de la casa pero SEGUÍA VIENDO todos los
-- datos financieros. En el contexto de las migraciones 052-059, dedicadas
-- precisamente a cerrar acciones a cuentas suspendidas, era un olvido.
--
-- Se resuelve por consistencia: suspender una cuenta ahora corta también la
-- lectura financiera. No se toca ninguna política RLS -- basta con cambiar la
-- función que todas ellas invocan.
--
-- EFECTO COLATERAL QUE HAY QUE CORREGIR A LA VEZ
-- _verify_cross_access_claim usa can_access_financial_space para decidir si un
-- evento authz_cross_* es cierto: "return not can_access_financial_space(...)".
-- Si el llamante está suspendido, can_access pasaría a devolver false y la
-- función daría por buena la denuncia de acceso cruzado sobre sus PROPIOS
-- recursos, generando eventos críticos falsos (y alertas de Telegram) cada vez
-- que una cuenta suspendida tocara la app.
--
-- Por eso _verify_cross_access_claim pasa a preguntar directamente por el rol
-- (get_workspace_role(...) is null), que es la pregunta que de verdad quiere
-- hacer: "¿este usuario tiene algún papel en este espacio?", con independencia
-- de si su cuenta está suspendida. Mismo resultado que antes para cuentas
-- activas; correcto ahora para las suspendidas.
--
-- REVERSIBLE: reaplicar can_access_financial_space de 20260803_024_workspace_roles.sql
-- y _verify_cross_access_claim de 20260808_049_security_events_cross_access.sql.

create or replace function public.can_access_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.get_workspace_role(p_space_id, auth.uid()) is not null
    and not public._is_account_blocked();
$fn$;

create or replace function public._verify_cross_access_claim(
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_caller_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_space_id uuid;
  v_space_type text;
begin
  if p_caller_id is null or p_resource_id is null or p_resource_type is null then
    return false;
  end if;

  if p_event_type = 'authz_cross_account_access' then
    if p_resource_type <> 'financial_account' then
      return false;
    end if;

    select financial_space_id into v_space_id
    from public.financial_accounts
    where id = p_resource_id;

    if v_space_id is null then
      return false;
    end if;

    -- M-4: se pregunta por el ROL, no por can_access_financial_space, para que
    -- una cuenta suspendida no genere denuncias falsas sobre sus propios
    -- recursos.
    return public.get_workspace_role(v_space_id, p_caller_id) is null;
  end if;

  if p_event_type = 'authz_cross_personal_economy_access' then
    if p_resource_type = 'user' then
      if p_resource_id = p_caller_id then
        return false;
      end if;
      select id into v_space_id
      from public.financial_spaces
      where owner_id = p_resource_id and type = 'personal'
      limit 1;
    elsif p_resource_type = 'financial_space' then
      select id into v_space_id
      from public.financial_spaces
      where id = p_resource_id and type = 'personal'
      limit 1;
    else
      return false;
    end if;

    if v_space_id is null then
      return false;
    end if;

    return public.get_workspace_role(v_space_id, p_caller_id) is null;
  end if;

  if p_event_type = 'authz_cross_workspace_access' then
    if p_resource_type = 'financial_space' then
      select type into v_space_type from public.financial_spaces where id = p_resource_id;
      if v_space_type is null or v_space_type not in ('shared', 'household') then
        return false;
      end if;
      return public.get_workspace_role(p_resource_id, p_caller_id) is null;
    elsif p_resource_type = 'house' then
      select id into v_space_id
      from public.financial_spaces
      where house_id = p_resource_id and type = 'household'
      limit 1;
      if v_space_id is null then
        return false;
      end if;
      return public.get_workspace_role(v_space_id, p_caller_id) is null;
    else
      return false;
    end if;
  end if;

  return false;
exception when others then
  return false;
end;
$fn$;

-- EOF
