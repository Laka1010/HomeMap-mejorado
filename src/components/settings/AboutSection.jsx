import { useTranslation } from "../../i18n";

export function AboutSection({ version, build }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 20px" }}>{t("settings.aboutSection")}</h1>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 6, color: "var(--ink-soft)", fontSize: 13, maxWidth: 480 }}>
        <div>{t("settings.appName")}</div>
        <div>{t("settings.versionLabel")}: {version}</div>
        <div>{t("settings.buildLabel")}: {build}</div>
        <div>{t("settings.copyright")}</div>
      </div>
    </div>
  );
}
