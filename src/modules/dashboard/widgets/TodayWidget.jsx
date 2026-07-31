import { CalendarCheck, CheckSquare, Wallet } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { computeTodayItems } from "../dashboardRules";
import { WidgetCard } from "./WidgetCard";

const KIND_ICON = { task: CheckSquare, bill: Wallet };

/** Solo lo de hoy — nada futuro. Se oculta entera si no hay nada pendiente hoy. */
export function TodayWidget({ tasks, bills, goTo }) {
  const { t } = useTranslation();
  const items = computeTodayItems({ tasks, bills });
  if (items.length === 0) return null;

  return (
    <WidgetCard icon={CalendarCheck} title={t("dashboardOverview.todayTitle")}>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <button
              key={item.id}
              className="hm-tap"
              onClick={() => goTo({ tab: item.kind === "bill" ? "economia" : "tareas" })}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                background: "var(--surface-alt)", border: "none", borderRadius: 10, padding: "10px 12px",
                cursor: "pointer", color: "var(--ink)", fontSize: 13.5,
              }}
            >
              <Icon size={15} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
