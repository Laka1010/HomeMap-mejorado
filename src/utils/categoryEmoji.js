/**
 * Emoji y etiqueta traducida para las categorías de OBJETOS. A diferencia de
 * Economía, aquí las categorías son texto libre (el usuario escribe la
 * suya) — el nombre canónico que se guarda es siempre el español (el de
 * `DEFAULT_CATEGORIES` en App.jsx, o lo que el usuario haya escrito), así
 * que este mapa es "best effort": se normaliza a minúsculas y se busca por
 * los nombres habituales (catálogo por defecto + sinónimos de plantillas y
 * hogares antiguos). Lo que no encaje cae en 🏷️ / se muestra tal cual.
 *
 * Un único mapa nombre -> { emoji, key } evita que el emoji y la traducción
 * se desincronicen entre dos tablas distintas.
 */
const OBJECT_CATEGORY_META = {
  // catálogo por defecto (DEFAULT_CATEGORIES en App.jsx)
  "electrónica": { emoji: "📱", key: "electronics" },
  "electronica": { emoji: "📱", key: "electronics" },
  "electrodomésticos": { emoji: "🧊", key: "appliances" },
  "electrodomesticos": { emoji: "🧊", key: "appliances" },
  "muebles": { emoji: "🛋️", key: "furniture" },
  "cocina": { emoji: "🍳", key: "kitchen" },
  "ropa": { emoji: "👕", key: "clothing" },
  "calzado": { emoji: "👟", key: "footwear" },
  "accesorios": { emoji: "👜", key: "accessories" },
  "herramientas y bricolaje": { emoji: "🔧", key: "toolsDiy" },
  "herramientas": { emoji: "🔧", key: "toolsDiy" },
  "bricolaje": { emoji: "🔧", key: "toolsDiy" },
  "deporte y ocio": { emoji: "⚽", key: "sportsLeisure" },
  "deporte": { emoji: "⚽", key: "sportsLeisure" },
  "deportes": { emoji: "⚽", key: "sportsLeisure" },
  "ocio": { emoji: "⚽", key: "sportsLeisure" },
  "juguetes": { emoji: "🧸", key: "toys" },
  "libros y música": { emoji: "📚", key: "booksMusic" },
  "libros y musica": { emoji: "📚", key: "booksMusic" },
  "libros": { emoji: "📚", key: "booksMusic" },
  "música": { emoji: "🎵", key: "booksMusic" },
  "musica": { emoji: "🎵", key: "booksMusic" },
  "decoración": { emoji: "🖼️", key: "decor" },
  "decoracion": { emoji: "🖼️", key: "decor" },
  "documentos y objetos importantes": { emoji: "📄", key: "documents" },
  "documentos": { emoji: "📄", key: "documents" },
  "papeles": { emoji: "📄", key: "documents" },
  "salud y cuidado personal": { emoji: "🩹", key: "healthCare" },
  "salud": { emoji: "🩹", key: "healthCare" },
  "cuidado personal": { emoji: "🩹", key: "healthCare" },
  "mascotas": { emoji: "🐶", key: "pets" },
  "mascota": { emoji: "🐶", key: "pets" },
  "vehículos": { emoji: "🚗", key: "vehicles" },
  "vehiculos": { emoji: "🚗", key: "vehicles" },
  "coche": { emoji: "🚗", key: "vehicles" },
  "auto": { emoji: "🚗", key: "vehicles" },
  "colecciones y objetos de valor": { emoji: "💎", key: "collections" },
  "colecciones": { emoji: "💎", key: "collections" },
  "otros": { emoji: "📦", key: "other" },
  // sinónimos de categorías antiguas o de plantillas, ya fuera del catálogo
  // por defecto pero que pueden seguir en hogares existentes
  "comida": { emoji: "🍎", key: "food" },
  "viajes": { emoji: "✈️", key: "travel" },
  "viaje": { emoji: "✈️", key: "travel" },
  "regalos": { emoji: "🎁", key: "gifts" },
  "tecnología": { emoji: "📱", key: "technology" },
  "tecnologia": { emoji: "📱", key: "technology" },
  "videojuegos": { emoji: "🎮", key: "videogames" },
  "navidad": { emoji: "🎄", key: "christmas" },
  "belleza": { emoji: "💄", key: "beauty" },
  "medicinas": { emoji: "💊", key: "medicine" },
  "jardín": { emoji: "🪴", key: "garden" },
  "jardin": { emoji: "🪴", key: "garden" },
  "bebé": { emoji: "🍼", key: "baby" },
  "bebe": { emoji: "🍼", key: "baby" },
  "limpieza": { emoji: "🧽", key: "cleaning" },
  "oficina": { emoji: "🖇️", key: "office" },
};

export const OBJECT_CATEGORY_EMOJI_FALLBACK = "🏷️";

/** Emoji de una categoría de objetos (texto libre). */
export function objectCategoryEmoji(name) {
  if (!name) return OBJECT_CATEGORY_EMOJI_FALLBACK;
  const key = String(name).trim().toLowerCase();
  return OBJECT_CATEGORY_META[key]?.emoji || OBJECT_CATEGORY_EMOJI_FALLBACK;
}

/**
 * Etiqueta localizada de una categoría de objetos (`objectCategory.<key>`
 * en i18n.js). El valor guardado sigue en español; si no está en el
 * catálogo (una categoría personalizada) se devuelve tal cual, igual que
 * `categoryLabel` en Economía.
 */
export function objectCategoryLabel(name, t) {
  if (!name) return "";
  const meta = OBJECT_CATEGORY_META[String(name).trim().toLowerCase()];
  return meta && t ? t(`objectCategory.${meta.key}`) : name;
}
