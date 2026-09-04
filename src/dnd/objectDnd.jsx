/* eslint-disable react-refresh/only-export-components -- módulo de contexto: expone el provider y sus hooks juntos a propósito */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../utils/portalTarget";
import { objectCategoryEmoji } from "../utils/categoryEmoji";

/**
 * Arrastrar-y-soltar objetos para moverlos de sitio. Pointer Events, un solo
 * camino para ratón y táctil, sin dependencias.
 *
 * - Táctil: se "coge" el objeto con una pulsación larga (~260 ms) sin mover el
 *   dedo. Si el dedo se desplaza antes, es scroll y no se activa.
 * - Ratón: se coge al arrastrar > 6 px.
 * - Mientras se arrastra, el scroll se bloquea (`body.hm-dnd-active`) y un
 *   "fantasma" sigue al puntero. Las zonas válidas se resaltan.
 *
 * El modal "Mover" del menú del objeto sigue existiendo como alternativa.
 */

const DndCtx = createContext(null);

const LONGPRESS_MS = 260;
const TOUCH_CANCEL_PX = 10;
const MOUSE_START_PX = 6;

export function ObjectDndProvider({ children }) {
  const [drag, setDrag] = useState(null); // { object, x, y }
  const [overId, setOverId] = useState(null);

  const targetsRef = useRef(new Map()); // id -> { getRect, onDrop, canDrop }
  const overRef = useRef(null);
  const draggingObjectRef = useRef(null);
  const suppressClickUntilRef = useRef(0);

  const registerTarget = useCallback((id, entry) => {
    targetsRef.current.set(id, entry);
    return () => {
      targetsRef.current.delete(id);
      if (overRef.current === id) {
        overRef.current = null;
        setOverId(null);
      }
    };
  }, []);

  const hitTest = (x, y, object) => {
    for (const [id, entry] of targetsRef.current) {
      const r = entry.getRect();
      if (!r) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        if (entry.canDrop && !entry.canDrop(object)) return null;
        return id;
      }
    }
    return null;
  };

  const api = useRef(null);
  api.current = {
    begin(object, x, y) {
      draggingObjectRef.current = object;
      overRef.current = null;
      document.body.classList.add("hm-dnd-active");
      setOverId(null);
      setDrag({ object, x, y });
    },
    move(x, y) {
      const object = draggingObjectRef.current;
      if (!object) return;
      const id = hitTest(x, y, object);
      if (id !== overRef.current) {
        overRef.current = id;
        setOverId(id);
      }
      setDrag((d) => (d ? { ...d, x, y } : d));
    },
    finish(commit) {
      const object = draggingObjectRef.current;
      document.body.classList.remove("hm-dnd-active");
      if (object && commit && overRef.current) {
        const entry = targetsRef.current.get(overRef.current);
        if (entry) {
          entry.onDrop(object);
          suppressClickUntilRef.current = Date.now() + 500;
        }
      } else if (object) {
        suppressClickUntilRef.current = Date.now() + 300;
      }
      draggingObjectRef.current = null;
      overRef.current = null;
      setOverId(null);
      setDrag(null);
    },
  };

  // El value SOLO cambia de identidad cuando cambian `draggingId` u `overId`
  // (no en cada movimiento del puntero: la posición se queda en `drag` y solo
  // la usa el fantasma que pinta este mismo provider). Si el value cambiara en
  // cada `pointermove`, el efecto de cada zona de destino se re-ejecutaría sin
  // parar y su limpieza borraría el `overId` recién puesto.
  const draggingId = drag?.object?.id ?? null;
  const value = useMemo(
    () => ({
      apiRef: api,
      draggingId,
      overId,
      registerTarget,
      isSuppressingClick: () => Date.now() < suppressClickUntilRef.current,
    }),
    [draggingId, overId, registerTarget],
  );

  return (
    <DndCtx.Provider value={value}>
      {children}
      {drag && createPortal(<DragGhost drag={drag} />, getPortalTarget())}
    </DndCtx.Provider>
  );
}

function DragGhost({ drag }) {
  return (
    <div
      style={{
        position: "fixed",
        left: drag.x,
        top: drag.y,
        // el "fantasma" va bien por encima del dedo/cursor (gap 32px) para que
        // no lo tape la mano y se lea la tarjeta que llevas.
        transform: "translate(-50%, calc(-100% - 32px))",
        pointerEvents: "none",
        zIndex: 9999,
        background: "var(--surface)",
        border: "1px solid var(--accent)",
        borderRadius: 12,
        boxShadow: "0 16px 36px rgba(0,0,0,0.26)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: 240,
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden="true">{objectCategoryEmoji(drag.object.category)}</span>
      <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
        {drag.object.name}
      </span>
    </div>
  );
}

export function useObjectDnd() {
  return useContext(DndCtx);
}

/**
 * Props para una fila de objeto arrastrable.
 * @returns {{ handlers: object, isDragging: boolean, guardClick: (fn)=>(e)=>void }}
 */
export function useDraggableObject(object) {
  const dnd = useObjectDnd();
  const st = useRef({ mode: null, x0: 0, y0: 0, timer: null });

  const onPointerDown = useCallback(
    (e) => {
      if (!dnd || e.button === 2) return;
      const s = st.current;
      s.x0 = e.clientX;
      s.y0 = e.clientY;

      const teardown = () => {
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        s.mode = null;
        window.removeEventListener("pointermove", onMove, { passive: false });
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancelEv);
      };

      const onMove = (ev) => {
        const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
        if (s.mode === "pending-touch") {
          if (dist > TOUCH_CANCEL_PX) teardown();
        } else if (s.mode === "pending-mouse") {
          if (dist > MOUSE_START_PX) {
            s.mode = "dragging";
            dnd.apiRef.current.begin(object, ev.clientX, ev.clientY);
          }
        } else if (s.mode === "dragging") {
          ev.preventDefault();
          dnd.apiRef.current.move(ev.clientX, ev.clientY);
        }
      };
      const onUp = () => {
        if (s.mode === "dragging") dnd.apiRef.current.finish(true);
        teardown();
      };
      const onCancelEv = () => {
        if (s.mode === "dragging") dnd.apiRef.current.finish(false);
        teardown();
      };

      if (e.pointerType === "touch" || e.pointerType === "pen") {
        s.mode = "pending-touch";
        s.timer = setTimeout(() => {
          s.timer = null;
          if (s.mode === "pending-touch") {
            s.mode = "dragging";
            try { navigator.vibrate?.(8); } catch { /* noop */ }
            dnd.apiRef.current.begin(object, s.x0, s.y0);
          }
        }, LONGPRESS_MS);
      } else {
        s.mode = "pending-mouse";
      }

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancelEv);
    },
    [dnd, object],
  );

  useEffect(
    () => () => {
      if (st.current.timer) clearTimeout(st.current.timer);
    },
    [],
  );

  const guardClick = useCallback(
    (fn) => (e) => {
      if (dnd?.isSuppressingClick()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      fn?.(e);
    },
    [dnd],
  );

  return {
    dragHandleProps: { onPointerDown, style: { touchAction: "pan-y" } },
    isDragging: dnd?.draggingId === object.id,
    guardClick,
  };
}

/**
 * Zona de destino. `onDrop(object)` recibe el objeto; `canDrop(object)` opcional.
 * @returns {{ ref: object, isOver: boolean }}
 */
export function useObjectDropTarget({ id, onDrop, canDrop, disabled }) {
  const dnd = useObjectDnd();
  const register = dnd?.registerTarget; // identidad estable (useCallback [])
  const ref = useRef(null);
  const cbRef = useRef({ onDrop, canDrop });
  cbRef.current = { onDrop, canDrop };

  useEffect(() => {
    if (!register || disabled || !id) return undefined;
    return register(id, {
      getRect: () => ref.current?.getBoundingClientRect() ?? null,
      onDrop: (obj) => cbRef.current.onDrop?.(obj),
      canDrop: (obj) => (cbRef.current.canDrop ? cbRef.current.canDrop(obj) : true),
    });
  }, [register, id, disabled]);

  return { ref, isOver: !disabled && dnd?.overId === id };
}
