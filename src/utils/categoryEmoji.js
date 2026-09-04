/**
 * Emoji para las categorías de OBJETOS. A diferencia de Economía, aquí las
 * categorías son texto libre (el usuario escribe la suya), así que el mapa es
 * "best effort": se normaliza a minúsculas y se buscan los nombres habituales
 * (los de `DEFAULT_CATEGORIES` en App.jsx y los de las plantillas de hogar).
 * Lo que no encaje cae en 🏷️.
 */

const OBJECT_CATEGORY_EMOJI = {
  // por defecto
  "comida": "🍎",
  "viajes": "✈️",
  "viaje": "✈️",
  "muebles": "🛋️",
  "electrónica": "🔌",
  "electronica": "🔌",
  "regalos": "🎁",
  // habituales / plantillas
  "tecnología": "⚡",
  "tecnologia": "⚡",
  "videojuegos": "🎮",
  "ropa": "👕",
  "libros": "📚",
  "cocina": "🍳",
  "herramientas": "🔧",
  "navidad": "🎄",
  "documentos": "📄",
  "papeles": "📄",
  "deporte": "⚽",
  "deportes": "⚽",
  "mascotas": "🐾",
  "mascota": "🐾",
  "juguetes": "🧸",
  "belleza": "💄",
  "salud": "🩺",
  "medicinas": "💊",
  "música": "🎵",
  "musica": "🎵",
  "jardín": "🪴",
  "jardin": "🪴",
  "coche": "🚗",
  "auto": "🚗",
  "bebé": "🍼",
  "bebe": "🍼",
  "limpieza": "🧽",
  "oficina": "🖇️",
  "decoración": "🖼️",
  "decoracion": "🖼️",
  "electrodomésticos": "🔌",
  "electrodomesticos": "🔌",
  "otros": "📦",
};

export const OBJECT_CATEGORY_EMOJI_FALLBACK = "🏷️";

/** Emoji de una categoría de objetos (texto libre). */
export function objectCategoryEmoji(name) {
  if (!name) return OBJECT_CATEGORY_EMOJI_FALLBACK;
  const key = String(name).trim().toLowerCase();
  return OBJECT_CATEGORY_EMOJI[key] || OBJECT_CATEGORY_EMOJI_FALLBACK;
}
