import { useState } from "react";
import { Calendar, Receipt, RotateCcw, Store, Trash2 } from "lucide-react";
import { getReceiptSignedUrl } from "../../services/receiptService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { intlLocale } from "../../utils/dates";

function formatDate(dateStr, locale) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(intlLocale(locale), { day: "2-digit", month: "short", year: "numeric" });
}

export function ShoppingHistory({ purchases = [], onRepeat, onDelete }) {
  const { t, locale } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [confirmingId, setConfirmingId] = useState(null);
  const [openingReceiptId, setOpeningReceiptId] = useState(null);

  const openReceipt = async (purchase) => {
    setOpeningReceiptId(purchase.id);
    try {
      const url = await getReceiptSignedUrl(purchase.receiptImagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error abriendo la foto del ticket:", error);
    } finally {
      setOpeningReceiptId(null);
    }
  };

  if (purchases.length === 0) {
    return (
      <div className="hm-card hm-card--p24 hm-card--center">
        <Calendar size={26} style={{ color: "var(--accent)", marginBottom: 10 }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("shoppingHistory.emptyTitle")}</div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("shoppingHistory.emptySubtitle")}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {purchases.map((purchase) => {
        const confirming = confirmingId === purchase.id;
        return (
          <div key={purchase.id} className="hm-card hm-card--p16">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14.5 }}>
                  <Calendar size={14} style={{ color: "var(--ink-soft)" }} />
                  {formatDate(purchase.completedAt, locale)}
                </div>
                {purchase.store ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                    <Store size={12} /> {purchase.store}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {purchase.amount ? (
                  <div className="hm-mono" style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(purchase.amount)}</div>
                ) : null}
                {onDelete ? (
                  <button
                    className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger"
                    onClick={() => setConfirmingId(purchase.id)}
                    aria-label={t("shoppingHistory.deleteAria")}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-soft)" }}>
              {(purchase.items || []).map((item, i) => (
                <span key={i}>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                  {i < purchase.items.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>

            {purchase.receiptImagePath ? (
              <button
                className="hm-btn hm-btn-ghost hm-btn--compact"
                style={{ marginTop: 8, paddingLeft: 0 }}
                onClick={() => openReceipt(purchase)}
                disabled={openingReceiptId === purchase.id}
              >
                <Receipt size={13} /> {openingReceiptId === purchase.id ? t("shoppingHistory.opening") : t("shoppingHistory.viewReceipt")}
              </button>
            ) : null}

            {confirming ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "var(--danger)", flex: 1 }}>{t("shoppingHistory.confirmDelete")}</span>
                <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setConfirmingId(null)}>{t("shoppingHistory.no")}</button>
                <button
                  className="hm-btn hm-btn--danger hm-btn--compact"
                  onClick={() => { setConfirmingId(null); onDelete(purchase.id); }}
                >
                  {t("common.yes")}
                </button>
              </div>
            ) : (
              <button
                className="hm-btn hm-btn-soft hm-btn--full"
                style={{ marginTop: 12 }}
                onClick={() => onRepeat && onRepeat(purchase)}
              >
                <RotateCcw size={14} /> {t("shoppingHistory.repeatPurchase")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
