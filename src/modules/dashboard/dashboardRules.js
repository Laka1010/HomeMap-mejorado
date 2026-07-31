/**
 * Reglas puras del dashboard de Inicio — sin React, sin fetch, fáciles de
 * testear. Cada función recibe datos ya cargados y devuelve una estructura
 * que los widgets traducen a UI. Ningún mensaje se inventa: si una regla no
 * encuentra una condición real que la dispare, no aparece nada.
 *
 * El umbral de "compra urgente" (3) coincide a propósito con
 * notifications/rules/shoppingReady.js, para no dar dos respuestas distintas
 * a la misma pregunta ("¿tengo que hacer la compra?") en dos sitios de la app.
 */
const URGENT_SHOPPING_THRESHOLD = 3;

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Estado general del hogar (tarjeta hero). Nunca se oculta: un hogar sin
 * problemas detectados es una respuesta honesta ("todo en orden"), no un
 * hueco vacío.
 */
export function computeHomeStatus({ tasks = [], bills = [], shoppingItems = [], canSeeEconomy = true }) {
  const today = todayKey();
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.date && t.date < today);
  const overdueBills = canSeeEconomy ? bills.filter((b) => b.status === "pending" && b.due_date && b.due_date < today) : [];
  const billsDueToday = canSeeEconomy ? bills.filter((b) => b.status === "pending" && b.due_date === today) : [];
  const urgentShopping = shoppingItems.filter((i) => !i.completed && i.priority === "urgent");

  const problems = [];
  if (overdueBills.length > 0) problems.push({ key: "overdueBills", count: overdueBills.length, sample: overdueBills[0]?.name });
  if (billsDueToday.length > 0) problems.push({ key: "billsDueToday", count: billsDueToday.length, sample: billsDueToday[0]?.name });
  if (overdueTasks.length > 0) problems.push({ key: "overdueTasks", count: overdueTasks.length });
  if (urgentShopping.length >= URGENT_SHOPPING_THRESHOLD) problems.push({ key: "urgentShopping", count: urgentShopping.length });

  return {
    ok: problems.length === 0,
    problems,
    checks: {
      billsOk: canSeeEconomy ? overdueBills.length === 0 && billsDueToday.length === 0 : null,
      tasksOk: overdueTasks.length === 0,
      shoppingOk: urgentShopping.length < URGENT_SHOPPING_THRESHOLD,
    },
  };
}

/** Tareas y facturas con fecha de hoy que todavía requieren acción. */
export function computeTodayItems({ tasks = [], bills = [] }) {
  const today = todayKey();
  const todayTasks = tasks
    .filter((t) => t.date === today && t.status !== "done")
    .map((t) => ({ id: `task-${t.id}`, kind: "task", title: t.title }));
  const todayBills = bills
    .filter((b) => b.due_date === today && b.status === "pending")
    .map((b) => ({ id: `bill-${b.id}`, kind: "bill", title: b.name }));
  return [...todayTasks, ...todayBills].slice(0, 5);
}

const UPCOMING_BILLS_WINDOW_DAYS = 14;

/**
 * Facturas pendientes que vencen pronto (no hoy: eso ya lo cubre el widget
 * "Hoy") dentro de una ventana corta, para poder anticiparse sin esperar a
 * que se conviertan en atrasadas.
 */
export function computeUpcomingBills({ bills = [] }) {
  const today = todayKey();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + UPCOMING_BILLS_WINDOW_DAYS);
  const limitKey = todayKey(limitDate);

  return bills
    .filter((b) => b.status === "pending" && b.due_date && b.due_date > today && b.due_date <= limitKey)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4);
}

const INSIGHT_PRIORITY_RANK = { critical: 0, important: 1, info: 2 };

/**
 * Home Insights: un único mensaje por reglas (no IA, no LLM — cada caso es
 * una condición verificable sobre datos reales). Prioridad, de más a menos
 * urgente:
 * 1. La notificación activa más urgente (reutiliza el motor de notificaciones
 *    ya existente en vez de duplicar su lógica).
 * 2. Una factura que vence mañana (todavía no la cubre ninguna notificación).
 * 3. Todas las tareas de hoy completadas.
 * 4. La lista de la compra está vacía.
 * 5. La compra está al día (había productos y ya están todos comprados).
 * 6. Este mes se ha gastado menos que el anterior.
 * Si ninguna condición real se cumple, no hay nada honesto que decir: se
 * oculta (ver HomeInsightsWidget).
 */
export function computeHomeInsight({
  notifications = [],
  tasks = [],
  shoppingItems = [],
  shoppingLists = [],
  bills = [],
  canSeeEconomy = true,
  economyLoaded = false,
  monthExpenses = 0,
  prevMonthExpenses = 0,
}) {
  const unread = notifications.filter((n) => n.status === "unread");
  if (unread.length > 0) {
    const top = [...unread].sort(
      (a, b) => (INSIGHT_PRIORITY_RANK[a.priority] ?? 3) - (INSIGHT_PRIORITY_RANK[b.priority] ?? 3)
    )[0];
    return { kind: "notification", priority: top.priority, category: top.category, title: top.title };
  }

  if (canSeeEconomy) {
    const tomorrow = todayKey(new Date(Date.now() + 86400000));
    const billTomorrow = bills.find((b) => b.status === "pending" && b.due_date === tomorrow);
    if (billTomorrow) {
      return { kind: "billDueTomorrow", name: billTomorrow.name };
    }
  }

  const today = todayKey();
  const todayTasks = tasks.filter((t) => t.date === today);
  if (todayTasks.length > 0 && todayTasks.every((t) => t.status === "done")) {
    return { kind: "allTasksDone" };
  }

  if (shoppingLists.length > 0 && shoppingItems.length === 0) {
    return { kind: "shoppingListEmpty" };
  }

  const pendingShopping = shoppingItems.filter((i) => !i.completed);
  if (shoppingLists.length > 0 && pendingShopping.length === 0) {
    return { kind: "shoppingClear" };
  }

  if (canSeeEconomy && economyLoaded && prevMonthExpenses > 0 && monthExpenses < prevMonthExpenses) {
    return { kind: "spentLess" };
  }

  return null;
}
