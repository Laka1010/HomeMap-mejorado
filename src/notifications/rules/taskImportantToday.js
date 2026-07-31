function isHighPriority(priority) {
  return ["alta", "high", "urgent"].includes((priority || "").toLowerCase());
}

export const rule = {
  id: "task_today_important",
  category: "organizacion",
  evaluate({ state, today }) {
    const todayKey = today.toISOString().slice(0, 10);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    return tasks
      .filter((t) => t.status === "pending" && t.date === todayKey && isHighPriority(t.priority))
      .map((t) => ({
        type: rule.id,
        category: rule.category,
        priority: "important",
        dedupeKey: `task_today:${t.id}`,
        title: `Hoy toca: ${t.title}`,
        body: t.description || "Marcada como importante para hoy.",
        entityRef: { type: "task", id: t.id },
        action: { type: "complete_task", label: "Completar tarea", payload: { taskId: t.id } },
      }));
  },
};
