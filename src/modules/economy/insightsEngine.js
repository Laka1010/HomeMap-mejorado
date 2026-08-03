/**
 * Reglas deterministas para los "insights" del Dashboard de Economía — sin
 * IA, sin red: recibe exactamente los datos que ya cargaron los 3 bloques
 * (My Money / Shared Spaces / Household) y devuelve como mucho 3 mensajes,
 * ordenados por severidad (danger > warning > info > success), coherente
 * con "sin scroll innecesario" del encargo.
 *
 * `icon` es un nombre (string), no un componente — este archivo no depende
 * de React ni de lucide-react; `InsightsBar.jsx` hace el mapeo a icono real.
 */

const TONE_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };
const GOAL_MILESTONES = [100, 80, 65, 50];

function daysBetween(a, b) {
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
}

/**
 * @param {object} input
 * @param {Array} input.householdPendingBills - facturas pending del Household, [{id, name, amount, due_date}]
 * @param {number} input.householdBalance - saldo de la cuenta por defecto del Household
 * @param {number} input.personalBalance - saldo total de las cuentas de Personal
 * @param {boolean} input.personalContributedThisMonth - true si ya hay alguna contribución de Personal este mes
 * @param {Array} input.savingsGoals - objetivos de ahorro accesibles, [{id, name, pct}]
 * @param {(key: string, vars?: object) => string} input.t - traductor (namespace economyDashboard.insight*)
 */
export function computeInsights({
  householdPendingBills = [],
  householdBalance = 0,
  personalBalance = 0,
  personalContributedThisMonth = true,
  savingsGoals = [],
  t,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const insights = [];

  const overdue = householdPendingBills.find((b) => b.due_date && new Date(b.due_date) < today);
  if (overdue) {
    insights.push({
      id: `bill-overdue-${overdue.id}`,
      tone: "danger",
      icon: "AlertTriangle",
      text: t("economyDashboard.insightBillOverdue", { name: overdue.name, days: daysBetween(today, new Date(overdue.due_date)) }),
    });
  }

  const dueSoon = householdPendingBills.find((b) => {
    if (!b.due_date) return false;
    const days = daysBetween(new Date(b.due_date), today);
    return days >= 0 && days <= 3;
  });
  if (dueSoon) {
    insights.push({
      id: `bill-due-soon-${dueSoon.id}`,
      tone: "warning",
      icon: "Clock",
      text: t("economyDashboard.insightBillDueSoon", { name: dueSoon.name, days: daysBetween(new Date(dueSoon.due_date), today) }),
    });
  }

  const totalPending = householdPendingBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  if (totalPending > 0 && householdBalance < totalPending) {
    insights.push({
      id: "household-cant-cover",
      tone: "warning",
      icon: "AlertCircle",
      text: t("economyDashboard.insightHouseholdCantCover"),
    });
  }

  if (!personalContributedThisMonth) {
    insights.push({
      id: "no-contribution-this-month",
      tone: "info",
      icon: "HeartHandshake",
      text: t("economyDashboard.insightNoContributionThisMonth"),
    });
  }

  for (const goal of savingsGoals) {
    const milestone = GOAL_MILESTONES.find((m) => goal.pct >= m);
    if (milestone) {
      insights.push({
        id: `goal-${goal.id}`,
        tone: "success",
        icon: "Target",
        text: t("economyDashboard.insightGoalMilestone", { name: goal.name, pct: milestone }),
      });
    }
  }

  if (personalBalance < 0) {
    insights.push({
      id: "personal-balance-negative",
      tone: "danger",
      icon: "TrendingDown",
      text: t("economyDashboard.insightPersonalNegative"),
    });
  }

  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 3);
}
