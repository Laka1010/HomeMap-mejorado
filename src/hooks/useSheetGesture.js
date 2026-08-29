import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gesto vertical para una hoja inferior con DOS resultados según la dirección:
 * arrastrar hacia abajo la cierra, arrastrar hacia arriba la expande. Es el
 * hermano bidireccional de useDragToDismiss (que solo mira hacia abajo) y
 * comparte su mismo plumbing touch/mouse y el arreglo animación-vs-transform.
 *
 * Uso: `handleRef` al elemento arrastrable (tirador + cabecera) y `sheetStyle`
 * al contenedor que se mueve.
 */
export function useSheetGesture(onClose, onExpand, { threshold = 80, entranceDelay = 360 } = {}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startY: 0, y: 0, active: false });
  const suppressClickRef = useRef(false);
  const handleRef = useRef(null);
  const closeTimerRef = useRef(null);
  const suppressTimerRef = useRef(null);

  const startDrag = (clientY) => {
    dragInfo.current = { startY: clientY, y: 0, active: true };
    setIsDragging(true);
  };
  const moveDrag = (clientY) => {
    if (!dragInfo.current.active) return;
    let delta = clientY - dragInfo.current.startY;
    // Hacia arriba con algo de resistencia: no hace falta recorrer toda la
    // pantalla para expandir, y evita que la hoja "salte" fuera.
    if (delta < 0) delta = Math.max(delta / 1.6, -140);
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

    const y = dragInfo.current.y;
    if (y > threshold) {
      setDragY(window.innerHeight);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => onClose(), 200);
    } else if (y < -threshold) {
      setDragY(0);
      onExpand();
    } else {
      setDragY(0);
    }
  };

  const [handleEl, setHandleEl] = useState(null);
  const setHandleRef = useCallback((node) => {
    handleRef.current = node;
    setHandleEl(node);
  }, []);

  useEffect(() => {
    const el = handleEl;
    if (!el) return;
    const onTouchStart = (e) => { e.preventDefault(); startDrag(e.touches[0].clientY); };
    const onTouchMove = (e) => { if (dragInfo.current.active) e.preventDefault(); moveDrag(e.touches[0].clientY); };
    const onTouchEnd = (e) => { e.preventDefault(); endDrag(); };
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
    const onUp = () => { endDrag(); cleanup(); };
    mouseCleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    return () => {
      mouseCleanupRef.current?.();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  // La animación de entrada (hmSheetIn, fill-mode:both) deja su transform vivo
  // y pisaría el transform en línea del arrastre; se apaga al terminar.
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEntranceDone(true), entranceDelay);
    return () => clearTimeout(timer);
  }, [entranceDelay]);

  return {
    dragY,
    isDragging,
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
