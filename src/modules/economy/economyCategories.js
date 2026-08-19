/**
 * Catálogo fijo de categorías de Economía (gastos e ingresos).
 *
 * Antes estos campos eran de texto libre: el usuario escribía "Alimentación"
 * en un gasto y "alimentación" (u otra variante) en un objetivo, y como la
 * comparación no las trataba como iguales, el objetivo nunca sumaba. Fijar
 * el catálogo y usarlo con un <select> en vez de un <input> elimina el
 * problema de raíz — ya no hay forma de escribir una variante distinta.
 *
 * Los valores se guardan tal cual (en español) sin pasar por el sistema de
 * traducciones: así ya funcionaban los datos existentes (p. ej. los iconos
 * de ENTRY_ICONS en EconomyOverview.jsx buscan por el texto exacto
 * "Regalos recibidos"/"Suscripciones"), así que se mantiene esa convención.
 */
export const EXPENSE_CATEGORIES = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Suministros",
  "Salud",
  "Educación",
  "Ocio",
  "Ropa",
  "Suscripciones",
  "Regalos",
  "Otros",
];

/**
 * Categoría neutra por defecto cuando el usuario no elige ninguna. NO se usa
 * `EXPENSE_CATEGORIES[0]`/`INCOME_CATEGORIES[0]` para eso: el primer
 * elemento es una categoría real ("Alimentación"/"Salario"), así que todo lo
 * que se registraba rápido sin tocar el desplegable aterrizaba ahí y
 * falseaba `getExpensesByCategory`, las estadísticas y el progreso de los
 * objetivos por categoría.
 */
export const DEFAULT_CATEGORY = "Otros";

export const INCOME_CATEGORIES = [
  "Salario",
  "Regalos recibidos",
  "Extraordinario",
  "Otros",
];
