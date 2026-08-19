import { toLocalDateString } from "../../utils/dates";

function isHighPriority(priority) {
  return ["alta", "high", "urgent"].includes((priority || "").toLowerCase());
}

export const rule = {
  id: "task_today_important",
  category: "organizacion",
  evaluate({ state, today }) {
    // Día local, no UTC — mismo motivo que en taskOverdue.js.
    const todayKey = toLocalDateString(today);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    return tasks
      .filter((t) => t.status === "pending" && t.date === todayKey && isHighPriority(t.priority))
      .map((t) => ({
        type: rule.id,
        category: rule.category,
        priority: "important",
        dedupeKey: `task_today:${t.id}`,
        title: `Hoy toca: ${t.title}`,
        titleKey: "notifications.taskTodayTitle",
        titleVars: { title: t.title },
        // Solo se traduce el texto por defecto: si la tarea tiene descripción
        // propia, esa la escribió el usuario y se muestra tal cual.
        body: t.description || "Marcada como importante para hoy.",
        ...(t.description ? {} : { bodyKey: "notifications.taskTodayBody" }),
        entityRef: { type: "task", id: t.id },
        action: {
          type: "complete_task",
          label: "Completar tarea",
          labelKey: "notifications.completeTaskAction",
          payload: { taskId: t.id },
        },
      }));
  },
};
