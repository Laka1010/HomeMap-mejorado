import { supabase } from "../supabaseClient";

/**
 * Servicio de eventos manuales del calendario — calendar_events en Supabase.
 * Mismo patrón de mapeo snake_case (DB) <-> camelCase (JS) que taskService.js
 * y notesService.js.
 *
 * Fecha/hora se guardan como `date` + `text` (no timestamptz), igual que
 * tasks: encaja directamente en toDateKey()/buildLocalEvents sin los
 * desfases de huso horario que documenta calendarUtils.js.
 */

function eventFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    location: row.location || "",
    allDay: row.all_day ?? false,
    startDate: row.start_date,
    startTime: row.start_time || "",
    endDate: row.end_date || "",
    endTime: row.end_time || "",
    repeat: row.repeat || "none",
    alert: row.alert || "none",
    notes: row.notes || "",
    url: row.url || "",
  };
}

function rowFromEvent(ev) {
  return {
    title: ev.title,
    location: ev.location || null,
    all_day: ev.allDay ?? false,
    start_date: ev.startDate || null,
    start_time: ev.allDay ? null : (ev.startTime || null),
    end_date: ev.endDate || null,
    end_time: ev.allDay ? null : (ev.endTime || null),
    repeat: ev.repeat && ev.repeat !== "none" ? ev.repeat : null,
    alert: ev.alert && ev.alert !== "none" ? ev.alert : null,
    notes: ev.notes || null,
    url: ev.url || null,
  };
}

export const calendarEventService = {
  async fetchEvents(houseId) {
    const { data, error } = await supabase.from("calendar_events").select("*").eq("house_id", houseId);
    if (error) throw error;
    return (data || []).map(eventFromRow);
  },

  async createEvent(houseId, ev) {
    const { error } = await supabase.from("calendar_events").insert({
      id: ev.id,
      house_id: houseId,
      ...rowFromEvent(ev),
    });
    if (error) throw error;
  },

  async updateEvent(eventId, patch) {
    const row = {};
    if ("title" in patch) row.title = patch.title;
    if ("location" in patch) row.location = patch.location || null;
    if ("allDay" in patch) row.all_day = patch.allDay ?? false;
    if ("startDate" in patch) row.start_date = patch.startDate || null;
    if ("startTime" in patch) row.start_time = patch.startTime || null;
    if ("endDate" in patch) row.end_date = patch.endDate || null;
    if ("endTime" in patch) row.end_time = patch.endTime || null;
    if ("repeat" in patch) row.repeat = patch.repeat && patch.repeat !== "none" ? patch.repeat : null;
    if ("alert" in patch) row.alert = patch.alert && patch.alert !== "none" ? patch.alert : null;
    if ("notes" in patch) row.notes = patch.notes || null;
    if ("url" in patch) row.url = patch.url || null;
    // "Todo el día" borra las horas también en la fila.
    if (patch.allDay === true) {
      row.start_time = null;
      row.end_time = null;
    }

    const { error } = await supabase.from("calendar_events").update(row).eq("id", eventId);
    if (error) throw error;
  },

  async deleteEvent(eventId) {
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
    if (error) throw error;
  },
};
