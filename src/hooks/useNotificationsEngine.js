import { useEffect, useRef, useState } from "react";
import { notificationsService } from "../services/notificationsService";
import { evaluateNotifications } from "../notifications/engine";

export function useNotificationsEngine(state, activeHomeId, userId, loaded) {
  const [notifications, setNotifications] = useState([]);

  const refreshNotifications = async () => {
    if (!activeHomeId || !userId) {
      setNotifications([]);
      return;
    }
    try {
      setNotifications(await notificationsService.fetchActive(activeHomeId, userId));
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  useEffect(() => {
    refreshNotifications();
  }, [activeHomeId, userId]);

  const markNotificationRead = async (id) => {
    try { await notificationsService.markRead(id); await refreshNotifications(); } catch (error) { console.error("Error marking notification read:", error); }
  };
  const archiveNotification = async (id) => {
    try { await notificationsService.archive(id); await refreshNotifications(); } catch (error) { console.error("Error archiving notification:", error); }
  };
  const deleteNotification = async (id) => {
    try { await notificationsService.remove(id); await refreshNotifications(); } catch (error) { console.error("Error deleting notification:", error); }
  };
  const snoozeNotification = async (id) => {
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    try { await notificationsService.snooze(id, until); await refreshNotifications(); } catch (error) { console.error("Error snoozing notification:", error); }
  };

  /**
   * Reevalúa el motor de notificaciones cuando cambia el estado de la casa
   * (reactivo, sin instrumentar cada handler existente) y además cada
   * cierto tiempo mientras la app sigue abierta, para capturar condiciones
   * que dependen solo del paso del tiempo (p.ej. una tarea que pasa a
   * vencida sin que el usuario haga nada). El ref evita cerrar sobre un
   * `state` obsoleto dentro del intervalo periódico.
   */
  const notificationEvalArgsRef = useRef(null);
  notificationEvalArgsRef.current = { state, houseId: activeHomeId, userId, settings: state?.settings?.notifications };

  useEffect(() => {
    if (!activeHomeId || !loaded || !state) return;
    const timeout = setTimeout(() => {
      evaluateNotifications(notificationEvalArgsRef.current).then(refreshNotifications).catch((error) => {
        console.error("Error evaluando notificaciones:", error);
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [state, activeHomeId, loaded]);

  useEffect(() => {
    if (!activeHomeId) return;
    const interval = setInterval(() => {
      evaluateNotifications(notificationEvalArgsRef.current).then(refreshNotifications).catch((error) => {
        console.error("Error evaluando notificaciones (periódico):", error);
      });
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeHomeId]);

  return {
    notifications,
    refreshNotifications,
    markNotificationRead,
    archiveNotification,
    deleteNotification,
    snoozeNotification,
  };
}
