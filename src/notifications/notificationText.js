/**
 * Texto visible de una notificación en el idioma activo.
 *
 * Las reglas de src/notifications/rules/*.js guardan la clave i18n y sus
 * variables (title_key/title_vars...) además del texto en español. Aquí se
 * prefiere siempre la clave; el texto guardado solo se usa como respaldo para
 * las filas creadas antes de la migración 20260819_069, que no tienen clave.
 *
 * Los textos que escribió el usuario (el nombre de una tarea, la lista de
 * productos pendientes) no llevan clave a propósito: se muestran tal cual.
 */
export function notificationTitle(t, notification) {
  return notification?.titleKey
    ? t(notification.titleKey, notification.titleVars || {})
    : notification?.title || "";
}

export function notificationBody(t, notification) {
  return notification?.bodyKey
    ? t(notification.bodyKey, notification.bodyVars || {})
    : notification?.body || "";
}

export function notificationActionLabel(t, notification) {
  const key = notification?.actionLabelKey || notification?.action?.labelKey;
  return key ? t(key) : notification?.action?.label || "";
}
