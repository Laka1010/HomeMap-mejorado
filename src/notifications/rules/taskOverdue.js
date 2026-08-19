import { toLocalDateString } from "../../utils/dates";

export const rule = {
  id: "task_overdue",
  category: "organizacion",
  evaluate({ state, today }) {
    // Día local, no UTC: `task.date` es un día de calendario local, así que
    // con toISOString() en Madrid a partir de las 22:00 las tareas de hoy se
    // marcaban como vencidas. Ver utils/dates.js.
    const todayKey = toLocalDateString(today);
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
          // `title` en español es el respaldo que se guarda en la columna
          // title (filas legibles fuera de la interfaz); lo que se pinta es
          // titleKey + titleVars, traducido en cada render.
          title: days === 1
            ? "Tienes una tarea pendiente desde hace 1 día"
            : `Tienes una tarea pendiente desde hace ${days} días`,
          titleKey: days === 1 ? "notifications.taskOverdueTitleOne" : "notifications.taskOverdueTitle",
          titleVars: { days },
          body: t.title,
          entityRef: { type: "task", id: t.id },
          action: {
            type: "complete_task",
            label: "Completar tarea",
            labelKey: "notifications.completeTaskAction",
            payload: { taskId: t.id },
          },
        };
      });
  },
};
