import { toLocalDateString } from "../../utils/dates";

function startOfWeek(date) {
  const result = new Date(date);
  const day = (date.getDay() + 6) % 7; // lunes=0
  result.setDate(date.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

export const rule = {
  id: "finance_no_expense_this_week",
  category: "finanzas",
  evaluate({ expenses, today }) {
    const weekday = today.getDay(); // 0=domingo
    // No avisar antes de mediados de semana (lunes=1 .. miércoles=3): dar tiempo a que el usuario registre algo.
    if (weekday >= 1 && weekday <= 3) return [];
    const weekStart = startOfWeek(today);
    const hasExpenseThisWeek = expenses.some((e) => e.date && new Date(e.date) >= weekStart);
    if (hasExpenseThisWeek) return [];
    return [{
      type: rule.id,
      category: rule.category,
      priority: "info",
      dedupeKey: `finance_no_expense:${toLocalDateString(weekStart)}`,
      title: "Aún no has registrado ningún gasto esta semana",
      titleKey: "notifications.financeNoExpenseTitle",
      body: "Registra tus gastos para llevar un control real de la economía del hogar.",
      bodyKey: "notifications.financeNoExpenseBody",
      action: {
        type: "log_expense",
        label: "Registrar gasto",
        labelKey: "notifications.logExpenseAction",
        payload: {},
      },
    }];
  },
};
