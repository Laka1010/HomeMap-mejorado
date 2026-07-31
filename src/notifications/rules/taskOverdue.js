export const rule = {
  id: "task_overdue",
  category: "organizacion",
  evaluate({ state, today }) {
    const todayKey = today.toISOString().slice(0, 10);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    return tasks
      .filter((t) => t.status === "pending" && t.date && t.date < todayKey)
      .map((t) => {
        const days = Math.max(1, Math.floor((today - new Date(t.date)) / 86400000));
        const priority = days >= 3 ? "critical" : "important";
        return {
          type: rule.id,
          category: rule.category,
          priority,
          dedupeKey: `task_overdue:${t.id}`,
          title: `Tienes una tarea pendiente desde hace ${days} día${days === 1 ? "" : "s"}`,
          body: t.title,
          entityRef: { type: "task", id: t.id },
          action: { type: "complete_task", label: "Completar tarea", payload: { taskId: t.id } },
        };
      });
  },
};
