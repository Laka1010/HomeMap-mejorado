import { useEffect, useRef, useState } from "react";
import { checkDependency } from "../dependencyGuard";

/**
 * Modal activo, toast ("notice"), diálogo de confirmación y la pantalla de
 * detalle de miembro (que se apila aparte del modal normal, ver
 * `viewingMember` más abajo). `state`/`homes` se reciben como parámetros
 * porque `openModal` los necesita para `checkDependency` y cambian en cada
 * render, igual que antes de extraer este hook.
 */
export function useAppModals(state, homes) {
  const [modal, setModal] = useState(null); // {type, payload}
  const [notice, setNotice] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // {title, message, onConfirm, onCancel}
  /**
   * Se guarda aparte del `modal` normal (no como otro `modal.type`) para que
   * la pantalla de información del miembro se apile encima de "Configuración
   * de la casa" en vez de sustituirla — al cerrarla, la lista de miembros
   * sigue abierta detrás, tal como se dejó.
   */
  const [viewingMember, setViewingMember] = useState(null);
  const noticeTimerRef = useRef(null);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  const showNotice = (message, action) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ message, action: action || null });
    noticeTimerRef.current = setTimeout(() => setNotice(null), action ? 4200 : 2600);
  };

  const openModal = (type, payload, opts) => {
    const missing = checkDependency(type, { rooms: state?.rooms, shoppingLists: state?.shoppingLists, homes });
    if (missing) {
      setModal({ type: "dependencyGate", payload: { missing, target: { type, payload } } });
      return;
    }
    setModal({ type, payload, returnTo: opts?.returnTo });
  };
  // Vuelve a la pantalla de la que se vino (p.ej. Miembros/Compartir casa
  // abiertos desde Perfil deben devolver a Perfil, no saltar a Inicio) en vez
  // de cerrar del todo, cuando el modal se abrió con `returnTo`.
  const closeModal = () => setModal((current) => (current?.returnTo ? { type: current.returnTo } : null));

  return {
    modal, setModal, openModal, closeModal,
    notice, setNotice, showNotice,
    confirmDialog, setConfirmDialog,
    viewingMember, setViewingMember,
  };
}
