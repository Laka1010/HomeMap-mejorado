import { useState } from "react";
import { CalendarDays, Check, ClipboardList, Edit3, Plus, Star } from "lucide-react";
import { ModuleCard } from "../core/ModuleCard";
import { FavoriteStar } from "../../components/FavoriteStar";
import { EmptyState } from "../../components/EmptyState";
import { taskService } from "../../services/taskService";
import { useTranslation } from "../../i18n";

export function TasksModule({ state, dispatch, openModal, onTaskCompleted }) {
  const { t } = useTranslation();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const priorityLabel = (priority) => (priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : t("tasksModule.priorityNormal"));
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const toggleTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    const nextStatus = task?.status === "done" ? "pending" : "done";
    const completedAt = nextStatus === "done" ? new Date().toISOString() : null;
    dispatch((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: nextStatus, completedAt } : task),
    }));
    taskService.updateTask(taskId, { status: nextStatus, completedAt }).catch((error) => {
      console.error("Error updating task:", error);
    });
    if (nextStatus === "done" && task) onTaskCompleted?.(task);
  };

  const toggleFavorite = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    const nextFavorite = !task?.favorite;
    dispatch((current) => ({
      ...current,
      tasks: current.tasks.map((t) => t.id === taskId ? { ...t, favorite: nextFavorite } : t),
    }));
    taskService.updateTask(taskId, { favorite: nextFavorite }).catch((error) => {
      console.error("Error updating task favorite:", error);
    });
  };

  const visibleTasks = (favoritesOnly ? tasks.filter((t) => t.favorite) : tasks)
    .slice()
    .sort((a, b) => (a.status === "done") - (b.status === "done"));

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("tasksModule.title")}</h1>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={"hm-btn hm-btn--compact " + (favoritesOnly ? "hm-btn-primary" : "hm-btn-soft")}
            style={{ fontSize: 12.5 }}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            <Star size={13} fill={favoritesOnly ? "currentColor" : "none"} /> {t("common.favoritesFilter")}
          </button>
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
      ) : visibleTasks.length === 0 ? (
        <div className="hm-card hm-card--p24 hm-card--center">
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("tasksModule.noFavoriteTasks")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {visibleTasks.map((task) => (
            <ModuleCard
              key={task.id}
              icon={CalendarDays}
              title={task.title}
              subtitle={task.description || t("tasksModule.noDescription")}
              badge={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <FavoriteStar active={task.favorite} onToggle={() => toggleFavorite(task.id)} size={15} />
                  <span>{priorityLabel(task.priority)}</span>
                </span>
              }
              accent={task.status === "done"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{task.assignee || t("tasksModule.unassigned")} · {task.repeat || t("tasksModule.noRepeat")}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{task.date || t("tasksModule.noDate")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={(task.status === "done" ? "hm-btn hm-btn-soft" : "hm-btn hm-btn-primary") + " hm-btn--full"} onClick={() => toggleTask(task.id)}>
                    <Check size={14} /> {task.status === "done" ? t("tasksModule.reopen") : t("tasksModule.markDone")}
                  </button>
                  <button className="hm-btn hm-btn-soft" onClick={() => openModal("editTask", task)}>
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            </ModuleCard>
          ))}
        </div>
      )}
    </div>
  );
}
