import { useState } from "react";
import { X, Check, Plus } from "lucide-react";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";

/**
 * Selector de categoría en cuadrícula (bottom sheet). Cada categoría se pinta
 * como una tarjeta con el emoji arriba y el nombre debajo — el mismo lenguaje
 * visual que el paso "Categoría" del asistente de objetos.
 *
 * Solo presentación: recibe las opciones ya resueltas (con su emoji y su
 * etiqueta traducida) y devuelve el `value` elegido por `onSelect`.
 *
 * @param {string}  title      Título del sheet.
 * @param {string}  value      Valor seleccionado actualmente.
 * @param {Array<{value:string,label:string,emoji:string}>} options
 * @param {(value:string)=>void} onSelect
 * @param {()=>void} onClose
 * @param {()=>void} [onAddNew] Si se pasa, añade una tarjeta "Nueva" al final.
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
    setTimeout(() => onSelect(next), 180);
  };

  const selected = pending || value;

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
          <div className="hm-cat-grid">
            {options.map((opt) => {
              const isSelected = opt.value === selected;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`hm-cat-card${isSelected ? " is-selected" : ""}`}
                  disabled={!!pending}
                  onClick={() => pick(opt.value)}
                  aria-pressed={isSelected}
                >
                  <span className="hm-cat-emoji" aria-hidden="true">{opt.emoji}</span>
                  <span className="hm-cat-name">{opt.label}</span>
                  {isSelected && (
                    <span className="hm-cat-check"><Check size={12} strokeWidth={3} /></span>
                  )}
                </button>
              );
            })}

            {onAddNew && (
              <button
                type="button"
                className="hm-cat-card hm-cat-card--add"
                disabled={!!pending}
                onClick={onAddNew}
              >
                <span className="hm-cat-emoji" aria-hidden="true"><Plus size={20} /></span>
                <span className="hm-cat-name">{t("wizard.stepCategoryNew")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .hm-cat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .hm-cat-card {
          position: relative;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: var(--ink);
          transition: border-color .15s ease, background .15s ease, transform .15s ease;
        }
        .hm-cat-card:active { transform: scale(.97); }
        .hm-cat-card:disabled { cursor: default; }
        .hm-cat-card.is-selected {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--accent);
        }
        .hm-cat-card--add {
          border-style: dashed;
          color: var(--ink-soft);
        }
        .hm-cat-emoji {
          font-size: 24px;
          line-height: 1;
          display: grid;
          place-items: center;
          min-height: 28px;
        }
        .hm-cat-name {
          font-weight: 600;
          font-size: 12.5px;
          text-align: center;
          line-height: 1.25;
          word-break: break-word;
        }
        .hm-cat-check {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          display: grid;
          place-items: center;
        }
      `}</style>
    </div>
  );
}
