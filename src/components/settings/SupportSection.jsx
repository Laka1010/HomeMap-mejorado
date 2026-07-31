import { useState } from "react";
import { LifeBuoy, Copy, Check, MessageCircle } from "lucide-react";
import { useTranslation } from "../../i18n";

const SUPPORT_EMAIL = "homemapsupport@gmail.com";
const SUPPORT_DISCORD_URL = "https://discord.gg/KfA9fp4M5h";

export function SupportSection() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch (e) {
      setCopied(false);
    }
  };

  return (
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <LifeBuoy size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.supportSection")}</h2>
      </div>

      <div className="hm-card-flat hm-card--p16" style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{t("settings.supportPanelTitle")}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("settings.supportPanelDescription")}</div>
        <div className="hm-mono" style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{SUPPORT_EMAIL}</div>
        <button className="hm-btn hm-btn-soft hm-justify-center" onClick={handleCopyEmail}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t("settings.supportCopied") : t("settings.supportCopy")}
        </button>

        <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />

        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("settings.supportDiscordText")}</div>
        <a
          className="hm-btn hm-btn-soft hm-justify-center"
          href={SUPPORT_DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <MessageCircle size={16} /> {t("settings.supportDiscordButton")}
        </a>
      </div>
    </section>
  );
}
