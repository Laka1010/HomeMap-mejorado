/**
 * Construye la lista de eventos derivados del propio estado de la casa
 * (tareas, facturas, compras con fecha).
 *
 * Extraído de CalendarModule.jsx para poder reutilizarlo también desde la
 * regla de notificaciones "evento próximo" sin duplicar esta lógica.
 */
export function buildLocalEvents(state) {
  const taskEvents = (Array.isArray(state.tasks) ? state.tasks : []).map((task) => ({
    id: task.id,
    title: task.title,
    date: task.date || null,
    type: "Tarea",
    priority: task.priority,
  }));

  const billEvents = (Array.isArray(state.bills) ? state.bills : []).map((bill) => ({
    id: bill.id,
    title: bill.name,
    date: bill.due_date || null,
    type: "Factura",
    priority: bill.status,
  }));

  const shoppingEvents = (Array.isArray(state.shoppingItems) ? state.shoppingItems : [])
    .filter((item) => item.date)
    .map((item) => ({
      id: item.id,
      title: item.name,
      date: item.date || null,
      type: "Compra",
      priority: item.priority,
    }));

  return [...taskEvents, ...billEvents, ...shoppingEvents].filter((event) => event.date);
}
