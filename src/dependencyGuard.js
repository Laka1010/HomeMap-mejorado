/**
 * Sistema reutilizable de dependencias entre acciones.
 *
 * Filosofía: "nunca bloquear al usuario si la aplicación puede ayudarle a
 * continuar". Antes de abrir el modal de una acción, se comprueba si le
 * falta un prerrequisito (una habitación, una lista de la compra, un
 * hogar...); si falta, en vez de abrir esa acción se muestra un asistente
 * mínimo para crear el prerrequisito, y al terminar se reabre la acción
 * original automáticamente (ver `openModal` en src/App.jsx).
 *
 * Añadir una nueva dependencia = una entrada en DEPENDENCY_RULES + (si el
 * tipo de prerrequisito es nuevo) una entrada en MISSING_META. No requiere
 * tocar App.jsx.
 */

export const DEPENDENCY_RULES = {
  addObject: { resource: "rooms", missing: "room" },
  addContainer: { resource: "rooms", missing: "room" },
  addZone: { resource: "rooms", missing: "room" },
  addShopping: { resource: "shoppingLists", missing: "shoppingList" },
  addBill: { resource: "homes", missing: "house" },
  addExpense: { resource: "homes", missing: "house" },
  addMovement: { resource: "homes", missing: "house" },
};

// NOTE: title/description/cta hold i18n key paths (not literal text) because
// this module has no access to the React i18n context. DependencyGateModal
// and WelcomeGate run these through t() before rendering.
export const MISSING_META = {
  room: {
    icon: "🏠",
    title: "dependencyGate.roomTitle",
    description: "dependencyGate.roomDescription",
    cta: "dependencyGate.roomCta",
    createModal: "addRoom",
  },
  shoppingList: {
    icon: "🛒",
    title: "dependencyGate.shoppingListTitle",
    description: "dependencyGate.shoppingListDescription",
    cta: "dependencyGate.shoppingListCta",
    createModal: "addShoppingList",
  },
  house: {
    icon: "🏡",
    title: "dependencyGate.houseTitle",
    description: "dependencyGate.houseDescription",
    createModal: "houseGate",
  },
};

/**
 * Devuelve la meta del prerrequisito que falta para `actionType`, o `null`
 * si no depende de nada o si el prerrequisito ya está cumplido.
 * `ctx` debe tener las colecciones referenciadas por `resource` (p. ej.
 * `{ rooms, shoppingLists, homes }`).
 */
export function checkDependency(actionType, ctx) {
  const rule = DEPENDENCY_RULES[actionType];
  if (!rule) return null;
  const count = ctx[rule.resource]?.length || 0;
  return count > 0 ? null : MISSING_META[rule.missing];
}
