import { Info } from "lucide-react";
import { useTranslation } from "../../i18n";

export function AboutSection({ version, build }) {
  const { t } = useTranslation();
  return (
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Info size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.aboutSection")}</h2>
      </div>

      <div style={{ display: "grid", gap: 6, color: "var(--ink-soft)", fontSize: 13 }}>
        <div>{t("settings.appName")}</div>
        <div>{t("settings.versionLabel")}: {version}</div>
        <div>{t("settings.buildLabel")}: {build}</div>
        <div>{t("settings.copyright")}</div>
      </div>
    </section>
  );
}
