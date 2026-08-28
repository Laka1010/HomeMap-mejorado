import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Trampa de foco para diálogos modales. El `<Modal>` compartido no movía el
 * foco al abrir, no lo devolvía al cerrar y no atrapaba el Tab — hallazgo
 * 🔴 de accesibilidad de AUDITORIA_HAVEN_1.0.md (#15).
 *
 * Uso:
 *   const ref = useFocusTrap({ onEscape: onClose });
 *   <div ref={ref} role="dialog" aria-modal="true"> ... </div>
 *
 * - Al montar: guarda el elemento con foco y mueve el foco al primer
 *   elemento enfocable del diálogo (o al propio contenedor).
 * - Tab / Shift+Tab: ciclan dentro del diálogo, sin salir.
 * - Escape: llama a `onEscape` si se pasa.
 * - Al desmontar: devuelve el foco al elemento que lo tenía antes.
 */
export function useFocusTrap({ onEscape } = {}) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  const setRef = useCallback((node) => {
    containerRef.current = node;
  }, []);

  useEffect(() => {
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (container) {
      const first = container.querySelector(FOCUSABLE);
      if (first instanceof HTMLElement) {
        first.focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        // Con modales anidados (p. ej. un Modal que abre un ConfirmDialog, que
        // también es un Modal) solo debe reaccionar el de más arriba: el
        // último `[role="dialog"]` en orden de documento.
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length && dialogs[dialogs.length - 1] !== containerRef.current) return;
        onEscapeRef.current?.(e);
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;

      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE),
      ).filter((el) => el instanceof HTMLElement && el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstEl || !containerRef.current.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const toRestore = previouslyFocused.current;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, []);

  return setRef;
}
