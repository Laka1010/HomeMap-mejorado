import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { SeverityBadge } from "./SeverityBadge";
import { SecuritySpinner } from "./SecuritySpinner";

/**
 * Detalle de un evento. Solo muestra lo que la RPC ya ha decidido entregar
 * (security_admin_get_event aplica la minimización de IP server-side según
 * el permiso can_view_ip del admin) — esta vista no vuelve a filtrar nada
 * por su cuenta porque no tiene nada sensible que filtrar: metadata ya está
 * acotada por el CHECK constraint de la tabla desde la Fase 1 (sin
 * cantidades, sin contenido privado).
 */
export function SecurityEventDetailModal({ eventId, onClose }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    securityAdminService.getEvent(eventId)
      .then((e) => { if (!cancelled) setEvent(e); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Error al cargar el evento"); });
    return () => { cancelled = true; };
  }, [eventId]);

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal sc-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div style={{ fontWeight: 700, fontSize: 16 }}>Security Event</div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="sc-modal-body hm-scroll">
          {error && <div className="sc-error">{error}</div>}
          {!error && !event && <div className="sc-empty"><SecuritySpinner /></div>}
          {event && (
            <div style={{ display: "grid", gap: 14 }}>
              <Row label="Severity"><SeverityBadge severity={event.severity} /></Row>
              <Row label="Event type"><code>{event.event_type}</code></Row>
              <Row label="Result">{event.result}</Row>
              <Row label="Date">{new Date(event.created_at).toLocaleString()}</Row>
              <Row label="User">{event.user_display || "—"}</Row>
              <Row label="Resource">{event.resource_type ? `${event.resource_type}${event.resource_id ? " · " + event.resource_id : ""}` : "—"}</Row>
              <Row label="IP">{event.ip_address ?? "No visible (sin permiso, o no capturada)"}</Row>
              <Row label="Session">{event.session_id || "—"}</Row>
              <Row label="Metadata segura">
                <pre className="sc-metadata">{JSON.stringify(event.metadata || {}, null, 2)}</pre>
              </Row>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sc-event-modal { max-width: 480px; width: 100%; }
        .sc-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .sc-modal-body { padding: 18px; overflow-y: auto; max-height: 70vh; }
        .sc-metadata { background: var(--surface-alt); border-radius: 8px; padding: 10px; font-size: 12px; overflow-x: auto; margin: 0; }
      `}</style>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 14, wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}
