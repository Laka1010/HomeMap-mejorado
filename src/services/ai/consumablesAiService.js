import { safeRandomUUID } from "../../utils/uuid";
import { fuzzyMatch } from "../../utils/textMatch";

/**
 * Traduce el JSON crudo de la IA (modo "consumables" de vision-proxy) a
 * candidatos editables para la pantalla de revisión. Nunca se guarda nada
 * directamente desde aquí -- esto solo prepara datos para que el usuario los
 * confirme/edite/elimine antes de llamar a consumablesService.createConsumable
 * (sección 12 del pedido: "la app debe validar estos datos antes de
 * guardarlos", nunca confiar en el texto crudo del modelo).
 */

function toFiniteNumberOrNull(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Un candidato por producto detectado; `selected` decide si se guarda. */
export function buildConsumableCandidatesFromVisionResult(rawJson) {
  const products = Array.isArray(rawJson?.products) ? rawJson.products : [];
  return products.map((p) => ({
    id: safeRandomUUID(),
    name: typeof p?.name === "string" ? p.name.trim() : "",
    brand: typeof p?.brand === "string" ? p.brand.trim() : null,
    category: typeof p?.category === "string" ? p.category.trim() : null,
    isConsumable: p?.isConsumable !== false,
    unit: p?.unit === "units" ? "units" : "percent",
    currentQuantity: toFiniteNumberOrNull(p?.estimatedQuantity),
    minQuantity: null,
    visibleText: typeof p?.visibleText === "string" ? p.visibleText.trim() : null,
    sizeOrFormat: typeof p?.sizeOrFormat === "string" ? p.sizeOrFormat.trim() : null,
    condition: typeof p?.condition === "string" ? p.condition.trim() : null,
    nearlyEmpty: p?.nearlyEmpty === true,
    shouldRestock: p?.shouldRestock === true,
    autoAddToShopping: false,
    shoppingListId: null,
    // Selecciona por defecto todo lo que la IA cree que es un consumible;
    // lo demás queda visible pero desmarcado, nunca oculto -- el usuario
    // decide, no se descarta en silencio (pedido: "nunca añadir
    // automáticamente información incorrecta sin permitir revisarla").
    selected: p?.isConsumable !== false,
  }));
}

// Palabras clave de las categorías de consumibles que el propio pedido lista
// como ejemplo (detergente, papel higiénico, agua, leche...). Heurística
// determinista y sin coste de IA -- clasificar un ticket ya escaneado no
// justifica una segunda llamada al modelo solo para etiquetar nombres de
// producto que ya tenemos en texto.
const CONSUMABLE_KEYWORDS = [
  "detergente", "papel higienico", "papel de cocina", "agua", "leche",
  "pasta", "limpieza", "champu", "gel", "dentifrico", "pasta de dientes",
  "jabon", "suavizante", "lejia", "servilleta", "pañal", "compresa",
];

/** true si el nombre del producto se parece a alguna categoría de consumible habitual. */
export function looksLikeConsumable(name) {
  return CONSUMABLE_KEYWORDS.some((keyword) => fuzzyMatch(name, keyword));
}

/**
 * Mismo candidato que buildConsumableCandidatesFromVisionResult pero a
 * partir de las líneas de un ticket ya escaneado (sección 6 del pedido:
 * "¿quieres actualizar tu inventario con estos productos?"), sin datos de
 * visión (marca/condición/etc. quedan null -- el usuario los revisa igual
 * en la misma pantalla antes de guardar).
 */
export function buildConsumableCandidatesFromReceiptItems(items) {
  return (items || []).map((item) => ({
    id: safeRandomUUID(),
    name: typeof item?.name === "string" ? item.name.trim() : "",
    brand: null,
    category: null,
    isConsumable: true,
    unit: "units",
    currentQuantity: toFiniteNumberOrNull(item?.quantity) ?? 1,
    minQuantity: null,
    visibleText: null,
    sizeOrFormat: null,
    condition: null,
    nearlyEmpty: false,
    shouldRestock: false,
    autoAddToShopping: false,
    shoppingListId: null,
    selected: true,
  }));
}

/** Guardas mínimas antes de dejar que un candidato llegue a createConsumable. */
export function validateConsumableCandidate(candidate) {
  if (!candidate || typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    return "errors.consumableNameRequired";
  }
  if (candidate.currentQuantity != null && !Number.isFinite(Number(candidate.currentQuantity))) {
    return "errors.consumableQuantityInvalid";
  }
  return null;
}
