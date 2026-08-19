const MIN_DAY_OF_MONTH = 10; // esperar a tener suficientes datos del mes actual
const MIN_DIFF_PERCENT = 10; // solo avisar si el cambio es significativo

function sumBetween(expenses, from, to) {
  return expenses
    .filter((e) => e.date && new Date(e.date) >= from && new Date(e.date) < to)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

export const rule = {
  id: "finance_month_comparison",
  category: "finanzas",
  evaluate({ expenses, today }) {
    if (today.getDate() < MIN_DAY_OF_MONTH) return [];

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthSameDay = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const thisMonth = sumBetween(expenses, monthStart, today);
    const lastMonthToDate = sumBetween(expenses, lastMonthStart, lastMonthSameDay);
    if (lastMonthToDate <= 0) return [];

    const diffPercent = Math.round(((thisMonth - lastMonthToDate) / lastMonthToDate) * 100);
    if (Math.abs(diffPercent) < MIN_DIFF_PERCENT) return [];

    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const spentLess = diffPercent < 0;
    const percent = Math.abs(diffPercent);
    return [{
      type: rule.id,
      category: rule.category,
      priority: "info",
      dedupeKey: `finance_comparison:${monthKey}`,
      // Dos claves distintas en vez de una con un {{verbo}} interpolado: en
      // inglés "menos"/"más" no son intercambiables dentro de la misma frase.
      title: `Este mes has gastado un ${percent}% ${spentLess ? "menos" : "más"} que el anterior`,
      titleKey: spentLess ? "notifications.financeSpentLessTitle" : "notifications.financeSpentMoreTitle",
      titleVars: { percent },
      body: "Comparado con el mismo número de días del mes pasado.",
      bodyKey: "notifications.financeComparisonBody",
    }];
  },
};
