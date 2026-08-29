import { useState } from "react";
import { CalendarDays, Check, ClipboardList, Edit3, Plus, Trash2 } from "lucide-react";
import { ModuleCard } from "../core/ModuleCard";
import { EmptyState } from "../../components/EmptyState";
import { taskService } from "../../services/taskService";
import { isRepeating, nextRepeatDate, repeatLabelKey } from "./taskRepeat";
import { useTranslation } from "../../i18n";

export function TasksModule({ state, dispatch, openModal, onTaskCompleted }) {
  const { t } = useTranslation();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const priorityLabel = (priority) => (priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : t("tasksModule.priorityNormal"));
  // Texto de repetición para la tarjeta, o "" si la tarea no se repite (en ese
  // caso no se muestra nada). Los valores antiguos de texto libre se enseñan
  // tal cual hasta que se reguarden desde el formulario.
  const repeatText = (repeat) => {
    if (isRepeating(repeat)) return t(repeatLabelKey(repeat));
    return repeat && repeat !== "none" ? repeat : "";
  };
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const toggleTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const willComplete = task.status !== "done";

    // Tarea que se repite: al completarla se reprograma a la siguiente fecha
    // en vez de quedarse en "done".
    if (willComplete && isRepeating(task.repeat)) {
      const nextDate = nextRepeatDate(task.repeat);
      const patch = { status: "pending", completedAt: null, date: nextDate };
      dispatch((current) => ({
        ...current,
        tasks: current.tasks.map((tk) => tk.id === taskId ? { ...tk, ...patch } : tk),
      }));
      taskService.updateTask(taskId, patch).catch((error) => {
        console.error("Error updating task:", error);
      });
      onTaskCompleted?.(task);
      return;
    }

    const nextStatus = willComplete ? "done" : "pending";
    const completedAt = nextStatus === "done" ? new Date().toISOString() : null;
    dispatch((current) => ({
      ...current,
      tasks: current.tasks.map((tk) => tk.id === taskId ? { ...tk, status: nextStatus, completedAt } : tk),
    }));
    taskService.updateTask(taskId, { status: nextStatus, completedAt }).catch((error) => {
      console.error("Error updating task:", error);
    });
    if (nextStatus === "done") onTaskCompleted?.(task);
  };

  const deleteTask = (taskId) => {
    setConfirmingDeleteId(null);
    dispatch((current) => ({
      ...current,
      tasks: (current.tasks || []).filter((tk) => tk.id !== taskId),
    }));
    taskService.deleteTask(taskId).catch((error) => {
      console.error("Error deleting task:", error);
    });
  };

  const visibleTasks = tasks
    .slice()
    .sort((a, b) => (a.status === "done") - (b.status === "done"));

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("tasksModule.title")}</h1>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className="hm-btn hm-btn-primary hm-btn--compact" style={{ fontSize: 12.5 }} onClick={() => openModal("addTask")}><Plus size={13} /> {t("tasksModule.newTask")}</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          card
          icon={ClipboardList}
          title={t("tasksModule.emptyTitle")}
          subtitle={t("tasksModule.emptySubtitle")}
          action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addTask")}><Plus size={15} /> {t("tasksModule.createTask")}</button>}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {visibleTasks.map((task) => (
            <ModuleCard
              key={task.id}
              icon={CalendarDays}
              title={task.title}
              badge={<span>{priorityLabel(task.priority)}</span>}
              accent={task.status === "done"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {task.assignee || t("tasksModule.unassigned")}
                  {repeatText(task.repeat) ? ` · ${repeatText(task.repeat)}` : ""}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{task.date || t("tasksModule.noDate")}</div>
                {confirmingDeleteId === task.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--danger)" }}>{t("tasksModule.confirmDelete")}</span>
                    <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setConfirmingDeleteId(null)}>{t("common.no")}</button>
                    <button className="hm-btn hm-btn--danger hm-btn--compact" onClick={() => deleteTask(task.id)}>{t("common.yes")}</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={(task.status === "done" ? "hm-btn hm-btn-soft" : "hm-btn hm-btn-primary") + " hm-btn--full"} onClick={() => toggleTask(task.id)}>
                      <Check size={14} /> {task.status === "done" ? t("tasksModule.reopen") : t("tasksModule.markDone")}
                    </button>
                    <button className="hm-btn hm-btn-soft" onClick={() => openModal("editTask", task)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="hm-btn hm-btn-soft hm-text-danger" onClick={() => setConfirmingDeleteId(task.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </ModuleCard>
          ))}
        </div>
      )}
    </div>
  );
}
