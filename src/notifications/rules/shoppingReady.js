const URGENT_THRESHOLD = 3;

export const rule = {
  id: "shopping_ready",
  category: "compras",
  evaluate({ state }) {
    const items = Array.isArray(state.shoppingItems) ? state.shoppingItems : [];
    const urgentPending = items.filter((i) => !i.completed && i.priority === "urgent");
    if (urgentPending.length < URGENT_THRESHOLD) return [];
    return [{
      type: rule.id,
      category: rule.category,
      priority: "important",
      dedupeKey: "shopping_ready",
      title: "Parece que ya tienes suficiente para hacer la compra",
      titleKey: "notifications.shoppingReadyTitle",
      body: `${urgentPending.length} productos marcados como muy necesarios.`,
      bodyKey: "notifications.shoppingReadyBody",
      bodyVars: { count: urgentPending.length },
      entityRef: { type: "shoppingItems" },
      action: {
        type: "open_shopping",
        label: "Abrir compra",
        labelKey: "notifications.openShoppingAction",
        payload: {},
      },
    }];
  },
};
