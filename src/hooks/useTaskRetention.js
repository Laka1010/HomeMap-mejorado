import { useEffect, useRef } from "react";
import { taskService, DEFAULT_TASK_RETENTION_DAYS } from "../services/taskService";

/**
 * Borra tareas marcadas como hechas una vez pasan los días de retención
 * configurables (state.settings.taskRetentionDays). Reevalúa al cambiar el
 * estado y además periódicamente, para cubrir el caso de la app abierta
 * cruzando el límite de días sin que el usuario toque nada. El ref evita
 * cerrar sobre un ajuste obsoleto.
 */
export function useTaskRetention(state, dispatch, activeHomeId, loaded) {
  const taskRetentionRef = useRef(DEFAULT_TASK_RETENTION_DAYS);
  taskRetentionRef.current = Number(state?.settings?.taskRetentionDays) || DEFAULT_TASK_RETENTION_DAYS;

  const cleanupExpiredTasks = () => {
    const cutoff = Date.now() - taskRetentionRef.current * 24 * 60 * 60 * 1000;
    let removedIds = [];
    dispatch((s) => {
      const tasks = Array.isArray(s.tasks) ? s.tasks : [];
      const keep = [];
      removedIds = [];
      tasks.forEach((task) => {
        if (task.status === "done" && task.completedAt && new Date(task.completedAt).getTime() <= cutoff) {
          removedIds.push(task.id);
        } else {
          keep.push(task);
        }
      });
      if (removedIds.length === 0) return s;
      return { ...s, tasks: keep };
    });
    removedIds.forEach((id) => {
      taskService.deleteTask(id).catch((error) => console.error("Error eliminando tarea vencida:", error));
    });
  };

  useEffect(() => {
    if (!activeHomeId || !loaded || !state) return;
    cleanupExpiredTasks();
  }, [state?.tasks, state?.settings?.taskRetentionDays, activeHomeId, loaded]);

  useEffect(() => {
    if (!activeHomeId) return;
    const interval = setInterval(cleanupExpiredTasks, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeHomeId]);
}
