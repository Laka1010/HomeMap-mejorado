/**
 * Reglas deterministas para los insights del Overview de un Workspace — sin
 * IA, sin red: recibe los datos que ese Overview ya tiene cargados (o casi)
 * y devuelve como mucho 3 mensajes, ordenados por severidad (danger >
 * warning > info > success). Un único Workspace a la vez — nunca agrega
 * varios (eso violaría "nunca mezclar datos entre Workspaces").
 *
 * `icon` es un nombre (string), no un componente — este archivo no depende
 * de React ni de lucide-react; `InsightsBar.jsx` hace el mapeo a icono real.
 */

const TONE_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };

function daysBetween(a, b) {
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
}

/**
 * @param {object} input
 * @param {Array} input.pendingBills - facturas pending de este Workspace, [{id, name, amount, due_date}]
 * @param {number} input.balance - saldo total de las cuentas activas de este Workspace
 * @param {(key: string, vars?: object) => string} input.t - traductor (namespace economy.insight*)
 */
export function computeInsights({ pendingBills = [], balance = 0, t }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const insights = [];

  const overdue = pendingBills.find((b) => b.due_date && new Date(b.due_date) < today);
  if (overdue) {
    insights.push({
      id: `bill-overdue-${overdue.id}`,
      tone: "danger",
      icon: "AlertTriangle",
      text: t("economy.insightBillOverdue", { name: overdue.name, days: daysBetween(today, new Date(overdue.due_date)) }),
    });
  }

  const dueSoon = pendingBills.find((b) => {
    if (!b.due_date) return false;
    const days = daysBetween(new Date(b.due_date), today);
    return days >= 0 && days <= 3;
  });
  if (dueSoon) {
    insights.push({
      id: `bill-due-soon-${dueSoon.id}`,
      tone: "warning",
      icon: "Clock",
      text: t("economy.insightBillDueSoon", { name: dueSoon.name, days: daysBetween(new Date(dueSoon.due_date), today) }),
    });
  }

  const totalPending = pendingBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  if (totalPending > 0 && balance < totalPending) {
    insights.push({
      id: "balance-cant-cover-bills",
      tone: "warning",
      icon: "AlertCircle",
      text: t("economy.insightCantCoverBills"),
    });
  }

  if (balance < 0) {
    insights.push({
      id: "balance-negative",
      tone: "danger",
      icon: "TrendingDown",
      text: t("economy.insightBalanceNegative"),
    });
  }

  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 3);
}
