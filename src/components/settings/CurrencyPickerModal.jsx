import { useState } from "react";
import { X, Check } from "lucide-react";
import { useTranslation } from "../../i18n";
import { getCurrenciesList } from "../../utils/currencyUtils";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

/**
 * Selector de moneda a pantalla completa (bottom sheet). Se abre desde la fila
 * compacta de CurrencySection; aquí se listan las 10 monedas directamente, sin
 * buscador (la lista es corta y cabe en una pantalla sin necesidad de filtrar).
 */
export function CurrencyPickerModal({ currency, onSelect, onClose }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [pendingCode, setPendingCode] = useState(null);
  const currencies = getCurrenciesList();

  const handlePick = (code) => {
    if (pendingCode || code === currency) {
      if (code === currency) onClose();
      return;
    }
    setPendingCode(code);
    // Deja ver el check verde un instante antes de cerrar (animación suave pedida en el diseño).
    setTimeout(() => onSelect(code), 220);
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(); }}>
      <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>

        <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="hm-display" style={{ fontSize: 26, fontWeight: 700 }}>{t("settings.currency")}</div>
            <div style={{ marginTop: 4, color: "var(--ink-soft)", fontSize: 14 }}>{t("settings.currencyPickerSubtitle")}</div>
          </div>
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
            {currencies.map((curr, idx) => {
              const isSelected = curr.code === (pendingCode || currency);
              return (
                <button
                  key={curr.code}
                  onClick={() => handlePick(curr.code)}
                  disabled={!!pendingCode}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom: idx < currencies.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: pendingCode ? "default" : "pointer",
                    textAlign: "left",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface-alt)", display: "grid", placeItems: "center", fontSize: 21, flexShrink: 0, overflow: "hidden" }}>
                    {curr.flag}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{curr.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 1 }}>{curr.code} · {curr.symbol}</div>
                  </div>
                  {isSelected && (
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--success-soft)", display: "grid", placeItems: "center", color: "var(--success)", flexShrink: 0 }}>
                      <Check size={15} strokeWidth={3} />
                    </div>
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
