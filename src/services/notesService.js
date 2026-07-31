import { supabase } from "../supabaseClient";

/**
 * Servicio de notas del hogar — notes en Supabase. Mismo patrón de mapeo
 * snake_case (DB) <-> camelCase (JS) que taskService.js.
 */

function noteFromRow(row) {
  return {
    id: row.id,
    text: row.text,
    pinned: row.pinned,
    done: row.done,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export const notesService = {
  async fetchNotes(houseId) {
    const { data, error } = await supabase.from("notes").select("*").eq("house_id", houseId);
    if (error) throw error;
    return (data || []).map(noteFromRow);
  },

  async createNote(houseId, note) {
    const { error } = await supabase.from("notes").insert({
      id: note.id,
      house_id: houseId,
      text: note.text,
      pinned: note.pinned ?? false,
      done: note.done ?? false,
    });
    if (error) throw error;
  },

  async updateNote(noteId, patch) {
    const row = {};
    if ("text" in patch) row.text = patch.text;
    if ("pinned" in patch) row.pinned = patch.pinned;
    if ("done" in patch) row.done = patch.done;

    const { error } = await supabase.from("notes").update(row).eq("id", noteId);
    if (error) throw error;
  },

  async deleteNote(noteId) {
    const { error } = await supabase.from("notes").delete().eq("id", noteId);
    if (error) throw error;
  },
};
