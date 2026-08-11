-- Migration: Security Push Notifications (Fase 7)
-- Date: 2026-08-09
--
-- ============================================================================
-- CONTEXTO Y DECISIONES DE DISEÑO (confirmadas por el usuario del proyecto)
-- ============================================================================
--
-- 1. El FCM token NUNCA es un mecanismo de autorización. Registrar un
--    token no hace a nadie destinatario de alertas de Security Admin --
--    eso lo decide en exclusiva is_security_admin() (vía la tabla
--    security_admins), consultada por la Edge Function con service_role,
--    nunca por RLS de push_tokens. Un usuario normal puede registrar su
--    propio token (para el resto de notificaciones futuras que puedan
--    usar esta infraestructura), pero eso no le concede nada.
--
-- 2. El trigger SOLO actúa sobre severity='critical' (decisión explícita,
--    no todo INSERT en security_events). warning/info no disparan nada.
--
-- 3. El fallo del sistema de push NUNCA debe impedir que se registre
--    security_events: pg_net.http_post ya es asíncrono (encola la
--    petición y no espera respuesta), y además el cuerpo del trigger va
--    envuelto en su propio bloque EXCEPTION -- ni un pg_net mal
--    configurado ni un secreto ausente pueden abortar el INSERT
--    original. Mismo principio que log_security_event (Fase 1): separar
--    "registrar" de "efectos secundarios".
--
-- 4. El secreto compartido trigger<->Edge Function vive en Supabase
--    Vault (extensión ya instalada en este proyecto), nunca en esta
--    migración ni en el repo -- se genera y se guarda en Vault en una
--    sentencia SQL aparte, fuera de control de versiones. Las
--    credenciales de Firebase viven exclusivamente como secretos de la
--    Edge Function (Deno.env), nunca aquí.
--
-- 5. Auditoría de envío en tabla propia (security_push_delivery_log),
--    separada de security_admin_audit_log a propósito -- mezclar "quién
--    hizo una acción administrativa" con "a qué dispositivo se intentó
--    entregar una notificación" son conceptos distintos. No se guarda el
--    token FCM en el log, solo la referencia (push_tokens.id).
--
-- ============================================================================
-- 0. pg_net -- necesario para que el trigger llame a la Edge Function de
--    forma asíncrona sin bloquear la transacción del INSERT original.
-- ============================================================================

create extension if not exists pg_net;

-- ============================================================================
-- 1. push_tokens
-- ============================================================================

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index push_tokens_user_id_active_idx on public.push_tokens(user_id) where is_active;

alter table public.push_tokens enable row level security;
-- Deny-by-default, mismo patrón que security_admins/account_security_state
-- (Fase 3 Security Center): sin políticas, sin grants directos -- el único
-- acceso es vía las 2 RPCs de abajo (SECURITY DEFINER, dueñas de la tabla)
-- y la Edge Function (service_role, bypassea RLS).
revoke all on public.push_tokens from public, anon, authenticated;

-- ============================================================================
-- 2. Registro / baja de token -- gate _is_account_blocked(), NO
--    is_security_admin(): cualquier usuario no bloqueado puede registrar
--    SU PROPIO token. No concede ningún privilegio -- ver punto 1 arriba.
-- ============================================================================

create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public._is_account_blocked() then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar esta acción' using errcode = '42501';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Token no válido';
  end if;
  if p_platform not in ('android') then
    raise exception 'Plataforma no válida';
  end if;

  insert into public.push_tokens (user_id, token, platform, last_seen_at, is_active)
  values (auth.uid(), trim(p_token), p_platform, now(), true)
  on conflict (token) do update set
    user_id = excluded.user_id,
    last_seen_at = now(),
    is_active = true;
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_tokens
  set is_active = false
  where token = trim(p_token) and user_id = auth.uid();
end;
$$;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ============================================================================
-- 3. Log de entrega -- trazabilidad mínima pedida: event_id, destinatario,
--    fecha, resultado, motivo/error, referencia de token (nunca el token
--    en sí). Deny-by-default: solo lo escribe la Edge Function
--    (service_role). Sin RPC de lectura en esta fase -- fuera de alcance,
--    no pedido, se puede añadir después.
-- ============================================================================

create table public.security_push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.security_events(event_id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  push_token_id uuid references public.push_tokens(id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'invalid_token')),
  error_reason text,
  created_at timestamptz not null default now()
);

create index security_push_delivery_log_event_id_idx on public.security_push_delivery_log(event_id, created_at desc);

alter table public.security_push_delivery_log enable row level security;
revoke all on public.security_push_delivery_log from public, anon, authenticated;

-- ============================================================================
-- 4. Trigger -- únicamente severity='critical', asíncrono, nunca aborta
--    el INSERT original.
-- ============================================================================

create or replace function public._notify_critical_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if new.severity <> 'critical' then
    return new;
  end if;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'push_trigger_secret'
    limit 1;

    if v_secret is null or length(v_secret) = 0 then
      -- Sin secreto configurado en Vault: no se intenta el envío. No es
      -- un error -- security_events debe seguir funcionando igual con o
      -- sin el sistema de push activo.
      return new;
    end if;

    perform net.http_post(
      url := 'https://issxagrlwqubrzorahsn.supabase.co/functions/v1/send-security-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-trigger-secret', v_secret
      ),
      body := jsonb_build_object(
        'event_id', new.event_id,
        'event_type', new.event_type,
        'severity', new.severity,
        'created_at', new.created_at
      )
    );
  exception when others then
    -- Ver punto 3 de la cabecera: el fallo del sistema de push nunca
    -- debe impedir que se registre security_events.
    null;
  end;

  return new;
end;
$$;

-- Igual que el resto de funciones internas del proyecto (is_security_admin,
-- _is_account_blocked, _execute_financial_transfer...): una función de
-- trigger no necesita EXECUTE concedido a ningún rol para que el trigger
-- dispare (la invocación de un trigger no depende del privilegio EXECUTE
-- de la sesión que provoca el evento -- documentado ya en
-- 20260808_033_harden_execute_grants_and_policy_roles.sql), pero Postgres
-- concede EXECUTE a PUBLIC por defecto en toda función nueva. Se revoca
-- explícitamente para que no aparezca en el advisor de seguridad, mismo
-- criterio que el resto del esquema.
revoke all on function public._notify_critical_security_event() from public, anon, authenticated;

drop trigger if exists security_events_notify_critical on public.security_events;
create trigger security_events_notify_critical
  after insert on public.security_events
  for each row execute function public._notify_critical_security_event();

-- EOF
