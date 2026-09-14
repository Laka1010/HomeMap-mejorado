import { useEffect, useState } from "react";
import { Package, Receipt, Home as HomeIcon, Palette, Sparkles, Lock, Bot } from "lucide-react";
import { useTranslation } from "../../i18n";
import { WidgetCard } from "../dashboard/widgets/WidgetCard";
import { premiumService, METERED_PREMIUM_FEATURES } from "../../services/premiumService";

/**
 * Hub de Haven IA: presenta las 5 funciones Premium y el interruptor de
 * "Premium — Prueba". Reutiliza WidgetCard (la misma cáscara que los widgets
 * de Inicio) y las clases hm-* existentes: no se introduce ningún sistema de
 * diseño nuevo.
 */
const FEATURES = [
  { key: "consumables", icon: Package, featureFlag: "ai_consumables" },
  { key: "receipts", icon: Receipt, featureFlag: "receipt_scanner" },
  { key: "multipleHomes", icon: HomeIcon, featureFlag: "multiple_homes" },
  { key: "icons", icon: Palette, featureFlag: "premium_icons" },
  { key: "assistant", icon: Bot, featureFlag: "ai_chat" },
];

/** Etiqueta corta por feature medida, para la línea "147 / 200 mensajes". */
const USAGE_UNIT_KEY = {
  ai_chat: "havenIA.usage.unitChat",
  ai_consumables: "havenIA.usage.unitConsumables",
  receipt_scanner: "havenIA.usage.unitReceipts",
};

export function HavenIAHub({ subscriptionStatus, onOpenPaywall, showNotice, actions = {} }) {
  const { t } = useTranslation();
  const [usageByFeature, setUsageByFeature] = useState({});
  const isPremium = subscriptionStatus === "trial" || subscriptionStatus === "premium";

  // Uso del ciclo actual para las 3 features medidas -- una sola vez al
  // hacerse Premium (o al reabrir el hub), no en cada render. Solo pinta
  // información, el bloqueo real de verdad lo hace siempre el servidor.
  useEffect(() => {
    if (!isPremium) {
      setUsageByFeature({});
      return;
    }
    let cancelled = false;
    Promise.all(
      METERED_PREMIUM_FEATURES.map((featureKey) =>
        premiumService.getPremiumUsage(featureKey).then((usage) => [featureKey, usage]).catch(() => [featureKey, null])
      )
    ).then((entries) => {
      if (!cancelled) setUsageByFeature(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [isPremium]);

  const statusLabel = {
    free: t("havenIA.statusFree"),
    trial: t("havenIA.statusTrial"),
    premium: t("havenIA.statusPremium"),
    expired: t("havenIA.statusExpired"),
  }[subscriptionStatus] || t("havenIA.statusFree");

  const handleFeatureClick = (key) => {
    if (!isPremium) {
      onOpenPaywall();
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
              onClick={onOpenPaywall}
            >
              <Sparkles size={13} /> {t("havenIA.activateTrialButton")}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {FEATURES.map(({ key, icon: Icon, featureFlag }) => {
          const usage = usageByFeature[featureFlag];
          return (
            <WidgetCard
              key={key}
              icon={Icon}
              title={t(`havenIA.features.${key}.title`)}
              style={{ display: "flex", flexDirection: "column", height: 260, overflow: "hidden" }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                  maxHeight: "3em",
                  overflow: "hidden",
                }}
              >
                {t(`havenIA.features.${key}.description`)}
              </p>
              {usage && (
                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>
                    {t(USAGE_UNIT_KEY[featureFlag], { used: usage.used, limit: usage.limit_value })}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (usage.used / Math.max(usage.limit_value, 1)) * 100)}%`,
                        background: usage.allowed ? "var(--accent)" : "var(--danger)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  marginTop: "auto",
                  paddingTop: 14,
                }}
              >
                <span className="hm-badge hm-badge--accent" style={{ fontSize: 10.5 }}>{t("havenIA.premiumBadge")}</span>
                <button
                  className="hm-btn hm-btn-soft hm-btn--compact hm-btn--full"
                  style={{ fontSize: 12 }}
                  onClick={() => handleFeatureClick(key)}
                >
                  {isPremium ? null : <Lock size={12} />} {t("havenIA.viewMore")}
                </button>
              </div>
            </WidgetCard>
          );
        })}
      </div>
    </div>
  );
}
