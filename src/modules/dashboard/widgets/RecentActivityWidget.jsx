import { Users } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { timeAgoShort } from "../../../utils/dates";
import { WidgetCard } from "./WidgetCard";

/**
 * Últimas 5 acciones reales de la casa. Oculto si aún no hay ninguna.
 * Los niños no ven economía, así que las entradas de esa categoría
 * (p.ej. facturas creadas) se filtran cuando canSeeEconomy es false.
 */
export function RecentActivityWidget({ activity, canSeeEconomy = true }) {
  const { t, locale } = useTranslation();
  const visibleActivity = canSeeEconomy
    ? activity
    : (Array.isArray(activity) ? activity : []).filter((entry) => entry.category !== "finanzas");
  const items = (Array.isArray(visibleActivity) ? visibleActivity : []).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <WidgetCard icon={Users} title={t("dashboardOverview.activityTitle")}>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((entry) => (
          <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.titleKey ? t(entry.titleKey, entry.titleParams || {}) : entry.title}
            </span>
            <span style={{ color: "var(--ink-soft)", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgoShort(entry.when, t, locale)}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
