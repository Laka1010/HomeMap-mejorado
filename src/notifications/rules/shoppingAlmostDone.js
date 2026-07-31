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
        candidates.push({
          type: rule.id,
          category: rule.category,
          priority: "info",
          dedupeKey: `shopping_almost_done:${list.id}`,
          title: `Solo quedan ${pending.length} producto${pending.length === 1 ? "" : "s"} para completar "${list.name}"`,
          body: pending.map((p) => p.name).join(", "),
          entityRef: { type: "shoppingList", id: list.id },
          action: { type: "open_shopping", label: "Abrir compra", payload: { listId: list.id } },
        });
      }
    });
    return candidates;
  },
};
