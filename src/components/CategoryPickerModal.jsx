import { useState } from "react";
import { X, Check, Plus } from "lucide-react";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";

/**
 * Selector de categoría en bottom sheet: lista de filas (emoji + nombre +
 * check), mismo lenguaje visual que `OptionSheet` / `CurrencyPickerModal` —
 * no la cuadrícula de tarjetas de antes, que con más de una decena de
 * categorías de Economía se veía como un muro de cajas.
 *
 * Solo presentación: recibe las opciones ya resueltas (con su emoji y su
 * etiqueta traducida) y devuelve el `value` elegido por `onSelect`.
 *
 * @param {string}  title      Título del sheet.
 * @param {string}  value      Valor seleccionado actualmente.
 * @param {Array<{value:string,label:string,emoji:string}>} options
 * @param {(value:string)=>void} onSelect
 * @param {()=>void} onClose
 * @param {()=>void} [onAddNew] Si se pasa, añade una fila "Nueva" al final.
 */
export function CategoryPickerModal({ title, value, options = [], onSelect, onClose, onAddNew }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [pending, setPending] = useState(null);

  const pick = (next) => {
    if (pending) return;
    if (next === value) { onClose(); return; }
    setPending(next);
    // Deja ver el estado seleccionado un instante antes de cerrar.
    setTimeout(() => onSelect(next), 160);
  };

  const selected = pending ?? value;
  const rowCount = options.length + (onAddNew ? 1 : 0);

  return (
    <div className="hm-modal-overlay" onClick={() => { if (isSuppressingClick()) return; onClose(); }}>
      <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>

        <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="hm-display" style={{ fontSize: 26, fontWeight: 700 }}>{title || t("addMovement.categoryLabel")}</div>
          <button
            className="hm-btn hm-btn-ghost hm-justify-center"
            style={{ width: 36, height: 36, minHeight: 36, padding: 0, borderRadius: "50%", background: "var(--surface-alt)", flexShrink: 0 }}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="hm-modal-body" style={{ paddingTop: 0 }}>
          <div className="hm-card" style={{ overflow: "hidden" }}>
            {options.map((opt, idx) => {
              const isSelected = opt.value === selected;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!!pending}
                  onClick={() => pick(opt.value)}
                  aria-pressed={isSelected}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom: idx < rowCount - 1 ? "1px solid var(--border)" : "none",
                    cursor: pending ? "default" : "pointer",
                    textAlign: "left",
                    color: "var(--ink)",
                    font: "inherit",
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, width: 24, textAlign: "center" }} aria-hidden="true">{opt.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", flexShrink: 0 }}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}

            {onAddNew && (
              <button
                type="button"
                disabled={!!pending}
                onClick={onAddNew}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                  background: "transparent", border: "none", cursor: pending ? "default" : "pointer",
                  textAlign: "left", color: "var(--ink-soft)", font: "inherit",
                }}
              >
                <span style={{ width: 24, height: 24, flexShrink: 0, display: "grid", placeItems: "center" }} aria-hidden="true"><Plus size={16} /></span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15 }}>{t("wizard.stepCategoryNew")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
