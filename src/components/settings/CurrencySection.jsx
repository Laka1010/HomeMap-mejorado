import { useState } from "react";
import { ChevronRight, Globe } from "lucide-react";
import { useTranslation } from "../../i18n";
import { getCurrenciesList } from "../../utils/currencyUtils";
import { CurrencyPickerModal } from "./CurrencyPickerModal";

export function CurrencySection({ currency, isAdmin, onChange, isLoading }) {
  const { t } = useTranslation();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const currencies = getCurrenciesList();
  const current = currencies.find((c) => c.code === currency);

  if (!isAdmin) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 16 }}>
            <Globe size={16} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{t("settings.currency") || "Moneda"}</div>
        </div>
        <div className="hm-card hm-card--p16" style={{ background: "var(--surface-alt)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }}>{current?.flag}</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {current?.name}
            <span style={{ marginLeft: 8, color: "var(--ink-soft)", fontSize: 12 }}>({currency})</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 16 }}>
          <Globe size={16} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("settings.currency") || "Moneda"}</div>
      </div>

      <button
        className="hm-card hm-card--p16"
        onClick={() => !isLoading && setPickerOpen(true)}
        disabled={isLoading}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.65 : 1,
          textAlign: "left",
          color: "var(--ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-alt)", display: "grid", placeItems: "center", fontSize: 19, flexShrink: 0 }}>{current?.flag}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{current?.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{current?.code} · {current?.symbol}</div>
          </div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
      </button>

      {isPickerOpen && (
        <CurrencyPickerModal
          currency={currency}
          onSelect={(code) => {
            onChange(code);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
