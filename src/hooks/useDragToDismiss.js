import { useEffect, useRef, useState } from "react";

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
    setTimeout(() => { suppressClickRef.current = false; }, 400);
    if (dragInfo.current.y > threshold) {
      setDragY(window.innerHeight);
      setTimeout(() => onDismiss(), 220);
    } else {
      setDragY(0);
    }
  };

  useEffect(() => {
    const el = handleRef.current;
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
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    startDrag(e.clientY);
    const onMove = (ev) => moveDrag(ev.clientY);
    const onUp = () => {
      endDrag();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
    handleRef,
    handleMouseDown,
    isSuppressingClick: () => suppressClickRef.current,
    sheetStyle: {
      transform: dragY ? `translateY(${dragY}px)` : undefined,
      transition: isDragging ? "none" : "transform .22s cubic-bezier(.22,1,.36,1)",
      animation: entranceDone ? "none" : undefined,
    },
  };
}
