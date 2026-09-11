/**
 * Emoji para las categorías de OBJETOS. A diferencia de Economía, aquí las
 * categorías son texto libre (el usuario escribe la suya), así que el mapa es
 * "best effort": se normaliza a minúsculas y se buscan los nombres habituales
 * (los de `DEFAULT_CATEGORIES` en App.jsx y los de las plantillas de hogar).
 * Lo que no encaje cae en 🏷️.
 */

const OBJECT_CATEGORY_EMOJI = {
  // catálogo por defecto (DEFAULT_CATEGORIES en App.jsx)
  "electrónica": "📱",
  "electronica": "📱",
  "electrodomésticos": "🧊",
  "electrodomesticos": "🧊",
  "muebles": "🛋️",
  "cocina": "🍳",
  "ropa": "👕",
  "calzado": "👟",
  "accesorios": "👜",
  "herramientas y bricolaje": "🔧",
  "herramientas": "🔧",
  "bricolaje": "🔧",
  "deporte y ocio": "⚽",
  "deporte": "⚽",
  "deportes": "⚽",
  "ocio": "⚽",
  "juguetes": "🧸",
  "libros y música": "📚",
  "libros y musica": "📚",
  "libros": "📚",
  "música": "🎵",
  "musica": "🎵",
  "decoración": "🖼️",
  "decoracion": "🖼️",
  "documentos y objetos importantes": "📄",
  "documentos": "📄",
  "papeles": "📄",
  "salud y cuidado personal": "🩹",
  "salud": "🩹",
  "cuidado personal": "🩹",
  "mascotas": "🐶",
  "mascota": "🐶",
  "vehículos": "🚗",
  "vehiculos": "🚗",
  "coche": "🚗",
  "auto": "🚗",
  "colecciones y objetos de valor": "💎",
  "colecciones": "💎",
  "otros": "📦",
  // sinónimos de categorías antiguas o de plantillas, ya fuera del catálogo
  // por defecto pero que pueden seguir en hogares existentes
  "comida": "🍎",
  "viajes": "✈️",
  "viaje": "✈️",
  "regalos": "🎁",
  "tecnología": "📱",
  "tecnologia": "📱",
  "videojuegos": "🎮",
  "navidad": "🎄",
  "belleza": "💄",
  "medicinas": "💊",
  "jardín": "🪴",
  "jardin": "🪴",
  "bebé": "🍼",
  "bebe": "🍼",
  "limpieza": "🧽",
  "oficina": "🖇️",
};

export const OBJECT_CATEGORY_EMOJI_FALLBACK = "🏷️";

/** Emoji de una categoría de objetos (texto libre). */
export function objectCategoryEmoji(name) {
  if (!name) return OBJECT_CATEGORY_EMOJI_FALLBACK;
  const key = String(name).trim().toLowerCase();
  return OBJECT_CATEGORY_EMOJI[key] || OBJECT_CATEGORY_EMOJI_FALLBACK;
}
