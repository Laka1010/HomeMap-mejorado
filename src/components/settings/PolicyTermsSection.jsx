import { ShieldCheck, ClipboardList } from "lucide-react";
import { useTranslation } from "../../i18n";

export function PolicyTermsSection({ onOpenPrivacy, onOpenTerms }) {
  const { t } = useTranslation();

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <ShieldCheck size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.privacySection")}</h2>
        </div>
        <button className="hm-btn hm-btn-soft" onClick={onOpenPrivacy}>
          {t("settings.privacySection")}
        </button>
      </div>

      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <ClipboardList size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.termsSection")}</h2>
        </div>
        <button className="hm-btn hm-btn-soft" onClick={onOpenTerms}>
          {t("settings.termsSection")}
        </button>
      </div>
    </section>
  );
}
