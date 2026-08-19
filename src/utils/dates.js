/**
 * Formatea una fecha como YYYY-MM-DD usando sus componentes locales
 * (año/mes/día del objeto Date), NO `toISOString().split("T")[0]`: ese
 * método convierte a UTC antes de recortar la hora, así que en zonas
 * horarias adelantadas a UTC (Madrid, etc.) la medianoche local del último
 * día del mes cae en el día anterior en UTC — el filtro de fin de mes
 * excluía el día 31 (o el que tocase) por ese desfase de un día.
 */
export function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Tiempo relativo con granularidad de minutos/horas, para el centro de
 * actividad (a diferencia del `timeAgo` de App.jsx, que solo distingue por
 * días y no sirve para notificaciones recién creadas).
 *
 * Recibe `t` y `locale` en vez de tener los textos en español dentro: la app
 * se traduce a es/en, y esta función se pinta en el centro de actividad y en
 * el widget de actividad reciente, donde antes un usuario en inglés veía
 * "hace 5 min" y "ayer" en medio de una interfaz traducida.
 */
export function timeAgoShort(dateStr, t, locale = "es") {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("timeAgo.now");
  if (minutes < 60) return t("timeAgo.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("timeAgo.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t("timeAgo.yesterday");
  if (days < 7) return t("timeAgo.days", { count: days });
  return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-GB" : "es-ES", { day: "2-digit", month: "short" });
}
