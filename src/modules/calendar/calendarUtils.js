import { CheckSquare, CreditCard, ShoppingCart, Bell, Package, CalendarClock } from "lucide-react";

/**
 * Utilidades de fecha y metadatos de categoría para el Calendario (vista
 * semanal). Consolidadas aquí para que un futuro toggle de "vista mensual"
 * o un calendario compartido puedan reutilizar la misma agregación de
 * eventos sin duplicar cálculos — ver CalendarModule.jsx.
 */

/**
 * Clave YYYY-MM-DD para agrupar eventos por día. Deliberadamente NO usa
 * toISOString() para esto: convierte a UTC, y con un huso horario positivo
 * (p. ej. GMT+2) la medianoche local de un `Date` construido como
 * `new Date(y, m, d)` (así se crean los chips de la semana) cae en el día
 * UTC anterior, desplazando "hoy" un día hacia atrás. Las fechas guardadas
 * como texto ("2026-07-28", tareas/facturas) ya son la clave — se devuelven
 * tal cual sin pasar por Date. Solo para timestamps completos (fecha+hora)
 * se usa el Date y se toman sus componentes LOCALES (el día que el usuario
 * ve en su propio huso horario).
 */
export function toDateKey(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    return dateValue.slice(0, 10);
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayLabel(date, locale = "es") {
  return date.toLocaleDateString(locale === "en" ? "en-GB" : locale === "ca" ? "ca-ES" : "es-ES", { day: "numeric", month: "short" });
}

/** Devuelve los 7 Date (lunes -> domingo) de la semana que contiene `anchorDate`. */
export function getWeekDates(anchorDate) {
  const weekday = anchorDate.getDay(); // 0=Dom..6=Sáb
  const paddedStart = weekday === 0 ? 6 : weekday - 1; // días desde el lunes
  const monday = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - paddedStart);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

export function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/**
 * Copia local del cálculo de "días hasta el vencimiento" (duplicado también
 * en BillsSection.jsx y EconomyOverview.jsx — no se consolidan en este
 * cambio para no tocar esas pantallas ya probadas).
 */
export function getDaysUntil(dueDate) {
  const today = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24));
}

export function billDueLabel(dueDate, t) {
  const days = getDaysUntil(dueDate);
  if (days === 0) return t("calendarModule.billDueToday");
  if (days === 1) return t("calendarModule.billDueTomorrow");
  if (days < 0) return t("calendarModule.billOverdue", { count: Math.abs(days) });
  return t("calendarModule.billDueInDays", { count: days });
}

/**
 * Icono + color discreto por tipo de evento. "Evento" son los eventos
 * manuales que crea el usuario (calendar_events). "Recordatorio" y "Evento
 * del hogar" están preparados para cuando esos módulos tengan un campo de
 * fecha propio (hoy no existe en el esquema, ver buildLocalEvents.js); de
 * momento nunca llegan eventos con esos tipos.
 */
export const EVENT_CATEGORY_META = {
  Tarea: { icon: CheckSquare, color: "var(--accent)", bg: "var(--accent-soft)" },
  Factura: { icon: CreditCard, color: "var(--pin)", bg: "var(--pin-soft)" },
  Compra: { icon: ShoppingCart, color: "var(--success)", bg: "var(--success-soft)" },
  Evento: { icon: CalendarClock, color: "var(--danger)", bg: "var(--danger-soft)" },
  Recordatorio: { icon: Bell, color: "var(--ink-soft)", bg: "var(--surface-alt)" },
  "Evento del hogar": { icon: Package, color: "var(--ink-soft)", bg: "var(--surface-alt)" },
};
