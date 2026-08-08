import { taskService } from "../services/taskService";

/**
 * Registro acción -> handler para los botones rápidos de una notificación.
 * Cada handler reutiliza servicios/handlers ya existentes de la app (nunca
 * duplica lógica de negocio) — solo conecta la notificación con la acción
 * real. Añadir una acción nueva es añadir una entrada aquí.
 */
export function buildNotificationActionHandlers({ dispatch, openModal, goTo, setOrganizationTab }) {
  return {
    complete_task: (payload) => {
      dispatch((s) => ({
        ...s,
        tasks: (s.tasks || []).map((t) => (t.id === payload.taskId ? { ...t, status: "done" } : t)),
      }));
      taskService.updateTask(payload.taskId, { status: "done" }).catch((error) => {
        console.error("Error completando tarea desde notificación:", error);
      });
    },
    open_shopping: () => {
      setOrganizationTab("compras");
      goTo({ tab: "organizacion" });
    },
    log_expense: () => {
      openModal("addExpense", {});
    },
    open_calendar: () => {
      setOrganizationTab("calendario");
      goTo({ tab: "organizacion" });
    },
    open_house_settings: () => {
      openModal("houseSettings");
    },
  };
}
