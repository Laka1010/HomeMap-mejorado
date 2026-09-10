/**
 * Catálogo por defecto de categorías de Economía (gastos e ingresos).
 *
 * Desde 2026-09 las categorías se pueden editar por hogar (tabla
 * `economy_categories`, ver Configuración de la casa → Categorías). Estas
 * listas son solo la SEMILLA con la que arranca un hogar nuevo y el fallback
 * cuando aún no hay filas propias.
 *
 * Los valores se guardan tal cual (en español) — es la clave canónica con la
 * que comparan objetivos, iconos (ENTRY_ICONS en EconomyOverview) y
 * estadísticas. Para pintarlos en el idioma activo se traducen con
 * `economyCategory.<slug>` (ver categoryLabel); si el valor no está en el
 * mapa se devuelve tal cual.
 */
export const EXPENSE_CATEGORIES = [
  "Comida",
  "Compras",
  "Cuidado personal",
  "Deportes",
  "Deudas",
  "Educación",
  "Casa",
  "Inversiones",
  "Animales",
  "Niños y familia",
  "Consolas",
  "Restaurantes",
  "Salud",
  "Regalos",
  "Suscripciones",
  "Vehículo",
  "Transporte",
  "Viajar",
  "Otros gastos",
];

export const INCOME_CATEGORIES = [
  "Autónomo",
  "Ayudas y subvenciones",
  "Bizum",
  "Dividendos",
  "Intereses",
  "Negocios",
  "Nómina",
  "Reembolso",
  "Regalos",
  "Rentas",
  "Transferencia",
  "Ventas",
  "Otros ingresos",
];

/**
 * Categoría neutra por defecto cuando el usuario no elige ninguna. NO se usa
 * `EXPENSE_CATEGORIES[0]`/`INCOME_CATEGORIES[0]` para eso: el primer elemento
 * es una categoría real, así que todo lo que se registra rápido sin tocar el
 * desplegable aterrizaría ahí y falsearía estadísticas y objetivos por
 * categoría.
 */
export const DEFAULT_CATEGORY = "Otros gastos";
export const DEFAULT_INCOME_CATEGORY = "Otros ingresos";

/** Default apropiado según el tipo de movimiento. */
export function defaultCategoryFor(kind) {
  return kind === "income" || kind === "incomes" ? DEFAULT_INCOME_CATEGORY : DEFAULT_CATEGORY;
}

/**
 * name (valor canónico en español) -> clave i18n. Incluye las categorías del
 * catálogo actual y también las antiguas ("Alimentación", "Ocio"...) para que
 * los movimientos ya registrados con ellas se sigan traduciendo.
 */
const CATEGORY_LABEL_KEYS = {
  // Catálogo actual — gastos
  "Comida": "economyCategory.comida",
  "Compras": "economyCategory.compras",
  "Cuidado personal": "economyCategory.personalCare",
  "Deportes": "economyCategory.sports",
  "Deudas": "economyCategory.debts",
  "Educación": "economyCategory.education",
  "Casa": "economyCategory.home",
  "Inversiones": "economyCategory.investments",
  "Animales": "economyCategory.animals",
  "Niños y familia": "economyCategory.kidsFamily",
  "Consolas": "economyCategory.gaming",
  "Restaurantes": "economyCategory.restaurants",
  "Salud": "economyCategory.health",
  "Regalos": "economyCategory.gifts",
  "Suscripciones": "economyCategory.subscriptions",
  "Vehículo": "economyCategory.vehicle",
  "Transporte": "economyCategory.transport",
  "Viajar": "economyCategory.travel",
  "Otros gastos": "economyCategory.otherExpenses",
  // Catálogo actual — ingresos
  "Autónomo": "economyCategory.selfEmployed",
  "Ayudas y subvenciones": "economyCategory.grants",
  "Bizum": "economyCategory.bizum",
  "Dividendos": "economyCategory.dividends",
  "Intereses": "economyCategory.interest",
  "Negocios": "economyCategory.business",
  "Nómina": "economyCategory.payroll",
  "Reembolso": "economyCategory.refund",
  "Rentas": "economyCategory.rentalIncome",
  "Transferencia": "economyCategory.transferIncome",
  "Ventas": "economyCategory.sales",
  "Otros ingresos": "economyCategory.otherIncome",
  // Catálogo antiguo (datos ya registrados)
  "Alimentación": "economyCategory.food",
  "Vivienda": "economyCategory.housing",
  "Suministros": "economyCategory.utilities",
  "Ocio": "economyCategory.leisure",
  "Ropa": "economyCategory.clothing",
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
 * Emoji por categoría. La clave es el valor canónico en español. Se usa para
 * pintar el selector y las filas de movimientos/facturas. Si el valor no está
 * en el mapa (una categoría personalizada) cae en 🏷️.
 */
const CATEGORY_EMOJI = {
  // Catálogo actual — gastos
  "Comida": "🍽️",
  "Compras": "🛍️",
  "Cuidado personal": "💅",
  "Deportes": "⚽",
  "Deudas": "💳",
  "Educación": "🎓",
  "Casa": "🏠",
  "Inversiones": "📈",
  "Animales": "🐾",
  "Niños y familia": "👨‍👩‍👧",
  "Consolas": "🎮",
  "Restaurantes": "🍴",
  "Salud": "🩺",
  "Regalos": "🎁",
  "Suscripciones": "🔄",
  "Vehículo": "🚗",
  "Transporte": "🚌",
  "Viajar": "✈️",
  "Otros gastos": "📦",
  // Catálogo actual — ingresos
  "Autónomo": "💼",
  "Ayudas y subvenciones": "🏛️",
  "Bizum": "📲",
  "Dividendos": "📊",
  "Intereses": "🏦",
  "Negocios": "🏢",
  "Nómina": "💰",
  "Reembolso": "↩️",
  "Rentas": "🏘️",
  "Transferencia": "🔁",
  "Ventas": "💸",
  "Otros ingresos": "📥",
  // Catálogo antiguo (datos ya registrados)
  "Alimentación": "🍽️",
  "Vivienda": "🏠",
  "Suministros": "💡",
  "Ocio": "🎉",
  "Ropa": "👕",
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
