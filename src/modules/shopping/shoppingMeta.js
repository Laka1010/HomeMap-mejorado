import { AlertTriangle, Clock, Leaf } from "lucide-react";

/**
 * Metadatos compartidos de Compras: iconos por categoría y niveles de
 * prioridad. Las categorías siguen siendo la lista compartida con Inventario
 * (state.categories / categoriesService.js) — aquí solo se les asigna un
 * icono por nombre, sin tocar el modelo de datos.
 */

function normalizeName(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const CATEGORY_ICON_MAP = {
  "comida": "🥛", "alimentacion": "🥛", "alimentación": "🥛", "supermercado": "🥛",
  "limpieza": "🧴",
  "bano": "🧻", "baño": "🧻", "higiene": "🧻",
  "farmacia": "💊", "salud": "💊",
  "mascotas": "🐶", "mascota": "🐶",
  "hogar": "🛠", "herramientas": "🛠", "bricolaje": "🛠",
  "ropa": "👕",
  "tecnologia": "🔌", "tecnología": "🔌", "electronica": "🔌", "electrónica": "🔌",
  "viajes": "✈️",
  "regalos": "🎁",
  "muebles": "🪑",
  "libros": "📚",
  "navidad": "🎄",
  "documentos": "📄",
  "bebe": "🍼", "bebé": "🍼", "bebes": "🍼", "bebés": "🍼",
};
const DEFAULT_CATEGORY_ICON = "📦";

export function getCategoryIcon(category) {
  return CATEGORY_ICON_MAP[normalizeName(category)] || DEFAULT_CATEGORY_ICON;
}

export const PRIORITY_LEVELS = [
  { key: "urgent", labelKey: "shopping.priorityUrgent", icon: AlertTriangle, color: "var(--danger)", soft: "var(--danger-soft)" },
  { key: "week", labelKey: "shopping.priorityWeek", icon: Clock, color: "var(--pin)", soft: "var(--pin-soft)" },
  { key: "no_rush", labelKey: "shopping.priorityNoRush", icon: Leaf, color: "var(--success)", soft: "var(--success-soft)" },
];

const PRIORITY_BY_KEY = Object.fromEntries(PRIORITY_LEVELS.map((p) => [p.key, p]));
const DEFAULT_PRIORITY_KEY = "week";

export function getPriorityMeta(priority) {
  return PRIORITY_BY_KEY[priority] || PRIORITY_BY_KEY[DEFAULT_PRIORITY_KEY];
}

export function isUrgent(priority) {
  return (priority || DEFAULT_PRIORITY_KEY) === "urgent";
}
