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
  // Igual que el ajuste de retención: el intervalo horario cierra sobre el
  // primer `state` que vio, así que la lista de tareas se lee de este ref y
  // no del argumento capturado.
  const tasksRef = useRef(null);
  tasksRef.current = state?.tasks;

  const cleanupExpiredTasks = () => {
    const cutoff = Date.now() - taskRetentionRef.current * 24 * 60 * 60 * 1000;
    const isExpired = (task) =>
      task.status === "done" && task.completedAt && new Date(task.completedAt).getTime() <= cutoff;

    // Los ids se calculan AQUÍ, sobre el estado actual, y no dentro del
    // updater de `dispatch`: ese updater es asíncrono (`setState`), así que
    // rellenar `removedIds` dentro de él y recorrerlo justo después solo
    // funcionaba cuando React aplicaba su optimización de evaluación
    // temprana (fiber sin updates en cola). Con cualquier update concurrente
    // el forEach corría sobre un array todavía vacío: las tareas
    // desaparecían de la pantalla pero nunca se borraban en el servidor, y
    // reaparecían al recargar.
    const tasks = Array.isArray(tasksRef.current) ? tasksRef.current : [];
    const removedIds = tasks.filter(isExpired).map((task) => task.id);
    if (removedIds.length === 0) return;

    // El filtrado dentro del updater se mantiene (sobre `s`, no sobre la
    // lista ya leída) para no pisar tareas creadas entre medias.
    dispatch((s) => {
      const current = Array.isArray(s.tasks) ? s.tasks : [];
      const keep = current.filter((task) => !isExpired(task));
      if (keep.length === current.length) return s;
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
