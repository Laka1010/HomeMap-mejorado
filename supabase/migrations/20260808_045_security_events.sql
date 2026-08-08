-- Migration: Security Events (Fase 1) — registro server-side de eventos de
-- seguridad (autenticación, autorización). Fase 1 = solo registrar; NO hay
-- bloqueo automático, suspensión de cuentas ni bloqueo de IP todavía.
-- Date: 2026-08-08
--
-- ============================================================================
-- CONTEXTO (por qué está construido así)
-- ============================================================================
--
-- Haven no tiene backend propio: el cliente habla directamente con
-- PostgREST/GoTrue. Todo lo "server-side" que existe hoy son RLS + funciones
-- SECURITY DEFINER (ver 20260726_001_houses_members_roles.sql) — no existía
-- ningún sistema de auditoría/logs previo (house_activity es un feed social
-- de "actividad reciente" visible para toda la casa, no un log de seguridad;
-- no se reutiliza ni se duplica aquí, son cosas distintas).
--
-- auth.audit_log_entries (tabla interna de GoTrue) existe pero está vacía en
-- este proyecto pese a haber usuarios reales — no es una base fiable sobre la
-- que construir, así que no se usa.
--
-- Restricción de PostgREST importante para el diseño de abajo: una llamada
-- RPC = una transacción. Si una función SECURITY DEFINER hace
-- `raise exception`, Postgres deshace TODA la transacción, incluida
-- cualquier fila de log insertada antes en la misma llamada. Por eso este
-- sistema separa "hacer cumplir el permiso" (ya existe, no cambia: las
-- funciones de negocio siguen rechazando con raise exception exactamente
-- igual que hoy) de "registrar el intento" (una segunda llamada RPC,
-- log_security_event, que siempre hace commit). Decisión confirmada con el
-- usuario: ver conversación — alternativas exploradas (dblink autónomo,
-- convertir las RPCs en PROCEDURE con COMMIT intermedio) se descartaron por
-- riesgo operacional/de atomicidad para una Fase 1.
--
-- ============================================================================
-- 1. TABLA
-- ============================================================================

create table public.security_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  result text not null check (result in ('success', 'failure', 'denied')),
  ip_address inet,
  session_id text,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint security_events_event_type_check check (event_type in (
    -- Autenticación
    'auth_login_success',
    'auth_login_failure',
    'auth_logout',
    'auth_password_change',
    'auth_password_reset_requested',
    'auth_email_change',
    -- Autorización
    'authz_cross_account_access',
    'authz_cross_personal_economy_access',
    'authz_cross_workspace_access',
    'authz_unauthorized_write',
    'authz_unauthorized_financial_operation',
    'authz_rpc_rejected',
    'authz_permission_bypass_attempt',
    -- Seguridad general (reservado; sin detección automática en Fase 1)
    'security_suspicious_activity'
  )),

  -- Defensa en profundidad: aunque el contenido de metadata lo decide el
  -- código servidor (nunca texto libre del usuario), se acota tamaño y se
  -- bloquean claves que sonarían a dato financiero/personal, por si un
  -- futuro call site se equivoca.
  constraint security_events_metadata_shape check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 1000
    and not (metadata ?| array[
      'amount', 'importe', 'monto', 'price', 'precio', 'total',
      'name', 'nombre', 'description', 'descripcion', 'note', 'nota',
      'email', 'password', 'contrasena', 'contraseña', 'token',
      'iban', 'card', 'tarjeta'
    ])
  )
);

comment on table public.security_events is
  'Log de seguridad server-side (Fase 1: solo registro, sin bloqueo automático). Nunca contiene cantidades de dinero, nombres de productos ni contenido de notas — ver security_events_metadata_shape.';
comment on column public.security_events.ip_address is
  'Dato sensible: retención acotada vía public.purge_stale_security_event_ip_addresses(), no programada automáticamente en Fase 1 (ver notas de despliegue).';

create index security_events_user_id_created_at_idx on public.security_events(user_id, created_at desc);
create index security_events_event_type_created_at_idx on public.security_events(event_type, created_at desc);
create index security_events_created_at_idx on public.security_events(created_at);

-- ============================================================================
-- 2. RLS — ningún usuario normal puede leer, insertar, modificar ni borrar.
--    Sin políticas de ningún tipo = deny-by-default para authenticated/anon
--    aunque en el futuro alguien añadiera un grant por error. Solo
--    service_role (que ignora RLS por diseño de Supabase) o las funciones
--    SECURITY DEFINER de abajo (dueñas de la tabla, también bypass RLS)
--    pueden tocarla.
-- ============================================================================

alter table public.security_events enable row level security;

revoke all on public.security_events from public, anon, authenticated;

-- ============================================================================
-- 3. Helpers internos — no se conceden a authenticated/anon: solo son
--    llamables desde otras funciones SECURITY DEFINER del mismo dueño.
-- ============================================================================

-- IP real del cliente: en Supabase, PostgREST pasa por delante de un proxy,
-- así que inet_client_addr() devolvería la IP del pooler, no la del
-- navegador. La IP real llega en la cabecera x-forwarded-for, expuesta por
-- PostgREST como el GUC request.headers. Con envoltorio try/catch porque el
-- formato de cabeceras no está garantizado (llamadas fuera de PostgREST,
-- IPv6 con puerto, etc.) y un log nunca debe romper por esto.
create or replace function public._security_event_client_ip()
returns inet
language plpgsql
stable
as $$
declare
  v_raw text;
begin
  v_raw := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  if v_raw is null or trim(v_raw) = '' then
    return inet_client_addr();
  end if;
  return trim(split_part(v_raw, ',', 1))::inet;
exception when others then
  return null;
end;
$$;

revoke all on function public._security_event_client_ip() from public, anon, authenticated;

-- session_id del JWT actual (claim que Supabase incluye en los access
-- tokens). Null para llamadas sin sesión (anon) o si el claim no existe.
create or replace function public._security_event_session_id()
returns text
language plpgsql
stable
as $$
begin
  return current_setting('request.jwt.claims', true)::json ->> 'session_id';
exception when others then
  return null;
end;
$$;

revoke all on function public._security_event_session_id() from public, anon, authenticated;

-- ============================================================================
-- 4. log_security_event — único punto de escritura, llamable por el cliente
--    (authenticated y anon: login fallido y solicitud de recuperación de
--    contraseña ocurren sin sesión todavía).
--
--    Lo que el cliente NO controla, para que el registro sea fiable pese a
--    ser una llamada iniciada por el cliente:
--      - user_id: siempre auth.uid() cuando hay sesión, nunca un valor que
--        el cliente pase. Sin sesión, solo se resuelve vía email para
--        auth_login_failure/auth_password_reset_requested (ver abajo), y
--        nunca se guarda el email en sí — solo el user_id que resolvió (o
--        null si no existe esa cuenta, sin distinguirlo en la respuesta,
--        igual que ya hace resetPasswordForEmail en el cliente para no
--        revelar qué emails están registrados).
--      - severity / result: derivados del event_type con un CASE fijo, no
--        aceptados como parámetro — así un cliente no puede reportar un
--        intento real como severidad "info".
--      - ip_address / session_id: siempre del propio request, nunca del
--        cliente.
--
--    Lo que SÍ queda del lado del cliente (limitación conocida de este
--    modelo BaaS, documentada en el informe de la Fase 1): que la llamada se
--    haga o no. Un cliente modificado podría no reportar un intento de
--    login fallido o un rechazo de RPC. Esto no debilita la autorización en
--    sí (las RPCs de negocio siguen bloqueando la operación igual que hoy,
--    con o sin este log) — solo podría dejar un hueco en la observabilidad.
-- ============================================================================

create or replace function public.log_security_event(
  p_event_type text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severity text;
  v_result text;
  v_user_id uuid;
begin
  case p_event_type
    when 'auth_login_success' then v_severity := 'info'; v_result := 'success';
    when 'auth_login_failure' then v_severity := 'warning'; v_result := 'failure';
    when 'auth_logout' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_change' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_reset_requested' then v_severity := 'info'; v_result := 'success';
    when 'auth_email_change' then v_severity := 'warning'; v_result := 'success';
    when 'authz_cross_account_access' then v_severity := 'critical'; v_result := 'denied';
    when 'authz_cross_personal_economy_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_cross_workspace_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_unauthorized_write' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_unauthorized_financial_operation' then v_severity := 'critical'; v_result := 'denied';
    when 'authz_rpc_rejected' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_permission_bypass_attempt' then v_severity := 'critical'; v_result := 'denied';
    when 'security_suspicious_activity' then v_severity := 'critical'; v_result := 'denied';
    else
      raise exception 'Tipo de evento de seguridad no válido: %', p_event_type;
  end case;

  v_user_id := auth.uid();

  if v_user_id is null and p_email is not null
     and p_event_type in ('auth_login_failure', 'auth_password_reset_requested') then
    select id into v_user_id from public.profiles where lower(email) = lower(trim(p_email));
  end if;

  insert into public.security_events (
    user_id, event_type, severity, result, ip_address, session_id,
    resource_type, resource_id, metadata
  ) values (
    v_user_id, p_event_type, v_severity, v_result,
    public._security_event_client_ip(), public._security_event_session_id(),
    p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_security_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_security_event(text, text, uuid, jsonb, text) to authenticated, anon;

-- ============================================================================
-- 5. Retención de IP. La IP es un dato sensible: se anonimiza (se pone a
--    null) pasado el periodo de retención, el resto del evento se conserva
--    para analítica de seguridad de más largo plazo. No se programa
--    automáticamente en esta migración (programar un cron es una decisión
--    operativa explícita, no algo que este sistema deba activar solo) — ver
--    informe de la Fase 1 para cómo programarlo (pg_cron o el scheduler del
--    proyecto).
-- ============================================================================

create or replace function public.purge_stale_security_event_ip_addresses(p_retention_days int default 90)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.security_events
    set ip_address = null
    where ip_address is not null
      and created_at < now() - (p_retention_days || ' days')::interval
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.purge_stale_security_event_ip_addresses(int) from public, anon, authenticated;

-- ============================================================================
-- 6. Etiquetar como 42501 (insufficient_privilege) los `raise exception` que
--    son de autorización (no de validación ni "no encontrado") en las RPCs
--    SECURITY DEFINER existentes que cubren las categorías pedidas
--    (escritura sin permiso, operación financiera sin permiso, RPC sensible
--    rechazada, intento de saltarse permisos). Es el único cambio a estas
--    funciones: mismo mensaje, misma lógica, mismo comportamiento — solo se
--    añade el código de error para que el cliente pueda distinguir de forma
--    fiable "me rechazaron por permisos" de "dato no encontrado" o "campo
--    inválido" sin tener que analizar el texto del mensaje. Definiciones
--    tomadas literalmente de la base de datos en vivo (pg_get_functiondef)
--    para no divergir de la versión actualmente desplegada.
-- ============================================================================

create or replace function public.set_member_role(p_house_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede cambiar roles' using errcode = '42501';
  end if;

  if p_role not in ('adult', 'child') then
    raise exception 'Rol no válido: %', p_role;
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
  end if;

  update public.home_members
  set role = p_role
  where house_id = p_house_id and user_id = p_user_id and role <> 'admin';

  if not found then
    raise exception 'Miembro no encontrado o no se puede modificar el rol del administrador';
  end if;
end;
$$;

create or replace function public.remove_member(p_house_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() and not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede eliminar a otros miembros' using errcode = '42501';
  end if;

  delete from public.home_members
  where house_id = p_house_id and user_id = p_user_id and role <> 'admin';

  if not found then
    raise exception 'No se pudo eliminar (miembro no encontrado o es el administrador)';
  end if;
end;
$$;

create or replace function public.transfer_house_ownership(p_house_id uuid, p_new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el propietario puede transferir la propiedad' using errcode = '42501';
  end if;

  if p_new_owner_user_id = auth.uid() then
    raise exception 'Ya eres el propietario de esta casa';
  end if;

  if not exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'El nuevo propietario debe ser miembro de esta casa';
  end if;

  update public.home_members
  set role = 'admin'
  where house_id = p_house_id and user_id = p_new_owner_user_id;

  update public.home_members
  set role = 'adult'
  where house_id = p_house_id and user_id = auth.uid();
end;
$$;

create or replace function public.delete_house(p_house_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede eliminarla' using errcode = '42501';
  end if;

  delete from public.houses where id = p_house_id;
  if not found then
    raise exception 'Casa no encontrada';
  end if;
end;
$$;

create or replace function public.rename_house(p_house_id uuid, p_name text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede cambiar el nombre' using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  update public.houses
  set name = trim(p_name)
  where id = p_house_id
  returning * into v_house;

  if not found then
    raise exception 'Casa no encontrada';
  end if;

  return v_house;
end;
$$;

create or replace function public.set_house_currency(p_house_id uuid, p_currency_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede cambiar la moneda' using errcode = '42501';
  end if;

  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Código de moneda inválido: %', p_currency_code;
  end if;

  update public.houses
  set currency_code = p_currency_code
  where id = p_house_id
  returning * into v_house;

  if not found then
    raise exception 'Casa no encontrada';
  end if;

  return v_house;
end;
$$;

create or replace function public.pay_bill_from_account(p_bill_id uuid, p_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.economy_bills;
  v_account public.financial_accounts;
begin
  select * into v_bill from public.economy_bills where id = p_bill_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  if not public.can_contribute_financial_space(v_bill.financial_space_id) then
    raise exception 'No tienes permiso para pagar facturas de este espacio' using errcode = '42501';
  end if;

  select * into v_account from public.financial_accounts where id = p_account_id;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  if v_account.financial_space_id <> v_bill.financial_space_id then
    raise exception 'La cuenta debe pertenecer al mismo espacio que la factura';
  end if;

  insert into public.economy_expenses (financial_space_id, account_id, created_by, performed_by, name, amount, category, date, description)
  values (v_bill.financial_space_id, p_account_id, auth.uid(), auth.uid(), v_bill.name, v_bill.amount, v_bill.category, current_date, 'Factura: ' || v_bill.name);

  update public.economy_bills
  set status = 'paid', paid_date = current_date, paid_from_account_id = p_account_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

create or replace function public.transfer_between_accounts(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_space uuid;
  v_to_space uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  select financial_space_id into v_to_space from public.financial_accounts where id = p_to_account_id;

  if v_from_space is null or v_to_space is null then
    raise exception 'Cuenta no encontrada';
  end if;
  if not public.can_contribute_financial_space(v_from_space) then
    raise exception 'No tienes permiso para mover dinero desde esta cuenta' using errcode = '42501';
  end if;
  if not public.can_contribute_financial_space(v_to_space) then
    raise exception 'No tienes permiso para mover dinero a esta cuenta' using errcode = '42501';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, p_to_account_id, p_amount, p_note,
    case when v_from_space = v_to_space then 'transfer' else 'contribution' end
  );
end;
$$;

create or replace function public.contribute_to_financial_space(
  p_from_account_id uuid,
  p_to_space_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_space uuid;
  v_to_account_id uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  if v_from_space is null then
    raise exception 'Cuenta de origen no encontrada';
  end if;
  if not public.can_contribute_financial_space(v_from_space) then
    raise exception 'No tienes permiso para mover dinero desde esta cuenta' using errcode = '42501';
  end if;
  if not public.can_contribute_financial_space(p_to_space_id) then
    raise exception 'No tienes permiso para contribuir a este espacio' using errcode = '42501';
  end if;

  select id into v_to_account_id
  from public.financial_accounts
  where financial_space_id = p_to_space_id and is_default = true;

  if v_to_account_id is null then
    raise exception 'El espacio de destino no tiene una cuenta por defecto';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, v_to_account_id, p_amount, p_note,
    case when v_from_space = p_to_space_id then 'transfer' else 'contribution' end
  );
end;
$$;

create or replace function public.rename_financial_space(p_space_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre no puede estar vacío';
  end if;
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede renombrar este espacio' using errcode = '42501';
  end if;

  update public.financial_spaces set name = trim(p_name) where id = p_space_id;
end;
$$;

create or replace function public.archive_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_type <> 'shared' then
    raise exception 'Solo los espacios compartidos se pueden archivar (Personal y Household son permanentes)';
  end if;
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede archivar este espacio' using errcode = '42501';
  end if;

  update public.financial_spaces set archived_at = now() where id = p_space_id;
end;
$$;

create or replace function public.add_financial_space_member(p_space_id uuid, p_user_id uuid, p_role text default 'contributor')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  if p_role not in ('viewer', 'contributor', 'manager', 'owner') then
    raise exception 'Rol no válido';
  end if;

  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo se pueden añadir miembros a espacios compartidos';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo un manager o el propietario puede invitar miembros' using errcode = '42501';
  end if;
  if p_role in ('manager', 'owner') and not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede asignar el rol de manager o owner' using errcode = '42501';
  end if;

  if v_space.house_id is not null then
    if not exists (
      select 1 from public.home_members where house_id = v_space.house_id and user_id = p_user_id
    ) then
      raise exception 'Solo se puede invitar a miembros de la misma casa';
    end if;
    if not public.user_can_manage_economy(v_space.house_id, p_user_id) then
      raise exception 'Este miembro no tiene acceso a Economía en esta casa' using errcode = '42501';
    end if;
  end if;

  insert into public.financial_space_members (space_id, user_id, added_by, role)
  values (p_space_id, p_user_id, auth.uid(), p_role)
  on conflict (space_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.remove_financial_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
  v_target_role text;
begin
  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo los espacios compartidos tienen miembros gestionables';
  end if;
  if p_user_id = v_space.owner_id then
    raise exception 'No se puede eliminar al propietario del espacio';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo un manager o el propietario puede eliminar miembros' using errcode = '42501';
  end if;

  select role into v_target_role from public.financial_space_members where space_id = p_space_id and user_id = p_user_id;
  if v_target_role in ('manager', 'owner') and not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede eliminar a un manager' using errcode = '42501';
  end if;

  delete from public.financial_space_members where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'Miembro no encontrado en el espacio';
  end if;
end;
$$;

create or replace function public.set_member_economy_access(p_house_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role is not null and p_role not in ('none', 'viewer', 'contributor', 'manager', 'owner') then
    raise exception 'Rol no válido';
  end if;

  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede cambiar el acceso a Economía' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio acceso a Economía' using errcode = '42501';
  end if;

  update public.home_members
  set economy_role = p_role
  where house_id = p_house_id and user_id = p_user_id;

  if not found then
    raise exception 'Miembro no encontrado';
  end if;
end;
$$;

create or replace function public.delete_shared_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_type <> 'shared' then
    raise exception 'Solo los espacios compartidos se pueden eliminar (Personal y Hogar son permanentes)';
  end if;
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario del espacio puede eliminarlo' using errcode = '42501';
  end if;

  delete from public.financial_spaces where id = p_space_id;
end;
$$;

-- Estas funciones no cambiaron de firma; CREATE OR REPLACE conserva los
-- grants existentes (revoke de public/anon de 20260808_033, grant a
-- authenticated de sus migraciones originales), así que no hace falta
-- repetirlos aquí.

-- EOF
