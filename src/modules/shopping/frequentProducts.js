const MIN_PURCHASE_COUNT = 2;
const DEFAULT_LIMIT = 8;

/**
 * Productos más comprados por esta casa, por estadística pura sobre
 * shoppingPurchases (nada de IA): cuenta cuántas veces se ha comprado cada
 * producto y devuelve los más frecuentes. Un producto solo cuenta como
 * "frecuente" si se ha comprado al menos `minCount` veces — una sola compra
 * no es un hábito, es una casualidad.
 *
 * Se usa tanto para sugerir mientras se está comprando (ver
 * ShoppingModule.jsx) como al crear una lista nueva (ver
 * AddShoppingListModal en App.jsx) — misma regla, un único sitio.
 */
export function computeFrequentProducts(purchases = [], { excludeNames = [], minCount = MIN_PURCHASE_COUNT, limit = DEFAULT_LIMIT } = {}) {
  const excluded = new Set(excludeNames.map((name) => (name || "").trim().toLowerCase()));
  const counts = new Map();

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      const key = (item.name || "").trim().toLowerCase();
      if (!key) return;
      const current = counts.get(key) || { name: item.name, category: item.category, count: 0 };
      current.count += 1;
      counts.set(key, current);
    });
  });

  return Array.from(counts.values())
    .filter((c) => c.count >= minCount && !excluded.has(c.name.trim().toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
