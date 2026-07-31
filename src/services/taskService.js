import { supabase } from "../supabaseClient";

export const DEFAULT_TASK_RETENTION_DAYS = 2;

/**
 * Servicio de tareas del hogar — tasks en Supabase. Mismo patrón de mapeo
 * snake_case (DB) <-> camelCase (JS) que homeContentService.js.
 */

function taskFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    date: row.date,
    time: row.time,
    repeat: row.repeat,
    assignee: row.assignee,
    status: row.status,
    completedAt: row.completed_at,
    favorite: row.favorite ?? false,
  };
}

export const taskService = {
  async fetchTasks(houseId) {
    const { data, error } = await supabase.from("tasks").select("*").eq("house_id", houseId);
    if (error) throw error;
    return (data || []).map(taskFromRow);
  },

  async createTask(houseId, task) {
    const { error } = await supabase.from("tasks").insert({
      id: task.id,
      house_id: houseId,
      title: task.title,
      description: task.description ?? null,
      priority: task.priority ?? null,
      date: task.date || null,
      time: task.time ?? null,
      repeat: task.repeat ?? null,
      assignee: task.assignee ?? null,
      status: task.status || "pending",
      favorite: task.favorite ?? false,
    });
    if (error) throw error;
  },

  async updateTask(taskId, patch) {
    const row = {};
    if ("title" in patch) row.title = patch.title;
    if ("description" in patch) row.description = patch.description;
    if ("priority" in patch) row.priority = patch.priority;
    if ("date" in patch) row.date = patch.date || null;
    if ("time" in patch) row.time = patch.time;
    if ("repeat" in patch) row.repeat = patch.repeat;
    if ("assignee" in patch) row.assignee = patch.assignee;
    if ("status" in patch) row.status = patch.status;
    if ("completedAt" in patch) row.completed_at = patch.completedAt;
    if ("favorite" in patch) row.favorite = patch.favorite;

    const { error } = await supabase.from("tasks").update(row).eq("id", taskId);
    if (error) throw error;
  },

  async deleteTask(taskId) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
  },
};
