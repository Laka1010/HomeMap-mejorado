import { Wallet, ChevronRight } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { useCurrency } from "../../../currency";
import { computeUpcomingBills } from "../dashboardRules";
import { WidgetCard } from "./WidgetCard";

function daysUntil(dueDate) {
  const diff = new Date(dueDate).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Facturas próximas (no las de hoy, esas van en el widget "Hoy"). Oculto si
 * no se puede ver economía, aún no ha cargado, o no hay ninguna factura
 * venciendo en los próximos días.
 */
export function UpcomingBillsWidget({ canSeeEconomy, bills, loaded, goTo }) {
  const { t } = useTranslation();
  const { format } = useCurrency();

  if (!canSeeEconomy || !loaded) return null;
  const upcoming = computeUpcomingBills({ bills });
  if (upcoming.length === 0) return null;

  return (
    <WidgetCard icon={Wallet} title={t("dashboardOverview.upcomingBillsTitle")}>
      <div style={{ display: "grid", gap: 8 }}>
        {upcoming.map((bill) => (
          <div key={bill.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.name}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
              <span className="hm-mono" style={{ fontWeight: 700 }}>{format(bill.amount)}</span>
              <span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>{t("economy.dueInDays", { days: daysUntil(bill.due_date) })}</span>
            </span>
          </div>
        ))}
      </div>
      <button className="hm-btn hm-btn-soft hm-btn--full" onClick={() => goTo({ tab: "economia" })} style={{ marginTop: 4 }}>
        {t("dashboardOverview.economyViewLink")} <ChevronRight size={14} />
      </button>
    </WidgetCard>
  );
}
