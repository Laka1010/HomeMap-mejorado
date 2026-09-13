import { useState } from "react";
import { Package, Receipt, Home as HomeIcon, Palette, Sparkles, Lock, Bot } from "lucide-react";
import { useTranslation } from "../../i18n";
import { WidgetCard } from "../dashboard/widgets/WidgetCard";

/**
 * Hub de Haven IA: presenta las 4 funciones Premium (sección 1 del pedido)
 * y el interruptor de "Premium — Prueba" (sección 9). Ninguna función real
 * se implementa aquí todavía -- cada tarjeta se activa fase a fase (ver
 * plan) y hasta entonces muestra "Próximamente". Reutiliza WidgetCard (la
 * misma cáscara que los widgets de Inicio) y las clases hm-* existentes: no
 * se introduce ningún sistema de diseño nuevo.
 */
const FEATURES = [
  { key: "consumables", icon: Package, featureFlag: "ai_consumables" },
  { key: "receipts", icon: Receipt, featureFlag: "receipt_scanner" },
  { key: "multipleHomes", icon: HomeIcon, featureFlag: "multiple_homes" },
  { key: "icons", icon: Palette, featureFlag: "premium_icons" },
  { key: "assistant", icon: Bot, featureFlag: "ai_assistant" },
];

export function HavenIAHub({ subscriptionStatus, onActivateTrial, showNotice, actions = {} }) {
  const { t } = useTranslation();
  const [activating, setActivating] = useState(false);
  const isPremium = subscriptionStatus === "trial" || subscriptionStatus === "premium";

  const statusLabel = {
    free: t("havenIA.statusFree"),
    trial: t("havenIA.statusTrial"),
    premium: t("havenIA.statusPremium"),
    expired: t("havenIA.statusExpired"),
  }[subscriptionStatus] || t("havenIA.statusFree");

  const handleActivateTrial = async () => {
    setActivating(true);
    try {
      await onActivateTrial();
      showNotice(t("havenIA.activateTrialSuccess"));
    } catch (error) {
      console.error("Error activating premium trial:", error);
      showNotice(t("havenIA.activateTrialError"));
    } finally {
      setActivating(false);
    }
  };

  const handleFeatureClick = (key) => {
    if (!isPremium) {
      showNotice(t("havenIA.premiumRequired"));
      return;
    }
    const action = actions[key];
    if (action) action();
    else showNotice(t("havenIA.comingSoon"));
  };

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("havenIA.title")}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>{t("havenIA.subtitle")}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span className={"hm-badge " + (isPremium ? "hm-badge--success" : "hm-badge--neutral")}>
            <Sparkles size={12} /> {statusLabel}
          </span>
          {!isPremium && (
            <button
              className="hm-btn hm-btn-primary hm-btn--compact"
              style={{ fontSize: 12.5 }}
              onClick={handleActivateTrial}
              disabled={activating}
            >
              <Sparkles size={13} /> {t("havenIA.activateTrialButton")}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {FEATURES.map(({ key, icon: Icon }) => (
          <WidgetCard key={key} icon={Icon} title={t(`havenIA.features.${key}.title`)}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              {t(`havenIA.features.${key}.description`)}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              <span className="hm-badge hm-badge--accent" style={{ fontSize: 10.5 }}>{t("havenIA.premiumBadge")}</span>
              <button
                className="hm-btn hm-btn-soft hm-btn--compact"
                style={{ fontSize: 12 }}
                onClick={() => handleFeatureClick(key)}
              >
                {isPremium ? null : <Lock size={12} />} {t("havenIA.viewMore")}
              </button>
            </div>
          </WidgetCard>
        ))}
      </div>
    </div>
  );
}
