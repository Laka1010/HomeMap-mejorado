-- Migration: endurecer log_security_event (hallazgo C-2 / A-1 de la auditoría)
-- Date: 2026-08-31
--
-- PROBLEMA
-- log_security_event es la única superficie de escritura de security_events
-- expuesta al cliente (ninguna función del servidor la llama: todas insertan
-- directamente). Tal como estaba, permitía a un llamante SIN SESIÓN:
--
--   1. Declarar 'authz_unauthorized_financial_operation' o
--      'authz_permission_bypass_attempt', que el servidor marcaba como
--      severity='critical' sin poder verificar nada. Cada fila crítica
--      dispara el trigger security_events_notify_critical_telegram, así que
--      cualquiera con la URL del proyecto podía generar alertas de Telegram
--      a voluntad y ahogar las reales.
--   2. Atribuir eventos a otra persona: con p_email, un anónimo resolvía el
--      email de la víctima a su user_id y colgaba 'auth_login_failure' de su
--      cuenta. Cinco en diez minutos disparaban _maybe_log_suspicious_activity,
--      que inserta un evento 'critical' a nombre de la víctima -> Telegram con
--      su correo. Servía para incriminar a un usuario legítimo.
--
-- PRINCIPIO QUE SE IMPONE
-- El cliente no puede declarar libremente que ha ocurrido un evento crítico.
-- severity y result se siguen derivando en servidor (ya era así, se conserva);
-- lo que cambia es que ningún evento que el servidor no pueda verificar puede
-- alcanzar 'critical', y que la atribución sale siempre del JWT.
--
-- LO QUE **NO** CAMBIA
--   * El trigger de Telegram y toda su cadena: intacto. Un evento crítico real
--     sigue produciendo su alerta exactamente igual.
--   * La firma de la RPC (p_email se mantiene por compatibilidad con el
--     cliente, que la sigue enviando) -> cero cambios en el frontend.
--   * El formato de las filas de security_events.
--   * Los GRANT: anon conserva EXECUTE porque 'auth_login_failure' y
--     'auth_password_reset_requested' ocurren, por definición, antes de que
--     exista sesión. La restricción se impone dentro de la función, no con el
--     permiso: revocar anon a secas eliminaría la detección de fuerza bruta
--     sobre el login, que es la señal más valiosa que registra el sistema.
--
-- REVERSIBLE: para volver atrás basta reaplicar la definición de
-- log_security_event de 20260808_049_security_events_cross_access.sql.
-- Esta migración no crea ni borra objetos: solo reemplaza el cuerpo de una
-- función. No toca datos.

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
  v_caller_id uuid;
  v_user_id uuid;
  v_ip inet;
  v_rate_key text;
begin
  v_caller_id := auth.uid();

  -- severity/result SIEMPRE derivados aquí: el cliente no los envía y no
  -- tiene forma de influir en ellos más allá de elegir el event_type.
  case p_event_type
    when 'auth_login_success' then v_severity := 'info'; v_result := 'success';
    when 'auth_login_failure' then v_severity := 'warning'; v_result := 'failure';
    when 'auth_logout' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_change' then v_severity := 'info'; v_result := 'success';
    when 'auth_password_reset_requested' then v_severity := 'info'; v_result := 'success';
    when 'auth_email_change' then v_severity := 'warning'; v_result := 'success';

    -- Se queda en 'critical' porque es el ÚNICO evento crítico que el
    -- servidor puede verificar por su cuenta: _verify_cross_access_claim
    -- comprueba contra financial_accounts/financial_spaces que el llamante
    -- realmente no tiene acceso al recurso que dice haber tocado.
    when 'authz_cross_account_access' then v_severity := 'critical'; v_result := 'denied';

    when 'authz_cross_personal_economy_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_cross_workspace_access' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_unauthorized_write' then v_severity := 'warning'; v_result := 'denied';

    -- C-2: antes 'critical'. El cliente solo está afirmando "una RPC me
    -- devolvió 42501"; el servidor no guarda nada con lo que contrastarlo, así
    -- que la afirmación no puede valer una alerta crítica. El evento se sigue
    -- registrando igual (result='denied') y sigue visible y filtrable en el
    -- Security Center: lo único que pierde es el disparo de Telegram.
    when 'authz_unauthorized_financial_operation' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_rpc_rejected' then v_severity := 'warning'; v_result := 'denied';
    when 'authz_permission_bypass_attempt' then v_severity := 'warning'; v_result := 'denied';

    else
      raise exception 'Tipo de evento de seguridad no válido: %', p_event_type;
  end case;

  -- C-2: un llamante sin sesión solo puede declarar los dos eventos que, por
  -- definición, ocurren antes de tener sesión. Todo lo demás exige JWT.
  if v_caller_id is null
     and p_event_type not in ('auth_login_failure', 'auth_password_reset_requested') then
    raise exception 'No autorizado: este evento de seguridad requiere sesión'
      using errcode = '42501';
  end if;

  -- C-2: la atribución sale SIEMPRE del JWT, nunca de un parámetro. p_email se
  -- sigue aceptando para no romper la firma que usa el cliente, pero ya no
  -- resuelve a ningún user_id: un anónimo no puede colgar un evento de la
  -- cuenta de otra persona, y un autenticado no puede suplantar a nadie.
  -- Consecuencia asumida: los intentos de login fallidos de un usuario no
  -- autenticado quedan con user_id nulo. La detección de fuerza bruta sigue
  -- cubierta por _maybe_log_suspicious_activity_by_ip, que trabaja por IP.
  v_user_id := v_caller_id;

  if p_event_type in ('authz_cross_account_access',
                      'authz_cross_personal_economy_access',
                      'authz_cross_workspace_access') then
    if not public._verify_cross_access_claim(p_event_type, p_resource_type, p_resource_id, v_user_id) then
      return;
    end if;
  end if;

  v_ip := public._security_event_client_ip();
  v_rate_key := coalesce(v_user_id::text, host(v_ip), 'unknown');

  if not public._security_event_rate_limit_ok(v_rate_key) then
    return;
  end if;

  -- C-2: un crítico verificado sigue valiendo una alerta, pero no sirve para
  -- generarlas en cadena. Si ya hay uno idéntico reciente (mismo usuario,
  -- mismo tipo, mismo recurso), se omite. Mismo patrón de supresión que ya
  -- usaba _maybe_log_suspicious_activity con su ventana de 30 minutos.
  if v_severity = 'critical' and exists (
    select 1 from public.security_events
    where event_type = p_event_type
      and user_id is not distinct from v_user_id
      and resource_id is not distinct from p_resource_id
      and created_at >= now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.security_events (
    user_id, event_type, severity, result, ip_address, session_id,
    resource_type, resource_id, metadata
  ) values (
    v_user_id, p_event_type, v_severity, v_result,
    v_ip, public._security_event_session_id(),
    p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb)
  );

  -- C-2: la escalada por usuario solo cuenta eventos que el propio usuario
  -- autenticado ha generado sobre sí mismo. Antes la disparaba un anónimo
  -- atribuyendo fallos de login a la víctima con p_email.
  if v_result in ('denied', 'failure')
     and v_caller_id is not null
     and v_user_id = v_caller_id then
    begin
      perform public._maybe_log_suspicious_activity(v_user_id, v_ip);
    exception when others then
      null;
    end;
  end if;

  -- Sin cambios: la detección por IP sigue siendo la vía que cubre la fuerza
  -- bruta no autenticada.
  if v_result in ('denied', 'failure') or p_event_type = 'auth_password_reset_requested' then
    begin
      perform public._maybe_log_suspicious_activity_by_ip(v_ip);
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- Grants: se reafirman los existentes, no se amplían. anon conserva EXECUTE
-- por el motivo explicado arriba; la restricción real vive en el cuerpo.
revoke execute on function public.log_security_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_security_event(text, text, uuid, jsonb, text) to anon, authenticated;

-- EOF
