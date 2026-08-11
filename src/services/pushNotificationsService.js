import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Browser } from "@capacitor/browser";
import { supabase } from "../supabaseClient";

/**
 * Fase 7 — notificaciones push de Security Events críticos. Registrar un
 * token aquí NO concede ningún privilegio: cualquier usuario autenticado
 * y no bloqueado puede registrar el suyo (mismo gate que cualquier acción
 * de usuario normal, _is_account_blocked() dentro de register_push_token
 * — ver supabase/migrations/20260809_065_security_push_notifications.sql).
 * Quién recibe algo lo decide en exclusiva is_security_admin()/
 * security_admins, consultado por la Edge Function, nunca por la
 * existencia de un token.
 *
 * Solo se ejecuta en plataforma nativa (Android) — Capacitor.
 * isNativePlatform() es false en el build web, donde este servicio no
 * hace nada.
 */
const ADMIN_CONSOLE_URL = import.meta.env.VITE_ADMIN_CONSOLE_URL || "";

function openSecurityEventFromNotification(eventId) {
  if (!ADMIN_CONSOLE_URL) {
    // VITE_ADMIN_CONSOLE_URL no configurada en este entorno -- no hay a
    // dónde abrir. No se lanza ningún error visible al usuario, solo se
    // registra para diagnóstico.
    console.warn("VITE_ADMIN_CONSOLE_URL no configurada: no se puede abrir Security Center desde la notificación.");
    return;
  }
  const url = `${ADMIN_CONSOLE_URL}#/security${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`;
  Browser.open({ url });
}

let initialized = false;

export const pushNotificationsService = {
  async init() {
    if (initialized) return;
    if (!Capacitor.isNativePlatform()) return;
    initialized = true;

    try {
      const current = await PushNotifications.checkPermissions();
      let granted = current.receive === "granted";
      if (!granted && current.receive !== "denied") {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === "granted";
      }
      if (!granted) return;

      await PushNotifications.register();
    } catch (e) {
      console.error("No se pudo inicializar el registro de notificaciones push", e);
      return;
    }

    PushNotifications.addListener("registration", async (token) => {
      try {
        const { error } = await supabase.rpc("register_push_token", {
          p_token: token.value,
          p_platform: "android",
        });
        if (error) throw error;
      } catch (e) {
        console.error("No se pudo registrar el token de notificaciones push", e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Error del sistema de notificaciones push", err);
    });

    // Toque sobre la notificación (app en background o cerrada) -- abre
    // Security Center en la web (Admin Console nunca entra en el APK,
    // decisión de Fase 1 mantenida aquí).
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const eventId = action?.notification?.data?.event_id;
      openSecurityEventFromNotification(eventId);
    });
  },
};
