import { Globe } from "lucide-react";
import { useTranslation } from "../../i18n";

const options = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function LanguageSection({ locale, onChange }) {
  const { t } = useTranslation();
  return (
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Globe size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.languageSection")}</h2>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {options.map((option) => (
          <button
            key={option.value}
            className={"hm-btn hm-btn-soft" + (locale === option.value ? "" : "")}
            onClick={() => onChange(option.value)}
            style={{
              justifyContent: "space-between",
              borderColor: locale === option.value ? "var(--accent)" : "var(--border)",
              background: locale === option.value ? "var(--accent-soft)" : "var(--surface)",
            }}
          >
            <span>{option.label}</span>
            {locale === option.value ? "✔" : ""}
          </button>
        ))}
      </div>
    </section>
  );
}
