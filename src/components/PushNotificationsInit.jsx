import { useEffect } from "react";
import { pushNotificationsService } from "../services/pushNotificationsService";

/**
 * Componente sin UI (Fase 7) — inicializa el registro de notificaciones
 * push nativas una vez hay sesión. Aislado a propósito: no toca ningún
 * otro estado de App.jsx, solo se monta junto al resto de utilidades
 * siempre activas (como ToastHost).
 */
export function PushNotificationsInit({ userId }) {
  useEffect(() => {
    if (!userId) return;
    pushNotificationsService.init();
  }, [userId]);

  return null;
}
