import { useEffect, useState } from "react";
import { X, Smartphone, Monitor, LogOut } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { AccountStatusBadge } from "./SeverityBadge";
import { SecuritySpinner } from "./SecuritySpinner";

/**
 * Detalle de un usuario + las 7 acciones de administración. Cada botón
 * dispara la RPC correspondiente (nunca cambia estado en el cliente sin
 * pasar por el servidor) y, al terminar, vuelve a pedir el detalle
 * completo (no asume el resultado): así la UI siempre refleja lo que la
 * base de datos realmente aceptó.
 */
export function SecurityUserDetailModal({ userId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { action, label, requiresReason, danger }
  const [reason, setReason] = useState("");

  const load = () => {
    setError("");
    return securityAdminService.getUserDetail(userId)
      .then(setDetail)
      .catch((e) => setError(e?.message || "Error al cargar el usuario"));
  };

  useEffect(() => { load(); }, [userId]); // eslint-disable-line

  const runAction = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setPending(null);
      setReason("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.message || "La acción no se pudo completar");
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.requiresReason && reason.trim().length === 0) {
      setError("Esta acción exige indicar un motivo");
      return;
    }
    runAction(() => pending.action(reason.trim() || undefined));
  };

  const status = detail?.status || "active";

  const actionButtons = [];
  if (status === "active" || status === "restricted") {
    actionButtons.push({ id: "suspend", label: "Suspend account", requiresReason: true, danger: true, action: (r) => securityAdminService.suspendAccount(userId, r) });
  }
  if (status === "suspended") {
    actionButtons.push({ id: "unsuspend", label: "Unsuspend account", requiresReason: false, action: (r) => securityAdminService.unsuspendAccount(userId, r) });
  }
  if (status === "active") {
    actionButtons.push({ id: "restrict", label: "Restrict account", requiresReason: true, action: (r) => securityAdminService.restrictAccount(userId, r) });
  }
  if (status === "restricted") {
    actionButtons.push({ id: "unrestrict", label: "Unrestrict account", requiresReason: false, action: (r) => securityAdminService.unrestrictAccount(userId, r) });
  }
  if (status !== "banned") {
    actionButtons.push({ id: "ban", label: "Ban account", requiresReason: true, danger: true, action: (r) => securityAdminService.banAccount(userId, r) });
  }
  if (status === "banned") {
    actionButtons.push({ id: "unban", label: "Unban account", requiresReason: false, action: (r) => securityAdminService.unbanAccount(userId, r) });
  }
  actionButtons.push({ id: "revokeAll", label: "Revoke all sessions", requiresReason: false, action: (r) => securityAdminService.revokeAllSessions(userId, r) });

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal sc-user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div style={{ fontWeight: 700, fontSize: 16 }}>Security User</div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="sc-modal-body hm-scroll">
          {error && <div className="sc-error">{error}</div>}
          {!detail && !error && <div className="sc-empty"><SecuritySpinner /></div>}

          {detail && (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.display_name || detail.email}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{detail.email}</div>
                </div>
                <AccountStatusBadge status={detail.status} />
              </div>

              {detail.status_reason && (
                <div className="sc-note">Motivo actual: {detail.status_reason}</div>
              )}

              <div className="sc-kv-grid">
                <Kv label="Cuenta creada">{new Date(detail.created_at).toLocaleDateString()}</Kv>
                <Kv label="Último login">{detail.last_sign_in_at ? new Date(detail.last_sign_in_at).toLocaleString() : "—"}</Kv>
                <Kv label="Eventos (24h)">{detail.events_24h}</Kv>
                <Kv label="HIGH/CRITICAL (7d)">{detail.events_7d_high_critical}</Kv>
              </div>

              <div>
                <div className="sc-section-label">Active Sessions</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(detail.sessions || []).length === 0 && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Sin sesiones activas.</div>}
                  {(detail.sessions || []).map((s) => (
                    <div key={s.session_id} className="sc-session-row">
                      <div className="sc-session-icon">{isMobileUA(s.user_agent) ? <Smartphone size={15} /> : <Monitor size={15} />}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {friendlyUserAgent(s.user_agent)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                          Creada {new Date(s.created_at).toLocaleString()} · Actividad {new Date(s.last_activity).toLocaleString()}
                          {s.ip_address ? ` · ${s.ip_address}` : ""}
                        </div>
                      </div>
                      <button
                        className="hm-btn hm-btn-ghost hm-btn--compact"
                        disabled={busy}
                        onClick={() => runAction(() => securityAdminService.revokeSession(s.session_id))}
                      >
                        <LogOut size={13} /> Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="sc-section-label">Acciones</div>
                <div className="sc-action-grid">
                  {actionButtons.map((btn) => (
                    <button
                      key={btn.id}
                      className={`hm-btn ${btn.danger ? "hm-btn-ghost hm-text-danger" : "hm-btn-soft"}`}
                      disabled={busy}
                      onClick={() => { setPending(btn); setReason(""); setError(""); }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {pending && (
                <div className="sc-pending-box">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{pending.label}</div>
                  <textarea
                    className="hm-input"
                    style={{ minHeight: 70 }}
                    placeholder={pending.requiresReason ? "Motivo (obligatorio)" : "Motivo (opcional)"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="hm-btn hm-btn-ghost hm-btn--compact" onClick={() => setPending(null)} disabled={busy}>Cancelar</button>
                    <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={confirmPending} disabled={busy}>Confirmar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sc-user-modal { max-width: 520px; width: 100%; }
        .sc-note { background: var(--surface-alt); border-radius: 8px; padding: 10px 12px; font-size: 13px; }
        .sc-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sc-section-label { font-size: 11px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .sc-session-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--surface-alt); border-radius: 10px; }
        .sc-session-icon { width: 28px; height: 28px; border-radius: 8px; background: var(--surface); display: grid; place-items: center; flex-shrink: 0; }
        .sc-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .sc-pending-box { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-alt); }
        @media (max-width: 480px) {
          .sc-kv-grid, .sc-action-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function Kv({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

function isMobileUA(ua) {
  return !!ua && /Mobile|Android|iPhone/i.test(ua);
}

function friendlyUserAgent(ua) {
  if (!ua) return "Dispositivo desconocido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}
