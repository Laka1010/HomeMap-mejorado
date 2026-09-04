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

/**
 * Los valores de arriba se guardan en la BD tal cual (en español) — es la
 * clave canónica con la que comparan objetivos, iconos (ENTRY_ICONS) y
 * estadísticas. Para PINTARLOS en el idioma activo se traducen aquí con
 * `economyCategory.<slug>`. Si el valor no está en el catálogo (una categoría
 * antigua de texto libre, o el nombre de un objetivo de ahorro) se devuelve
 * sin tocar.
 */
const CATEGORY_LABEL_KEYS = {
  "Alimentación": "economyCategory.food",
  "Transporte": "economyCategory.transport",
  "Vivienda": "economyCategory.housing",
  "Suministros": "economyCategory.utilities",
  "Salud": "economyCategory.health",
  "Educación": "economyCategory.education",
  "Ocio": "economyCategory.leisure",
  "Ropa": "economyCategory.clothing",
  "Suscripciones": "economyCategory.subscriptions",
  "Regalos": "economyCategory.gifts",
  "Otros": "economyCategory.other",
  "Salario": "economyCategory.salary",
  "Regalos recibidos": "economyCategory.giftsReceived",
  "Extraordinario": "economyCategory.windfall",
};

/** Etiqueta localizada de una categoría de Economía (el valor guardado sigue en español). */
export function categoryLabel(value, t) {
  const key = CATEGORY_LABEL_KEYS[value];
  return key ? t(key) : (value || "");
}

/**
 * Emoji por categoría. Misma convención que `CATEGORY_LABEL_KEYS`: la clave es
 * el valor canónico en español (el que se guarda en BD). Se usa para pintar el
 * selector en cuadrícula y las filas de movimientos/facturas. Si el valor no
 * está en el catálogo (una categoría antigua de texto libre) cae en 🏷️.
 */
const CATEGORY_EMOJI = {
  "Alimentación": "🍽️",
  "Transporte": "🚗",
  "Vivienda": "🏠",
  "Suministros": "💡",
  "Salud": "🩺",
  "Educación": "🎓",
  "Ocio": "🎉",
  "Ropa": "👕",
  "Suscripciones": "🔄",
  "Regalos": "🎁",
  "Otros": "📦",
  "Salario": "💰",
  "Regalos recibidos": "🎀",
  "Extraordinario": "✨",
};

export const CATEGORY_EMOJI_FALLBACK = "🏷️";

/** Emoji de una categoría de Economía. */
export function categoryEmoji(value) {
  return CATEGORY_EMOJI[value] || CATEGORY_EMOJI_FALLBACK;
}
