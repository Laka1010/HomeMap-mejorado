import { useMemo } from "react";
import { Archive, Bell, Check, Clock, History, Trash2 } from "lucide-react";
import { getCategoryMeta, getPriorityMeta } from "../notifications/meta";
import { timeAgoShort } from "../utils/dates";
import { useTranslation } from "../i18n";

/**
 * Busca, sin fusionar los dos feeds, la entrada de Actividad que originó
 * esta notificación (misma entidad referenciada por entity_ref). "calendarEvent"
 * es ambiguo (puede ser una tarea, factura o compra — ver buildLocalEvents.js),
 * así que para ese caso se empareja solo por id, ignorando el tipo.
 */
function findRelatedActivity(activity, entityRef) {
  if (!entityRef?.id || !Array.isArray(activity)) return null;
  if (entityRef.type === "calendarEvent") {
    return activity.find((a) => a.entityId === entityRef.id) || null;
  }
  return activity.find((a) => a.entityType === entityRef.type && a.entityId === entityRef.id) || null;
}

function NotificationRow({ notification, activity, onAction, onMarkRead, onArchive, onDelete, onSnooze }) {
  const { t } = useTranslation();
  const category = getCategoryMeta(notification.category);
  const priority = getPriorityMeta(notification.priority);
  const CategoryIcon = category.icon;
  const unread = notification.status === "unread";
  const relatedActivity = findRelatedActivity(activity, notification.entityRef);

  return (
    <div
      className="hm-card-flat"
      style={{ padding: 12, borderLeft: `3px solid ${priority.color}`, opacity: unread ? 1 : 0.75 }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: priority.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CategoryIcon size={15} style={{ color: priority.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <div style={{ fontWeight: unread ? 700 : 600, fontSize: 13.5 }}>{notification.title}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgoShort(notification.createdAt)}</div>
          </div>
          {notification.body ? <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 3 }}>{notification.body}</div> : null}

          {relatedActivity ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 12, color: "var(--ink-soft)" }}>
              <History size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t("notificationCenter.relatedActivity")}: {relatedActivity.title}
              </span>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {notification.action ? (
              <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => onAction(notification)}>
                {notification.action.label}
              </button>
            ) : null}
            {unread ? (
              <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => onMarkRead(notification.id)}>
                <Check size={12} /> {t("notificationCenter.markRead")}
              </button>
            ) : null}
            <button className="hm-btn hm-btn-ghost hm-btn--compact" onClick={() => onSnooze(notification.id)} title={t("notificationCenter.snoozeAria")}>
              <Clock size={12} />
            </button>
            <button className="hm-btn hm-btn-ghost hm-btn--compact" onClick={() => onArchive(notification.id)} title={t("notificationCenter.archiveAria")}>
              <Archive size={12} />
            </button>
            <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => onDelete(notification.id)} title={t("notificationCenter.deleteAria")}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Centro de actividad: las críticas siempre se ven primero, el resto debajo
 * — todo en línea, sin agrupar detrás de un "resumen" que haya que desplegar.
 */
export function NotificationCenter({ notifications = [], activity = [], onAction, onMarkRead, onArchive, onDelete, onSnooze }) {
  const { t } = useTranslation();
  const { critical, others } = useMemo(() => {
    const critical = notifications.filter((n) => n.priority === "critical");
    const others = notifications.filter((n) => n.priority !== "critical");
    return { critical, others };
  }, [notifications]);

  const isEmpty = critical.length === 0 && others.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isEmpty ? (
        <div className="hm-card hm-card--p24 hm-card--center">
          <Bell size={26} style={{ color: "var(--accent)", marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("notificationCenter.allCaughtUpTitle")}</div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("notificationCenter.allCaughtUpSubtitle")}</div>
        </div>
      ) : (
        <>
          {(critical.length > 0 || others.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...critical, ...others].map((n) => (
                <NotificationRow key={n.id} notification={n} activity={activity} onAction={onAction} onMarkRead={onMarkRead} onArchive={onArchive} onDelete={onDelete} onSnooze={onSnooze} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
