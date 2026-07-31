import { Sun, Moon, Smartphone } from "lucide-react";
import { useTranslation } from "../../i18n";

const themeOptions = [
  { value: "light", labelKey: "settings.appearance.light", icon: Sun },
  { value: "dark", labelKey: "settings.appearance.dark", icon: Moon },
  { value: "system", labelKey: "settings.appearance.systemShort", icon: Smartphone },
];

export function AppearanceSection({ theme, onChange }) {
  const { t } = useTranslation();
  return (
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Sun size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.appearanceSection")}</h2>
      </div>

      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 999, padding: 3 }}>
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              className="hm-tap"
              onClick={() => onChange(option.value)}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "none",
                borderRadius: 999,
                padding: "8px 10px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--accent-ink)" : "var(--ink-soft)",
              }}
            >
              <Icon size={15} /> {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
