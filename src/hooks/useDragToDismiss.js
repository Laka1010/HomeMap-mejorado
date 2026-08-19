import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gesto de "arrastrar hacia abajo para cerrar" para hojas inferiores
 * (bottom sheets) — usado por el Modal genérico y por el centro de
 * acciones del botón "+". Centralizado aquí para no duplicar la lógica de
 * touch/mouse ni el arreglo del conflicto animación-vs-transform (ver
 * comentario más abajo).
 *
 * Uso: adjuntar `handleRef` al elemento que se puede arrastrar (el "handle"
 * visual, o toda la hoja) y `sheetStyle` al contenedor que debe moverse.
 */
export function useDragToDismiss(onDismiss, { threshold = 90, entranceDelay = 340 } = {}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startY: 0, y: 0, active: false });
  const suppressClickRef = useRef(false);
  const handleRef = useRef(null);

  // El cierre diferido (la hoja termina de bajar y ENTONCES se avisa) y el
  // reset de suppressClick son timeouts que hay que poder cancelar: si el
  // componente se desmonta entre medias (cambio de pestaña, navegación con el
  // botón atrás), `onDismiss` se llamaba sobre un árbol ya desmontado.
  const dismissTimerRef = useRef(null);
  const suppressTimerRef = useRef(null);

  const startDrag = (clientY) => {
    dragInfo.current = { startY: clientY, y: 0, active: true };
    setIsDragging(true);
  };
  const moveDrag = (clientY) => {
    if (!dragInfo.current.active) return;
    const delta = Math.max(0, clientY - dragInfo.current.startY);
    dragInfo.current.y = delta;
    setDragY(delta);
  };
  const endDrag = () => {
    if (!dragInfo.current.active) return;
    dragInfo.current.active = false;
    setIsDragging(false);
    suppressClickRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 400);
    if (dragInfo.current.y > threshold) {
      setDragY(window.innerHeight);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => onDismiss(), 220);
    } else {
      setDragY(0);
    }
  };

  // `handleEl` es estado y no solo una ref: el efecto de abajo depende de él,
  // así que los listeners se enganchan también cuando el "handle" aparece en
  // un render posterior (se monta condicionalmente, o dentro de un Suspense).
  // Con deps `[]` y `handleRef.current` leído una sola vez, esos casos se
  // quedaban sin gesto de arrastre para siempre.
  const [handleEl, setHandleEl] = useState(null);
  // useCallback con deps vacías: la identidad del callback ref tiene que ser
  // estable. Si cambiara en cada render, React lo desengancharía (llamándolo
  // con null) y lo volvería a enganchar en cada uno, quitando y poniendo los
  // listeners continuamente.
  const setHandleRef = useCallback((node) => {
    handleRef.current = node;
    setHandleEl(node);
  }, []);

  useEffect(() => {
    const el = handleEl;
    if (!el) return;
    const onTouchStart = (e) => {
      e.preventDefault();
      startDrag(e.touches[0].clientY);
    };
    const onTouchMove = (e) => {
      if (dragInfo.current.active) e.preventDefault();
      moveDrag(e.touches[0].clientY);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      endDrag();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [handleEl]);

  // Los listeners de mousemove/mouseup de un arrastre en curso solo se
  // quitaban dentro de `onUp` — si el componente se desmonta a mitad de un
  // arrastre (p. ej. ActionCenter cerrándose por cambio de pestaña mientras
  // se arrastra el tirador con ratón), esos listeners quedaban en `window`
  // para siempre, referenciando closures obsoletas. `mouseCleanupRef` deja
  // un cleanup pendiente que el efecto de abajo ejecuta también al desmontar.
  const mouseCleanupRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    startDrag(e.clientY);
    const onMove = (ev) => moveDrag(ev.clientY);
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      mouseCleanupRef.current = null;
    };
    const onUp = () => {
      endDrag();
      cleanup();
    };
    mouseCleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    return () => {
      mouseCleanupRef.current?.();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  // La animación de entrada (hmSheetIn/hmPop) usa animation-fill-mode:both,
  // así que su transform se queda "vivo" para siempre y pisa el transform
  // en línea del arrastre. Se apaga la animación en cuanto termina para que
  // el arrastre pueda controlar el transform sin competencia.
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEntranceDone(true), entranceDelay);
    return () => clearTimeout(timer);
  }, [entranceDelay]);

  return {
    dragY,
    isDragging,
    // Callback ref: se puede pasar a `ref=` igual que la ref de objeto de
    // antes, pero además avisa al efecto cuando el nodo aparece o cambia.
    handleRef: setHandleRef,
    handleMouseDown,
    isSuppressingClick: () => suppressClickRef.current,
    sheetStyle: {
      transform: dragY ? `translateY(${dragY}px)` : undefined,
      transition: isDragging ? "none" : "transform .22s cubic-bezier(.22,1,.36,1)",
      animation: entranceDone ? "none" : undefined,
    },
  };
}
