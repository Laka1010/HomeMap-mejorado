/**
 * Construye la lista de eventos del calendario a partir del estado de la casa:
 * los DERIVADOS (tareas, facturas, compras con fecha) y los eventos MANUALES
 * que el usuario crea desde el formulario "nuevo evento" (state.calendarEvents).
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

  // Eventos manuales: conservan todos sus campos para que CalendarModule pueda
  // reabrir el formulario de edición sin buscar el original por id.
  const manualEvents = (Array.isArray(state.calendarEvents) ? state.calendarEvents : []).map((ev) => ({
    id: ev.id,
    title: ev.title,
    date: ev.startDate || null,
    time: ev.allDay ? null : (ev.startTime || null),
    type: "Evento",
    manual: true,
    allDay: ev.allDay ?? false,
    location: ev.location || "",
    endDate: ev.endDate || "",
    endTime: ev.endTime || "",
    repeat: ev.repeat || "none",
    alert: ev.alert || "none",
    notes: ev.notes || "",
    url: ev.url || "",
  }));

  return [...taskEvents, ...billEvents, ...shoppingEvents, ...manualEvents].filter((event) => event.date);
}
