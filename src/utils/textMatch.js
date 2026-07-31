/**
 * Normaliza texto para búsquedas tolerantes: minúsculas, sin acentos,
 * sin espacios sobrantes. Así "Cargador" encuentra "cárgádor", "CARGADOR", etc.
 */
export function normalizeText(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // elimina diacríticos (acentos)
    .toLowerCase()
    .trim();
}

/** Coincidencia parcial, insensible a mayúsculas y acentos. */
export function fuzzyMatch(text, query) {
  if (!query) return true;
  return normalizeText(text).includes(normalizeText(query));
}

/** true si al menos uno de los campos coincide con la query. */
export function fuzzyMatchAny(fields, query) {
  return fields.some((f) => fuzzyMatch(f, query));
}
