import { useTranslation } from "../../i18n";
import { getGreetingKey, formatLongDate } from "../../utils/greeting";
import { useDashboardEconomy } from "./useDashboardEconomy";
import { HomeStatusHero } from "./widgets/HomeStatusHero";
import { DASHBOARD_WIDGETS } from "./widgetRegistry";

/**
 * Inicio: cabecera + Home Status (siempre visible) + hasta 6 widgets
 * independientes, cada uno oculto por sí mismo si no tiene nada real que
 * mostrar. Ver widgetRegistry.js para el porqué de la lista en vez de JSX fijo.
 */
export function DashboardOverview({ state, goTo, canSeeEconomy = true, currentHome, houseMembers = [], notifications = [] }) {
  const { t, locale } = useTranslation();
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const shoppingItems = Array.isArray(state.shoppingItems) ? state.shoppingItems : [];
  const shoppingLists = Array.isArray(state.shoppingLists) ? state.shoppingLists : [];
  const activity = Array.isArray(state.activity) ? state.activity : [];

  const { bills, monthIncome, monthExpenses, prevMonthExpenses, loaded } = useDashboardEconomy(currentHome?.id, canSeeEconomy);

  const greeting = t("header.greeting", { greeting: t(getGreetingKey()), name: state.profile.userName });
  const dateAndHome = formatLongDate(locale);

  const widgetProps = { tasks, bills, shoppingItems, shoppingLists, activity, members: houseMembers, notifications, canSeeEconomy, monthIncome, monthExpenses, prevMonthExpenses, economyLoaded: loaded, loaded, goTo };

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="hm-display" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{greeting}</h1>
        <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 4 }}>{dateAndHome}</div>
      </div>

      <HomeStatusHero tasks={tasks} bills={bills} shoppingItems={shoppingItems} canSeeEconomy={canSeeEconomy} />

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {DASHBOARD_WIDGETS.map(({ id, Component }) => (
          <Component key={id} {...widgetProps} />
        ))}
      </div>
    </div>
  );
}
