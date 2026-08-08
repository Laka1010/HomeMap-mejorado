-- Migration: Security Center (Fase 3) — panel de administración y gestión
-- manual de seguridad
-- Date: 2026-08-08
--
-- ============================================================================
-- CONTEXTO Y DECISIONES DE DISEÑO
-- ============================================================================
--
-- 1. Security Admin es un rol NUEVO, INDEPENDIENTE de home_members.role.
--    Ser 'admin' de una casa no concede nada aquí -- is_security_admin()
--    solo mira la tabla security_admins, que no tiene ninguna relación con
--    houses/home_members. No existe todavía ningún Security Admin: el
--    primero se inserta abajo, en esta misma migración, directamente por
--    SQL (no hay ninguna RPC de auto-concesión -- eso violaría el propio
--    requisito "un usuario no puede cambiar su propio rol a Security
--    Admin"). Cuenta elegida por el usuario del proyecto: lucas.mesas.17@
--    gmail.com.
--
-- 2. Suspend/Ban comparten el mismo mecanismo técnico (auth.users.
--    banned_until + borrado de auth.sessions), y difieren en severidad/
--    etiqueta semántica, no en aplicación. Restrict/Unrestrict es un flag
--    de estado sin aplicación automática todavía (no se ha tocado RLS de
--    ninguna otra tabla para comprobar el estado de la cuenta -- eso sería
--    un cambio mucho más amplio, no pedido explícitamente en esta fase, y
--    aumentaría muchísimo la superficie de riesgo). Documentado también en
--    el informe final.
--
-- 3. Límite real de banned_until/revocación de sesión, IMPORTANTE: borrar
--    la fila de auth.sessions invalida el refresh token (no se pueden
--    obtener tokens nuevos) y banned_until bloquea logins/refreshes
--    nuevos, pero un access token (JWT) ya emitido y aún no caducado
--    SIGUE siendo válido para llamadas a PostgREST hasta que expire por sí
--    mismo (por defecto ~1h en Supabase) -- PostgREST valida la firma/
--    caducidad del JWT, no vuelve a consultar auth.users en cada petición.
--    Es una característica estándar de los sistemas JWT sin estado, no un
--    fallo de esta implementación; cerrarla del todo requeriría una lista
--    de revocación comprobada en cada request (infraestructura adicional,
--    fuera de alcance aquí). Documentado, no oculto.
--
-- 4. IP blocks: se registran para investigación/auditoría y como base para
--    una futura capa de aplicación real. En esta fase NO se conecta a
--    ningún punto que rechace peticiones por IP (eso exigiría un proxy/
--    Edge Function delante de cada RPC, o una función de Supabase de pago
--    a nivel de red -- infraestructura nueva no pedida). "Bloquear una IP"
--    hoy es un registro accionable para el Security Admin, no un
--    cortafuegos automático.
--
-- 5. Dashboard "HIGH" vs "CRITICAL": la tabla security_events sigue
--    teniendo 3 niveles (info/warning/critical, sin cambios respecto a
--    Fase 1/2 -- tocar el enum ahora forzaría reclasificar cada event_type
--    ya probado, con riesgo de regresión, solo por una etiqueta del
--    dashboard). "HIGH" en el dashboard = severity 'warning' en la base de
--    datos; "CRITICAL" = severity 'critical'. Decisión explícita, no un
--    error.
--
-- 6. Los eventos admin_* (suspender/banear/bloquear IP...) son insertados
--    DIRECTAMENTE por las RPCs de acción, nunca a través de
--    log_security_event -- igual que security_suspicious_activity en Fase
--    2, no están en su CASE, así que un cliente no puede solicitarlos por
--    su cuenta.
--
-- ============================================================================
-- 1. TABLAS
-- ============================================================================

create table public.security_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_view_ip boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.security_admins enable row level security;
revoke all on public.security_admins from public, anon, authenticated;

create table public.account_security_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'restricted', 'suspended', 'banned')),
  status_reason text,
  status_set_by uuid references auth.users(id) on delete set null,
  status_set_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_security_state enable row level security;
revoke all on public.account_security_state from public, anon, authenticated;

create table public.security_ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip inet not null,
  reason text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unblocked_at timestamptz,
  unblocked_by uuid references auth.users(id) on delete set null
);

create index security_ip_blocks_ip_idx on public.security_ip_blocks(ip);

alter table public.security_ip_blocks enable row level security;
revoke all on public.security_ip_blocks from public, anon, authenticated;

-- Auditoría del propio Security Center. Sin política de UPDATE/DELETE, y
-- sobre todo SIN GRANT de update/delete a nadie -- ni siquiera a un
-- Security Admin. La única forma de que exista una fila es el INSERT que
-- hacen las RPCs de acción (SECURITY DEFINER, dueñas de la tabla). Un
-- admin no puede borrar su propio rastro porque no existe ningún camino
-- -- ni RPC ni acceso directo-- que permita DELETE/UPDATE sobre esta tabla.
create table public.security_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_ip inet,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_admin_audit_log_created_at_idx on public.security_admin_audit_log(created_at desc);
create index security_admin_audit_log_target_user_idx on public.security_admin_audit_log(target_user_id, created_at desc);

alter table public.security_admin_audit_log enable row level security;
revoke all on public.security_admin_audit_log from public, anon, authenticated;

-- ============================================================================
-- 2. Ampliar el catálogo de event_type de security_events con los eventos
--    que generan las acciones de administración. Se insertan directamente
--    desde las RPCs de este fichero, nunca vía log_security_event (no
--    están en su CASE -- un cliente que intente pedirlos cae en "tipo no
--    válido", igual que security_suspicious_activity en Fase 2).
-- ============================================================================

alter table public.security_events drop constraint security_events_event_type_check;
alter table public.security_events add constraint security_events_event_type_check check (event_type in (
  'auth_login_success', 'auth_login_failure', 'auth_logout', 'auth_password_change',
  'auth_password_reset_requested', 'auth_email_change',
  'authz_cross_account_access', 'authz_cross_personal_economy_access', 'authz_cross_workspace_access',
  'authz_unauthorized_write', 'authz_unauthorized_financial_operation', 'authz_rpc_rejected',
  'authz_permission_bypass_attempt', 'security_suspicious_activity',
  'admin_account_suspended', 'admin_account_unsuspended',
  'admin_account_restricted', 'admin_account_unrestricted',
  'admin_account_banned', 'admin_account_unbanned',
  'admin_session_revoked', 'admin_all_sessions_revoked',
  'admin_ip_blocked', 'admin_ip_unblocked'
));

-- ============================================================================
-- 3. is_security_admin() / am_i_security_admin()
-- ============================================================================

-- Helper interno: NO concedida a authenticated/anon. Todas las RPCs de
-- administración la llaman como primera línea y lanzan 42501 si es false.
create or replace function public.is_security_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.security_admins where user_id = auth.uid());
$$;

revoke all on function public.is_security_admin() from public, anon, authenticated;

-- Única función de este bloque pensada para el cliente normal: comprobar
-- el PROPIO estado de admin (para decidir si mostrar la entrada al
-- Security Center) no filtra nada sobre nadie más.
create or replace function public.am_i_security_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_security_admin();
$$;

revoke all on function public.am_i_security_admin() from public;
grant execute on function public.am_i_security_admin() to authenticated;

-- ============================================================================
-- 4. Helper de auditoría interno (usado por todas las RPCs de acción)
-- ============================================================================

create or replace function public._security_admin_audit(
  p_action text,
  p_target_user_id uuid default null,
  p_target_ip inet default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.security_admin_audit_log (admin_id, action, target_user_id, target_ip, reason, metadata)
  values (auth.uid(), p_action, p_target_user_id, p_target_ip, p_reason, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public._security_admin_audit(text, uuid, inet, text, jsonb) from public, anon, authenticated;

-- ============================================================================
-- 5. Gestión de admins (capacidad de backend; sin UI en esta fase, ver
--    informe). No auto-concedible: exige ser ya Security Admin para
--    conceder a otro.
-- ============================================================================

create or replace function public.security_admin_grant_admin(p_user_id uuid, p_can_view_ip boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes concederte el rol a ti mismo';
  end if;

  insert into public.security_admins (user_id, can_view_ip, granted_by)
  values (p_user_id, p_can_view_ip, auth.uid())
  on conflict (user_id) do update set can_view_ip = excluded.can_view_ip;

  perform public._security_admin_audit('GRANT_SECURITY_ADMIN', p_user_id, null, null, jsonb_build_object('can_view_ip', p_can_view_ip));
end;
$$;

revoke all on function public.security_admin_grant_admin(uuid, boolean) from public, anon;
grant execute on function public.security_admin_grant_admin(uuid, boolean) to authenticated;

create or replace function public.security_admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes revocarte el rol a ti mismo';
  end if;

  delete from public.security_admins where user_id = p_user_id;

  perform public._security_admin_audit('REVOKE_SECURITY_ADMIN', p_user_id);
end;
$$;

revoke all on function public.security_admin_revoke_admin(uuid) from public, anon;
grant execute on function public.security_admin_revoke_admin(uuid) to authenticated;

-- ============================================================================
-- 6. Dashboard
-- ============================================================================

create or replace function public.security_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'events_24h_total', (select count(*) from public.security_events where created_at >= now() - interval '24 hours'),
    'events_24h_failed_logins', (select count(*) from public.security_events where created_at >= now() - interval '24 hours' and event_type = 'auth_login_failure'),
    'events_24h_blocked_authz', (select count(*) from public.security_events where created_at >= now() - interval '24 hours' and event_type like 'authz_%' and result = 'denied'),
    'events_24h_suspicious', (select count(*) from public.security_events where created_at >= now() - interval '24 hours' and event_type = 'security_suspicious_activity'),
    'events_24h_high', (select count(*) from public.security_events where created_at >= now() - interval '24 hours' and severity = 'warning'),
    'events_24h_critical', (select count(*) from public.security_events where created_at >= now() - interval '24 hours' and severity = 'critical'),
    'accounts_active', (select count(*) from auth.users u where coalesce((select status from public.account_security_state s where s.user_id = u.id), 'active') = 'active' and u.deleted_at is null),
    'accounts_restricted', (select count(*) from public.account_security_state where status = 'restricted'),
    'accounts_suspended', (select count(*) from public.account_security_state where status = 'suspended'),
    'accounts_banned', (select count(*) from public.account_security_state where status = 'banned'),
    'sessions_active', (select count(*) from auth.sessions),
    'sessions_recently_revoked', (select count(*) from public.security_admin_audit_log where action in ('REVOKE_SESSION', 'REVOKE_ALL_SESSIONS') and created_at >= now() - interval '24 hours'),
    'ip_blocks_active', (select count(*) from public.security_ip_blocks where unblocked_at is null and (expires_at is null or expires_at > now()))
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.security_admin_dashboard_stats() from public, anon;
grant execute on function public.security_admin_dashboard_stats() to authenticated;

-- ============================================================================
-- 7. Eventos: listado (filtros + minimización server-side de IP) y detalle
-- ============================================================================

create or replace function public.security_admin_list_events(
  p_severity text default null,
  p_event_type text default null,
  p_result text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_user_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  event_id uuid,
  user_id uuid,
  user_display text,
  event_type text,
  severity text,
  result text,
  resource_type text,
  resource_id uuid,
  ip_address inet,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_view_ip boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select sa.can_view_ip into v_can_view_ip from public.security_admins sa where sa.user_id = auth.uid();

  return query
  select
    e.event_id, e.user_id,
    coalesce(p.display_name, p.email, e.user_id::text) as user_display,
    e.event_type, e.severity, e.result, e.resource_type, e.resource_id,
    case when v_can_view_ip then e.ip_address else null end as ip_address,
    e.created_at,
    count(*) over() as total_count
  from public.security_events e
  left join public.profiles p on p.id = e.user_id
  where (p_severity is null or e.severity = p_severity)
    and (p_event_type is null or e.event_type = p_event_type)
    and (p_result is null or e.result = p_result)
    and (p_date_from is null or e.created_at >= p_date_from)
    and (p_date_to is null or e.created_at <= p_date_to)
    and (p_user_id is null or e.user_id = p_user_id)
  order by e.created_at desc
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.security_admin_list_events(text, text, text, timestamptz, timestamptz, uuid, integer, integer) from public, anon;
grant execute on function public.security_admin_list_events(text, text, text, timestamptz, timestamptz, uuid, integer, integer) to authenticated;

create or replace function public.security_admin_get_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_view_ip boolean;
  v_result jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select sa.can_view_ip into v_can_view_ip from public.security_admins sa where sa.user_id = auth.uid();

  select jsonb_build_object(
    'event_id', e.event_id,
    'user_id', e.user_id,
    'user_display', coalesce(p.display_name, p.email, e.user_id::text),
    'event_type', e.event_type,
    'severity', e.severity,
    'result', e.result,
    'resource_type', e.resource_type,
    'resource_id', e.resource_id,
    'ip_address', case when v_can_view_ip then e.ip_address else null end,
    'session_id', e.session_id,
    'metadata', e.metadata,
    'created_at', e.created_at
  ) into v_result
  from public.security_events e
  left join public.profiles p on p.id = e.user_id
  where e.event_id = p_event_id;

  return v_result;
end;
$$;

revoke all on function public.security_admin_get_event(uuid) from public, anon;
grant execute on function public.security_admin_get_event(uuid) to authenticated;

-- ============================================================================
-- 8. Usuarios: búsqueda y detalle (sin ningún dato económico)
-- ============================================================================

create or replace function public.security_admin_search_users(p_query text)
returns table (
  user_id uuid,
  display_name text,
  email text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  recent_events_count bigint,
  high_critical_count bigint,
  active_sessions_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  if p_query is null or length(trim(p_query)) < 2 then
    raise exception 'Introduce al menos 2 caracteres para buscar';
  end if;

  return query
  select
    u.id, p.display_name, p.email,
    coalesce(s.status, 'active') as status,
    u.created_at, u.last_sign_in_at,
    (select count(*) from public.security_events e where e.user_id = u.id and e.created_at >= now() - interval '30 days') as recent_events_count,
    (select count(*) from public.security_events e where e.user_id = u.id and e.severity in ('warning', 'critical') and e.created_at >= now() - interval '30 days') as high_critical_count,
    (select count(*) from auth.sessions ses where ses.user_id = u.id) as active_sessions_count
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.account_security_state s on s.user_id = u.id
  where u.deleted_at is null
    and (p.email ilike '%' || trim(p_query) || '%' or p.display_name ilike '%' || trim(p_query) || '%')
  order by p.display_name nulls last
  limit 25;
end;
$$;

revoke all on function public.security_admin_search_users(text) from public, anon;
grant execute on function public.security_admin_search_users(text) to authenticated;

create or replace function public.security_admin_get_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_view_ip boolean;
  v_result jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select sa.can_view_ip into v_can_view_ip from public.security_admins sa where sa.user_id = auth.uid();

  select jsonb_build_object(
    'user_id', u.id,
    'display_name', p.display_name,
    'email', p.email,
    'status', coalesce(s.status, 'active'),
    'status_reason', s.status_reason,
    'status_set_at', s.status_set_at,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'banned_until', u.banned_until,
    'events_24h', (select count(*) from public.security_events e where e.user_id = u.id and e.created_at >= now() - interval '24 hours'),
    'events_7d_high_critical', (select count(*) from public.security_events e where e.user_id = u.id and e.severity in ('warning', 'critical') and e.created_at >= now() - interval '7 days'),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'session_id', ses.id,
        'created_at', ses.created_at,
        'last_activity', coalesce(ses.refreshed_at, ses.updated_at, ses.created_at),
        'user_agent', ses.user_agent,
        'ip_address', case when v_can_view_ip then ses.ip else null end
      ) order by ses.created_at desc), '[]'::jsonb)
      from auth.sessions ses where ses.user_id = u.id
    )
  ) into v_result
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.account_security_state s on s.user_id = u.id
  where u.id = p_user_id and u.deleted_at is null;

  if v_result is null then
    raise exception 'Usuario no encontrado';
  end if;

  return v_result;
end;
$$;

revoke all on function public.security_admin_get_user_detail(uuid) from public, anon;
grant execute on function public.security_admin_get_user_detail(uuid) to authenticated;

-- ============================================================================
-- 9. Acciones sobre cuentas
-- ============================================================================

create or replace function public._security_admin_set_status(
  p_user_id uuid,
  p_new_status text,
  p_expected_current text,
  p_reason text,
  p_reason_required boolean,
  p_set_banned_until boolean,
  p_revoke_sessions boolean,
  p_event_type text,
  p_audit_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id and deleted_at is null) then
    raise exception 'Usuario no encontrado';
  end if;

  if p_reason_required and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'Esta acción exige indicar un motivo';
  end if;

  select coalesce(status, 'active') into v_current from public.account_security_state where user_id = p_user_id;
  v_current := coalesce(v_current, 'active');

  if p_expected_current is not null and v_current <> p_expected_current then
    raise exception 'La cuenta no está en el estado esperado (actual: %)', v_current;
  end if;

  insert into public.account_security_state (user_id, status, status_reason, status_set_by, status_set_at, updated_at)
  values (p_user_id, p_new_status, p_reason, auth.uid(), now(), now())
  on conflict (user_id) do update set
    status = excluded.status,
    status_reason = excluded.status_reason,
    status_set_by = excluded.status_set_by,
    status_set_at = excluded.status_set_at,
    updated_at = excluded.updated_at;

  if p_set_banned_until then
    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  elsif p_set_banned_until is false and p_new_status = 'active' then
    update auth.users set banned_until = null where id = p_user_id;
  end if;

  if p_revoke_sessions then
    delete from auth.sessions where user_id = p_user_id;
  end if;

  insert into public.security_events (user_id, event_type, severity, result, resource_type, resource_id, metadata)
  values (
    p_user_id, p_event_type,
    case p_event_type
      when 'admin_account_suspended' then 'critical'
      when 'admin_account_banned' then 'critical'
      when 'admin_account_restricted' then 'warning'
      else 'info'
    end,
    'success', 'account', p_user_id,
    jsonb_build_object('admin_id', auth.uid())
  );

  perform public._security_admin_audit(p_audit_action, p_user_id, null, p_reason);
end;
$$;

revoke all on function public._security_admin_set_status(uuid, text, text, text, boolean, boolean, boolean, text, text) from public, anon, authenticated;

create or replace function public.security_admin_suspend_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'No puedes aplicar esta acción sobre tu propia cuenta';
  end if;
  perform public._security_admin_set_status(p_user_id, 'suspended', null, p_reason, true, true, true, 'admin_account_suspended', 'SUSPEND_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_suspend_account(uuid, text) from public, anon;
grant execute on function public.security_admin_suspend_account(uuid, text) to authenticated;

create or replace function public.security_admin_unsuspend_account(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._security_admin_set_status(p_user_id, 'active', 'suspended', p_reason, false, false, false, 'admin_account_unsuspended', 'UNSUSPEND_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_unsuspend_account(uuid, text) from public, anon;
grant execute on function public.security_admin_unsuspend_account(uuid, text) to authenticated;

create or replace function public.security_admin_restrict_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'No puedes aplicar esta acción sobre tu propia cuenta';
  end if;
  perform public._security_admin_set_status(p_user_id, 'restricted', null, p_reason, true, false, false, 'admin_account_restricted', 'RESTRICT_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_restrict_account(uuid, text) from public, anon;
grant execute on function public.security_admin_restrict_account(uuid, text) to authenticated;

create or replace function public.security_admin_unrestrict_account(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._security_admin_set_status(p_user_id, 'active', 'restricted', p_reason, false, false, false, 'admin_account_unrestricted', 'UNRESTRICT_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_unrestrict_account(uuid, text) from public, anon;
grant execute on function public.security_admin_unrestrict_account(uuid, text) to authenticated;

create or replace function public.security_admin_ban_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'No puedes aplicar esta acción sobre tu propia cuenta';
  end if;
  perform public._security_admin_set_status(p_user_id, 'banned', null, p_reason, true, true, true, 'admin_account_banned', 'BAN_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_ban_account(uuid, text) from public, anon;
grant execute on function public.security_admin_ban_account(uuid, text) to authenticated;

create or replace function public.security_admin_unban_account(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._security_admin_set_status(p_user_id, 'active', 'banned', p_reason, false, false, false, 'admin_account_unbanned', 'UNBAN_ACCOUNT');
end;
$$;

revoke all on function public.security_admin_unban_account(uuid, text) from public, anon;
grant execute on function public.security_admin_unban_account(uuid, text) to authenticated;

-- ============================================================================
-- 10. Sesiones
-- ============================================================================

create or replace function public.security_admin_revoke_session(p_session_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  select user_id into v_user_id from auth.sessions where id = p_session_id;
  if v_user_id is null then
    raise exception 'Sesión no encontrada';
  end if;

  delete from auth.sessions where id = p_session_id;

  insert into public.security_events (user_id, event_type, severity, result, resource_type, resource_id, metadata)
  values (v_user_id, 'admin_session_revoked', 'warning', 'success', 'session', p_session_id, jsonb_build_object('admin_id', auth.uid()));

  perform public._security_admin_audit('REVOKE_SESSION', v_user_id, null, p_reason, jsonb_build_object('session_id', p_session_id));
end;
$$;

revoke all on function public.security_admin_revoke_session(uuid, text) from public, anon;
grant execute on function public.security_admin_revoke_session(uuid, text) to authenticated;

create or replace function public.security_admin_revoke_all_sessions(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id and deleted_at is null) then
    raise exception 'Usuario no encontrado';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  insert into public.security_events (user_id, event_type, severity, result, resource_type, resource_id, metadata)
  values (p_user_id, 'admin_all_sessions_revoked', 'warning', 'success', 'account', p_user_id, jsonb_build_object('admin_id', auth.uid(), 'sessions_revoked', v_count));

  perform public._security_admin_audit('REVOKE_ALL_SESSIONS', p_user_id, null, p_reason, jsonb_build_object('sessions_revoked', v_count));
end;
$$;

revoke all on function public.security_admin_revoke_all_sessions(uuid, text) from public, anon;
grant execute on function public.security_admin_revoke_all_sessions(uuid, text) to authenticated;

-- ============================================================================
-- 11. IP blocks
-- ============================================================================

create or replace function public.security_admin_block_ip(
  p_ip inet,
  p_reason text,
  p_severity text default 'warning',
  p_duration_minutes integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Bloquear una IP exige indicar un motivo';
  end if;

  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Severidad no válida';
  end if;

  if exists (
    select 1 from public.security_ip_blocks
    where ip = p_ip and unblocked_at is null and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Ya existe un bloqueo activo para esta IP';
  end if;

  v_expires_at := case when p_duration_minutes is null then null else now() + (p_duration_minutes || ' minutes')::interval end;

  insert into public.security_ip_blocks (ip, reason, severity, created_by, expires_at)
  values (p_ip, p_reason, p_severity, auth.uid(), v_expires_at);

  insert into public.security_events (event_type, severity, result, resource_type, metadata)
  values ('admin_ip_blocked', p_severity, 'success', 'ip', jsonb_build_object('admin_id', auth.uid(), 'ip', host(p_ip)));

  perform public._security_admin_audit('BLOCK_IP', null, p_ip, p_reason, jsonb_build_object('severity', p_severity, 'duration_minutes', p_duration_minutes));
end;
$$;

revoke all on function public.security_admin_block_ip(inet, text, text, integer) from public, anon;
grant execute on function public.security_admin_block_ip(inet, text, text, integer) to authenticated;

create or replace function public.security_admin_unblock_ip(p_ip inet, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  update public.security_ip_blocks
  set unblocked_at = now(), unblocked_by = auth.uid()
  where ip = p_ip and unblocked_at is null and (expires_at is null or expires_at > now());

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No hay ningún bloqueo activo para esta IP';
  end if;

  insert into public.security_events (event_type, severity, result, resource_type, metadata)
  values ('admin_ip_unblocked', 'info', 'success', 'ip', jsonb_build_object('admin_id', auth.uid(), 'ip', host(p_ip)));

  perform public._security_admin_audit('UNBLOCK_IP', null, p_ip, p_reason);
end;
$$;

revoke all on function public.security_admin_unblock_ip(inet, text) from public, anon;
grant execute on function public.security_admin_unblock_ip(inet, text) to authenticated;

create or replace function public.security_admin_list_ip_blocks(p_active_only boolean default false)
returns table (
  id uuid, ip inet, reason text, severity text, created_by uuid, created_by_display text,
  created_at timestamptz, expires_at timestamptz, unblocked_at timestamptz, is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  return query
  select
    b.id, b.ip, b.reason, b.severity, b.created_by,
    coalesce(p.display_name, p.email, b.created_by::text),
    b.created_at, b.expires_at, b.unblocked_at,
    (b.unblocked_at is null and (b.expires_at is null or b.expires_at > now())) as is_active
  from public.security_ip_blocks b
  left join public.profiles p on p.id = b.created_by
  where not p_active_only or (b.unblocked_at is null and (b.expires_at is null or b.expires_at > now()))
  order by b.created_at desc
  limit 200;
end;
$$;

revoke all on function public.security_admin_list_ip_blocks(boolean) from public, anon;
grant execute on function public.security_admin_list_ip_blocks(boolean) to authenticated;

-- ============================================================================
-- 12. Auditoría del propio Security Center (solo lectura)
-- ============================================================================

create or replace function public.security_admin_list_audit_log(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, admin_id uuid, admin_display text, action text,
  target_user_id uuid, target_user_display text, target_ip inet,
  reason text, metadata jsonb, created_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  return query
  select
    l.id, l.admin_id, coalesce(ap.display_name, ap.email, l.admin_id::text),
    l.action, l.target_user_id, coalesce(tp.display_name, tp.email, l.target_user_id::text),
    l.target_ip, l.reason, l.metadata, l.created_at,
    count(*) over() as total_count
  from public.security_admin_audit_log l
  left join public.profiles ap on ap.id = l.admin_id
  left join public.profiles tp on tp.id = l.target_user_id
  order by l.created_at desc
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.security_admin_list_audit_log(integer, integer) from public, anon;
grant execute on function public.security_admin_list_audit_log(integer, integer) to authenticated;

-- ============================================================================
-- 13. Bootstrap del primer Security Admin (decisión explícita del usuario
--     del proyecto, no una elección automática) -- lucas.mesas.17@gmail.com.
-- ============================================================================

insert into public.security_admins (user_id, can_view_ip, granted_by)
select id, true, id from auth.users where email = 'lucas.mesas.17@gmail.com'
on conflict (user_id) do nothing;

-- EOF
