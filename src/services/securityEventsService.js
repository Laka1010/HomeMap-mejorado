import { supabase } from "../supabaseClient";

/**
 * Cliente del sistema de Security Events (Fase 1 — solo registro, ver
 * supabase/migrations/20260808_045_security_events.sql). Una única RPC,
 * log_security_event, hace todo el trabajo de verdad server-side (deriva
 * severity/result del event_type, resuelve user_id desde el JWT o —solo
 * para login fallido/recuperación— desde el email sin guardar el email en
 * sí, captura ip/session_id del propio request). Esta capa solo evita que un
 * fallo de logging rompa la acción real del usuario: nunca lanza.
 */
async function logSecurityEvent(eventType, { resourceType, resourceId, metadata, email } = {}) {
  try {
    await supabase.rpc("log_security_event", {
      p_event_type: eventType,
      p_resource_type: resourceType || null,
      p_resource_id: resourceId || null,
      p_metadata: metadata || {},
      p_email: email || null,
    });
  } catch {
    // El registro de seguridad nunca debe bloquear ni degradar la acción real.
  }
}

/**
 * Postgres etiqueta como 42501 (insufficient_privilege) los `raise
 * exception` de autorización en las RPCs sensibles (ver la migración) — así
 * se distingue de forma fiable un rechazo de permisos de un simple error de
 * validación o "no encontrado", sin analizar el texto del mensaje.
 */
export function isPermissionDeniedError(error) {
  return error?.code === "42501";
}

/** Registra el rechazo de una RPC sensible solo si fue por falta de permiso. */
export function logIfPermissionDenied(error, eventType, options) {
  if (isPermissionDeniedError(error)) {
    logSecurityEvent(eventType, options);
  }
}

export const securityEventsService = { logSecurityEvent, isPermissionDeniedError, logIfPermissionDenied };
