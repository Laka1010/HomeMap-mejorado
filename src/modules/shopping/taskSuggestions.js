/**
 * Sugerencias de producto a partir del título/descripción de una tarea, para
 * el botón de un toque "Añadir a la compra" en Tareas. Es una heurística por
 * palabras clave, no un parser de recetas: si el texto de la tarea no
 * coincide con ninguna palabra clave, se usa el propio título como nombre
 * del producto (el usuario puede renombrarlo después desde la lista).
 */

const KEYWORD_RULES = [
  { match: ["bombilla", "luz fundida", "farola"], items: ["Bombillas"], category: "Hogar" },
  { match: ["baño", "bano", "wc", "inodoro"], items: ["Limpiador de baño"], category: "Limpieza" },
  { match: ["cocina", "fregadero"], items: ["Limpiador multiusos"], category: "Limpieza" },
  { match: ["suelo", "fregar"], items: ["Fregasuelos"], category: "Limpieza" },
  { match: ["ropa", "lavadora", "colada"], items: ["Detergente"], category: "Limpieza" },
  { match: ["plantas", "regar"], items: ["Abono para plantas"], category: "Hogar" },
  { match: ["perro", "gato", "mascota"], items: ["Pienso"], category: "Mascotas" },
  { match: ["papel higienico", "papel higiénico"], items: ["Papel higiénico"], category: "Baño" },
];

function normalize(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Divide la descripción de una tarea en posibles ingredientes/artículos
 * cuando está escrita como lista (comas o saltos de línea). Uso pensado
 * para tareas tipo "Preparar una receta" con la lista de ingredientes en
 * la descripción — best effort, no interpreta cantidades ni unidades.
 */
function splitListLike(text) {
  if (!text) return [];
  const parts = text.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [];
}

/**
 * @returns {{ items: string[], category: string|null, isListSuggestion: boolean }}
 */
export function suggestShoppingItemsFromTask(task) {
  const haystack = normalize(`${task?.title || ""} ${task?.description || ""}`);

  for (const rule of KEYWORD_RULES) {
    if (rule.match.some((kw) => haystack.includes(normalize(kw)))) {
      return { items: rule.items, category: rule.category, isListSuggestion: false };
    }
  }

  const listItems = splitListLike(task?.description);
  if (listItems.length > 0) {
    return { items: listItems, category: null, isListSuggestion: true };
  }

  return { items: [task?.title || "Producto"], category: null, isListSuggestion: false };
}
