import { useEffect } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { useTranslation } from "../../i18n";
import { LanguageSection } from "./LanguageSection";
import { AppearanceSection } from "./AppearanceSection";
import { NotificationSection } from "./NotificationSection";
import { SupportSection } from "./SupportSection";
import { PolicyTermsSection } from "./PolicyTermsSection";
import { AboutSection } from "./AboutSection";
import { CurrencySection } from "./CurrencySection";

export function SettingsScreen({
  locale,
  theme,
  notifications,
  currency,
  userRole,
  onChangeLanguage,
  onChangeTheme,
  onToggleNotificationCategory,
  onChangeNotificationLevel,
  onChangeCurrency,
  onContactSupport,
  onClose,
  onOpenPrivacy,
  onOpenTerms,
  version,
  build,
  isCurrencyLoading,
  scrollToSection,
}) {
  const { t } = useTranslation();
  const isAdmin = userRole === "admin";

  // Cuando se abre desde una fila concreta del hub de cuenta (p.ej. "Notificaciones"),
  // aterriza directamente en ese bloque en vez de arriba del todo.
  useEffect(() => {
    if (!scrollToSection) return;
    const el = document.getElementById(`settings-section-${scrollToSection}`);
    el?.scrollIntoView({ block: "start" });
  }, [scrollToSection]);

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div className="hm-drawer hm-scroll" onClick={(e) => e.stopPropagation()} style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", borderRadius: "0" }}>
        <div style={{ padding: "28px 32px 20px", display: "grid", gridTemplateColumns: "54px 1fr 54px", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <Settings size={18} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{t("settings.title")}</div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" style={{ justifySelf: "end" }} onClick={onClose} aria-label={t("common.close")}>
            <ArrowLeft size={20} />
          </button>
        </div>

        <div style={{ padding: 28, overflowY: "auto", display: "grid", gap: 26, alignContent: "start" }}>
          <div id="settings-section-language"><LanguageSection locale={locale} onChange={onChangeLanguage} /></div>
          <div id="settings-section-appearance"><AppearanceSection theme={theme} onChange={onChangeTheme} /></div>
          <div id="settings-section-currency"><CurrencySection currency={currency} isAdmin={isAdmin} onChange={onChangeCurrency} isLoading={isCurrencyLoading} /></div>
          <div id="settings-section-notifications"><NotificationSection notifications={notifications} onToggleCategory={onToggleNotificationCategory} onChangeLevel={onChangeNotificationLevel} /></div>
          <div id="settings-section-support"><SupportSection onContactSupport={onContactSupport} /></div>
          <div id="settings-section-policy"><PolicyTermsSection onOpenPrivacy={onOpenPrivacy} onOpenTerms={onOpenTerms} /></div>
          <div id="settings-section-about"><AboutSection version={version} build={build} /></div>
        </div>
      </div>
    </div>
  );
}
