import { useMemo } from "react";
import { Bell, History, Trash2 } from "lucide-react";
import { getCategoryMeta, getPriorityMeta } from "../notifications/meta";
import { notificationTitle, notificationBody, notificationActionLabel } from "../notifications/notificationText";
import { timeAgoShort } from "../utils/dates";
import { EmptyState } from "./EmptyState";
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

function NotificationRow({ notification, activity, unread, onAction, onDelete }) {
  const { t, locale } = useTranslation();
  const category = getCategoryMeta(notification.category);
  const priority = getPriorityMeta(notification.priority);
  const CategoryIcon = category.icon;
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
            <div style={{ fontWeight: unread ? 700 : 600, fontSize: 13.5 }}>{notificationTitle(t, notification)}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgoShort(notification.createdAt, t, locale)}</div>
          </div>
          {notificationBody(t, notification) ? <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 3 }}>{notificationBody(t, notification)}</div> : null}

          {relatedActivity ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 12, color: "var(--ink-soft)" }}>
              <History size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t("notificationCenter.relatedActivity")}: {relatedActivity.title}
              </span>
            </div>
          ) : null}

          {/* Solo dos acciones: la propia de la notificación ("Ver", "Abrir
              compra", "Completar tarea"...) y eliminar. Marcar como leída ya
              no es un botón — abrir este panel cuenta como haberlas visto (ver
              markAllNotificationsRead) — y archivar/posponer se quitaron para
              no llenar la fila de iconos que casi nadie usaba. */}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {notification.action ? (
              <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => onAction(notification)}>
                {notificationActionLabel(t, notification)}
              </button>
            ) : null}
            <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => onDelete(notification.id)} title={t("notificationCenter.deleteAria")}>
              <Trash2 size={12} /> {t("notificationCenter.delete")}
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
 *
 * `unreadIds` es una foto fija del momento en que se abrió el panel, no el
 * `status` actual: al abrirlo se marcan todas como leídas en el servidor, y
 * sin esa foto las notificaciones nuevas perderían el resaltado justo cuando
 * el usuario las está mirando.
 */
export function NotificationCenter({ notifications = [], activity = [], unreadIds, onAction, onDelete }) {
  const { t } = useTranslation();
  const { critical, others } = useMemo(() => {
    const critical = notifications.filter((n) => n.priority === "critical");
    const others = notifications.filter((n) => n.priority !== "critical");
    return { critical, others };
  }, [notifications]);

  const isEmpty = critical.length === 0 && others.length === 0;
  const wasUnread = (n) => (unreadIds ? unreadIds.has(n.id) : n.status === "unread");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isEmpty ? (
        <EmptyState card icon={Bell} title={t("notificationCenter.allCaughtUpTitle")} subtitle={t("notificationCenter.allCaughtUpSubtitle")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...critical, ...others].map((n) => (
            <NotificationRow key={n.id} notification={n} activity={activity} unread={wasUnread(n)} onAction={onAction} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
