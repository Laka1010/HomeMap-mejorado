import { useState } from "react";
import { X, Check } from "lucide-react";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";

/**
 * Selector genérico en bottom sheet. Sustituye al `<select>` nativo (ese
 * desplegable del sistema que en escritorio se ve como un menú gris) por una
 * lista propia, con el mismo lenguaje visual que `CurrencyPickerModal` /
 * `CategoryPickerModal`.
 *
 * @param {string} title
 * @param {string} value
 * @param {Array<{value:string,label:string,hint?:string,emoji?:string}>} options
 * @param {(value:string)=>void} onSelect
 * @param {()=>void} onClose
 */
export function OptionSheet({ title, value, options = [], onSelect, onClose }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [pending, setPending] = useState(null);

  const pick = (next) => {
    if (pending) return;
    if (next === value) { onClose(); return; }
    setPending(next);
    setTimeout(() => onSelect(next), 160);
  };

  const selected = pending ?? value;

  return (
    <div className="hm-modal-overlay" onClick={() => { if (isSuppressingClick()) return; onClose(); }}>
      <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>

        <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="hm-display" style={{ fontSize: 24, fontWeight: 700 }}>{title || t("common.select") || ""}</div>
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
                  onClick={() => pick(opt.value)}
                  disabled={!!pending}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom: idx < options.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: pending ? "default" : "pointer",
                    textAlign: "left",
                    color: "var(--ink)",
                    font: "inherit",
                  }}
                >
                  {opt.emoji != null && (
                    <span style={{ fontSize: 20, flexShrink: 0, width: 24, textAlign: "center" }} aria-hidden="true">{opt.emoji}</span>
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                    {opt.hint && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 1 }}>{opt.hint}</span>}
                  </span>
                  {isSelected && (
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", flexShrink: 0 }}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
