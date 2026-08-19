export const rule = {
  id: "shopping_almost_done",
  category: "compras",
  evaluate({ state }) {
    const items = Array.isArray(state.shoppingItems) ? state.shoppingItems : [];
    const lists = Array.isArray(state.shoppingLists) ? state.shoppingLists : [];
    const candidates = [];
    lists.forEach((list) => {
      const pending = items.filter((i) => i.listId === list.id && !i.completed);
      if (pending.length >= 1 && pending.length <= 2) {
        const one = pending.length === 1;
        candidates.push({
          type: rule.id,
          category: rule.category,
          priority: "info",
          dedupeKey: `shopping_almost_done:${list.id}`,
          title: `Solo ${one ? "queda" : "quedan"} ${pending.length} producto${one ? "" : "s"} para completar "${list.name}"`,
          titleKey: one ? "notifications.shoppingAlmostDoneTitle" : "notifications.shoppingAlmostDoneTitlePlural",
          titleVars: { count: pending.length, list: list.name },
          // Cuerpo = nombres de productos que ha escrito el usuario: no se traduce.
          body: pending.map((p) => p.name).join(", "),
          entityRef: { type: "shoppingList", id: list.id },
          action: {
            type: "open_shopping",
            label: "Abrir compra",
            labelKey: "notifications.openShoppingAction",
            payload: { listId: list.id },
          },
        });
      }
    });
    return candidates;
  },
};
