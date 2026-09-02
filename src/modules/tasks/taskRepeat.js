/**
 * Repetición de tareas. `repeat` se guarda como uno de estos valores (texto
 * plano en la columna tasks.repeat); "none" o vacío = no se repite.
 *
 * Cuando se marca como hecha una tarea que se repite, en vez de dejarla
 * "done" (y que la borre useTaskRetention a los 2 días) se reprograma: vuelve
 * a "pending" con la siguiente fecha a partir de hoy. Así "se cumple" el
 * ciclo: si es diaria y ya está hecha, reaparece mañana.
 */

export const REPEAT_OPTIONS = ["none", "daily", "weekly", "monthly"];

export function repeatLabelKey(repeat) {
  switch (repeat) {
    case "daily": return "quickAdd.repeatDaily";
    case "weekly": return "quickAdd.repeatWeekly";
    case "monthly": return "quickAdd.repeatMonthly";
    // "yearly" hoy solo lo usa el calendario (CALENDAR_REPEAT_OPTIONS); las
    // tareas siguen con REPEAT_OPTIONS de 4 valores. El label vive aquí para
    // no duplicar el mapeo si más adelante las tareas también lo admiten.
    case "yearly": return "quickAdd.repeatYearly";
    default: return "quickAdd.repeatNone";
  }
}

export function isRepeating(repeat) {
  return repeat === "daily" || repeat === "weekly" || repeat === "monthly";
}

const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Siguiente fecha de vencimiento (YYYY-MM-DD) tras completar hoy una tarea
 * que se repite, o null si no se repite.
 */
export function nextRepeatDate(repeat, from = new Date()) {
  if (!isRepeating(repeat)) return null;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return toISODate(d);
}
