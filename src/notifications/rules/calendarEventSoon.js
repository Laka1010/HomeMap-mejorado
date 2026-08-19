import { buildLocalEvents } from "../../modules/calendar/buildLocalEvents";

const HOURS_AHEAD = 24;

export const rule = {
  id: "calendar_event_soon",
  category: "calendario",
  // Nota: solo cubre eventos derivados de la propia casa (tareas, facturas,
  // compras con fecha).
  evaluate({ state, bills, today }) {
    const events = buildLocalEvents({ ...state, bills });
    const horizon = new Date(today.getTime() + HOURS_AHEAD * 3600 * 1000);
    return events
      .filter((e) => {
        const d = new Date(e.date);
        return !Number.isNaN(d.getTime()) && d >= today && d <= horizon;
      })
      .map((e) => ({
        type: rule.id,
        category: rule.category,
        priority: "important",
        dedupeKey: `calendar_event_soon:${e.type}:${e.id}`,
        // El título es el del propio evento (texto del usuario): no se traduce.
        title: e.title,
        body: `${e.type} programada en las próximas ${HOURS_AHEAD} horas.`,
        bodyKey: "notifications.calendarEventSoonBody",
        bodyVars: { type: e.type, hours: HOURS_AHEAD },
        entityRef: { type: "calendarEvent", id: e.id },
        action: {
          type: "open_calendar",
          label: "Ver calendario",
          labelKey: "notifications.openCalendarAction",
          payload: {},
        },
      }));
  },
};
