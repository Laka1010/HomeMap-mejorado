import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../../utils/portalTarget";
import { Check, PartyPopper, Receipt, X } from "lucide-react";
import { getCategoryIcon } from "./shoppingMeta";
import { useTranslation } from "../../i18n";

/**
 * Modo compra: pantalla grande pensada para usar en el supermercado con una
 * mano — pocos toques, texto grande, progreso siempre visible. Reutiliza
 * onToggle (mismo togglePurchased que la vista normal de la lista) para no
 * duplicar la lógica de marcar productos.
 */
export function ShoppingCheckoutMode({ items, onToggle, onFinish, onClose, onScanReceipt }) {
  const { t } = useTranslation();
  const [store, setStore] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  const pending = useMemo(() => items.filter((i) => !i.completed), [items]);
  const completed = useMemo(() => items.filter((i) => i.completed), [items]);
  const total = items.length;

  useEffect(() => {
    if (total > 0 && pending.length === 0) setCelebrate(true);
  }, [pending.length, total]);

  const finish = () => {
    onFinish(completed, store.trim());
  };

  return createPortal(
    <div
      className="hm-fade-in"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("shoppingCheckout.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700 }}>{t("shoppingCheckout.title")}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {t("shoppingCheckout.remaining", { pending: pending.length, total })}
          </div>
        </div>
      </div>

      <div style={{ height: 6, background: "var(--surface-alt)" }}>
        <div
          style={{
            height: "100%", background: "var(--accent)", borderRadius: 999,
            width: total ? `${(completed.length / total) * 100}%` : "0%",
            transition: "width .3s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>

      {celebrate ? (
        <div className="hm-fade-in" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <PartyPopper size={48} style={{ color: "var(--accent)" }} />
          <div className="hm-display" style={{ fontSize: 24, fontWeight: 700 }}>{t("shoppingCheckout.completedTitle")}</div>
          <div style={{ color: "var(--ink-soft)", fontSize: 14, maxWidth: 320 }}>{t("shoppingCheckout.completedSubtitle")}</div>
          <input
            className="hm-input"
            style={{ maxWidth: 280 }}
            placeholder={t("shoppingCheckout.storePlaceholder")}
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="hm-btn hm-btn-primary" style={{ minWidth: 200 }} onClick={finish}>
              {t("shoppingCheckout.finish")}
            </button>
            {onScanReceipt ? (
              <button className="hm-btn hm-btn-soft" onClick={() => onScanReceipt(completed)}>
                <Receipt size={15} /> {t("shoppingCheckout.scanReceipt")}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="hm-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className="hm-tap"
                style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  minHeight: 68, padding: "12px 16px", borderRadius: 16,
                  border: "1px solid var(--border)",
                  background: item.completed ? "var(--success-soft)" : "var(--surface)",
                  opacity: item.completed ? 0.7 : 1,
                  transition: "background .2s ease, opacity .2s ease",
                  textAlign: "left", cursor: "pointer", color: "var(--ink)",
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `2px solid ${item.completed ? "var(--success)" : "var(--border)"}`,
                    background: item.completed ? "var(--success)" : "transparent",
                    transition: "transform .18s cubic-bezier(.2,.9,.3,1.2), background .18s ease",
                    transform: item.completed ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {item.completed ? <Check size={18} color="#fff" /> : null}
                </div>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{getCategoryIcon(item.category)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 16.5, fontWeight: 700,
                    textDecoration: item.completed ? "line-through" : "none",
                    color: item.completed ? "var(--ink-soft)" : "var(--ink)",
                  }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("shoppingCheckout.quantityUnit", { count: item.quantity || 1 })}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <button className="hm-btn hm-btn-primary hm-btn--full" disabled={completed.length === 0} onClick={finish}>
              {t("shoppingCheckout.finish")} {completed.length > 0 ? `(${completed.length})` : ""}
            </button>
          </div>
        </>
      )}
    </div>,
    getPortalTarget()
  );
}
