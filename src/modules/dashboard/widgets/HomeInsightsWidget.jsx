import { Lightbulb, PartyPopper, Home, Wallet, ShoppingCart, TrendingDown } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { getCategoryMeta, getPriorityMeta } from "../../../notifications/meta";
import { notificationTitle } from "../../../notifications/notificationText";
import { computeHomeInsight } from "../dashboardRules";
import { WidgetCard } from "./WidgetCard";

/**
 * Home Insights: un único mensaje generado por reglas, nunca por IA (reutiliza
 * el motor de notificaciones ya existente para el caso más urgente en vez de
 * duplicar su lógica; el resto son condiciones propias sobre datos reales).
 * Oculto si no hay ninguna observación honesta que mostrar.
 */
export function HomeInsightsWidget({ notifications, tasks, shoppingItems, shoppingLists, bills, canSeeEconomy, economyLoaded, monthExpenses, prevMonthExpenses }) {
  const { t } = useTranslation();
  const insight = computeHomeInsight({ notifications, tasks, shoppingItems, shoppingLists, bills, canSeeEconomy, economyLoaded, monthExpenses, prevMonthExpenses });
  if (!insight) return null;

  let Icon = Lightbulb;
  let color = "var(--accent)";
  let text = "";

  if (insight.kind === "notification") {
    const priorityMeta = getPriorityMeta(insight.priority);
    Icon = getCategoryMeta(insight.category).icon;
    color = priorityMeta.color;
    text = notificationTitle(t, insight.notification);
  } else if (insight.kind === "billDueTomorrow") {
    Icon = Wallet;
    color = "var(--pin)";
    text = t("dashboardOverview.insightBillDueTomorrow", { name: insight.name });
  } else if (insight.kind === "allTasksDone") {
    Icon = PartyPopper;
    color = "var(--success)";
    text = t("dashboardOverview.insightAllTasksDone");
  } else if (insight.kind === "shoppingListEmpty") {
    Icon = ShoppingCart;
    color = "var(--success)";
    text = t("dashboardOverview.insightShoppingListEmpty");
  } else if (insight.kind === "shoppingClear") {
    Icon = Home;
    color = "var(--success)";
    text = t("dashboardOverview.insightShoppingClear");
  } else if (insight.kind === "spentLess") {
    Icon = TrendingDown;
    color = "var(--success)";
    text = t("dashboardOverview.insightSpentLess");
  }

  return (
    <WidgetCard icon={Lightbulb} title={t("dashboardOverview.insightsTitle")}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
        <Icon size={17} style={{ color, flexShrink: 0, marginTop: 1 }} />
        <div>{text}</div>
      </div>
    </WidgetCard>
  );
}
