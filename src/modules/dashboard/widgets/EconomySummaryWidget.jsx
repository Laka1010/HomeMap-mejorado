import { Wallet, ChevronRight } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { useCurrency } from "../../../currency";
import { WidgetCard } from "./WidgetCard";

/**
 * Solo el resumen — Economía no es la protagonista de Inicio, solo un dato
 * más. Oculto si el usuario no puede ver economía (permiso existente,
 * `myRole !== "child"`) o si todavía no hay ningún movimiento este mes.
 */
export function EconomySummaryWidget({ canSeeEconomy, monthIncome, monthExpenses, loaded, goTo }) {
  const { t } = useTranslation();
  const { format } = useCurrency();

  if (!canSeeEconomy || !loaded) return null;
  if (monthIncome === 0 && monthExpenses === 0) return null;

  const balance = monthIncome - monthExpenses;

  return (
    <WidgetCard icon={Wallet} title={t("dashboardOverview.economyTitle")}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Stat label={t("dashboardOverview.economyIncome")} value={format(monthIncome)} color="var(--success)" />
        <Stat label={t("dashboardOverview.economyExpenses")} value={format(monthExpenses)} color="var(--danger)" />
        <Stat label={t("dashboardOverview.economyBalance")} value={format(balance)} color={balance >= 0 ? "var(--success)" : "var(--danger)"} />
      </div>
      <button className="hm-btn hm-btn-soft hm-btn--full" onClick={() => goTo({ tab: "economia" })} style={{ marginTop: 4 }}>
        {t("dashboardOverview.economyViewLink")} <ChevronRight size={14} />
      </button>
    </WidgetCard>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div className="hm-mono" style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}
