import { rule as taskOverdue } from "./taskOverdue";
import { rule as taskImportantToday } from "./taskImportantToday";
import { rule as shoppingAlmostDone } from "./shoppingAlmostDone";
import { rule as shoppingReady } from "./shoppingReady";
import { rule as financeNoExpenseThisWeek } from "./financeNoExpenseThisWeek";
import { rule as financeMonthComparison } from "./financeMonthComparison";
import { rule as calendarEventSoon } from "./calendarEventSoon";

/**
 * Registro de reglas del motor de notificaciones. Añadir un tipo nuevo de
 * notificación es añadir un archivo aquí — el motor (engine.js) no cambia.
 * Hogar no tiene reglas todavía (no hay datos reales que vigilar: colada,
 * detergente, pilas... quedan para una fase futura con un modelo de datos
 * propio), pero sigue siendo una categoría configurable en Ajustes.
 */
export const rules = [
  taskOverdue,
  taskImportantToday,
  shoppingAlmostDone,
  shoppingReady,
  financeNoExpenseThisWeek,
  financeMonthComparison,
  calendarEventSoon,
];
