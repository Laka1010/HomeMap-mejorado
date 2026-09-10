import { useTranslation } from "../../i18n";

const options = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "ca", label: "Català" },
];

export function LanguageSection({ locale, onChange }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 20px" }}>{t("settings.languageSection")}</h1>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 10, maxWidth: 480 }}>
        {options.map((option) => (
          <button
            key={option.value}
            className="hm-btn hm-btn-soft"
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
    </div>
  );
}
