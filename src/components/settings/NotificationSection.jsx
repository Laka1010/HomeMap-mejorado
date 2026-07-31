import { Bell } from "lucide-react";
import { CATEGORY_META } from "../../notifications/meta";
import { useTranslation } from "../../i18n";

export function NotificationSection({ notifications, onToggleCategory, onChangeLevel }) {
  const { t } = useTranslation();
  const LEVEL_OPTIONS = [
    { key: "onlyImportant", label: t("notificationSettings.levelOnlyImportant") },
    { key: "importantAndReminders", label: t("notificationSettings.levelImportantAndReminders") },
    { key: "all", label: t("notificationSettings.levelAll") },
  ];
  const categories = notifications?.categories || {};
  const level = notifications?.level || "all";

  return (
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Bell size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.notificationsSection")}</h2>
      </div>

      <div>
        <label className="hm-label">{t("notificationSettings.sections")}</label>
        <div style={{ display: "grid", gap: 10 }}>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const active = categories[key] !== false;
            return (
              <button
                key={key}
                className="hm-btn hm-btn-soft"
                onClick={() => onToggleCategory(key)}
                style={{
                  justifyContent: "space-between",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Icon size={18} /> {meta.label}
                </span>
                <span style={{ color: active ? "var(--accent)" : "var(--ink-soft)", fontWeight: 700 }}>
                  {active ? "On" : "Off"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="hm-label">{t("notificationSettings.detailLevel")}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVEL_OPTIONS.map((option) => (
            <button
              key={option.key}
              className="hm-btn hm-btn-soft"
              onClick={() => onChangeLevel(option.key)}
              style={{
                justifyContent: "flex-start",
                borderColor: level === option.key ? "var(--accent)" : "var(--border)",
                color: level === option.key ? "var(--accent)" : "var(--ink)",
                fontWeight: level === option.key ? 700 : 500,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
