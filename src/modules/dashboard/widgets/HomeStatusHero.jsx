import { CheckCircle2, AlertTriangle, Wallet, ClipboardList, ShoppingCart } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { computeHomeStatus } from "../dashboardRules";

const PROBLEM_ICON = { overdueBills: Wallet, billsDueToday: Wallet, overdueTasks: ClipboardList, urgentShopping: ShoppingCart };

/**
 * Tarjeta principal del dashboard: responde "¿cómo está mi hogar?" en una
 * mirada. A diferencia de los otros 6 widgets, esta nunca se oculta — un
 * hogar sin problemas detectados es una respuesta real, no un hueco vacío.
 */
export function HomeStatusHero({ tasks, bills, shoppingItems, canSeeEconomy }) {
  const { t } = useTranslation();
  const status = computeHomeStatus({ tasks, bills, shoppingItems, canSeeEconomy });

  const tone = status.ok ? "success" : "danger";
  const bg = `var(--${tone}-soft)`;
  const fg = `var(--${tone})`;

  return (
    <div className="hm-card hm-fade-in" style={{ padding: 24, background: bg, border: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {status.ok ? <CheckCircle2 size={22} style={{ color: fg, flexShrink: 0 }} /> : <AlertTriangle size={22} style={{ color: fg, flexShrink: 0 }} />}
        <div className="hm-display" style={{ fontSize: 19, fontWeight: 700, color: fg }}>
          {status.ok ? t("dashboardOverview.statusOkTitle") : t("dashboardOverview.statusAttentionTitle")}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {status.ok ? (
          <>
            {status.checks.billsOk !== null && <CheckRow label={t("dashboardOverview.statusBillsOk")} />}
            <CheckRow label={t("dashboardOverview.statusTasksOk")} />
            <CheckRow label={t("dashboardOverview.statusShoppingOk")} />
          </>
        ) : (
          status.problems.map((problem) => {
            const Icon = PROBLEM_ICON[problem.key] || AlertTriangle;
            return (
              <div key={problem.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)" }}>
                <Icon size={15} style={{ color: fg, flexShrink: 0 }} />
                {t(`dashboardOverview.problem.${problem.key}`, { count: problem.count, name: problem.sample })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CheckRow({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)" }}>
      <CheckCircle2 size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
      {label}
    </div>
  );
}
