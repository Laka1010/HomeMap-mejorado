import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert, LayoutDashboard, ListTree, Users, MonitorSmartphone, Ban, ScrollText } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { SecurityDashboard } from "./SecurityDashboard";
import { SecurityEventsView } from "./SecurityEventsView";
import { SecurityUsersView } from "./SecurityUsersView";
import { SecurityIpBlocksView } from "./SecurityIpBlocksView";
import { SecurityAuditLogView } from "./SecurityAuditLogView";
import { SecuritySpinner } from "./SecuritySpinner";

/**
 * Security Center (Fase 3) — panel de administración manual de seguridad.
 * La comprobación de acceso de aquí es solo UX (evita el parpadeo de un
 * panel vacío): la protección real vive en el servidor — cada RPC que
 * llaman las pestañas de abajo repite su propia comprobación de
 * is_security_admin() de forma independiente, así que aunque alguien
 * consiguiera renderizar este componente sin ser Security Admin (saltando
 * el gate de App.jsx), cada llamada real seguiría siendo rechazada.
 */
const TABS = [
  { id: "dashboard", labelKey: "Security Status", icon: LayoutDashboard },
  { id: "events", labelKey: "Security Events", icon: ListTree },
  { id: "users", labelKey: "Security Users", icon: Users },
  { id: "ipBlocks", labelKey: "IP Security", icon: Ban },
  { id: "auditLog", labelKey: "Auditoría", icon: ScrollText },
];

export function SecurityCenter({ onClose }) {
  const [status, setStatus] = useState("checking"); // checking | denied | allowed
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    let cancelled = false;
    securityAdminService.amISecurityAdmin()
      .then((isAdmin) => { if (!cancelled) setStatus(isAdmin ? "allowed" : "denied"); })
      .catch(() => { if (!cancelled) setStatus("denied"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div
        className="hm-drawer sc-drawer hm-scroll"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden", borderRadius: 0 }}
      >
        <div className="sc-header">
          <div className="sc-header-title">
            <div className="sc-header-icon"><ShieldAlert size={18} /></div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Security Center</div>
          </div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label="Cerrar">
            <ArrowLeft size={20} />
          </button>
        </div>

        {status === "allowed" && (
          <div className="sc-tabbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`sc-tab ${tab === t.id ? "sc-tab--active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={15} /> {t.labelKey}
                </button>
              );
            })}
          </div>
        )}
        {status !== "allowed" && <div />}

        <div className="sc-body hm-scroll">
          {status === "checking" && (
            <div className="sc-empty"><SecuritySpinner /></div>
          )}
          {status === "denied" && (
            <div className="sc-empty">
              <ShieldAlert size={32} style={{ color: "var(--danger)" }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>No autorizado</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", maxWidth: 320 }}>
                Esta cuenta no tiene rol de Security Admin. El acceso a esta sección se comprueba en el servidor,
                independientemente de cómo se haya llegado hasta aquí.
              </div>
            </div>
          )}
          {status === "allowed" && tab === "dashboard" && <SecurityDashboard />}
          {status === "allowed" && tab === "events" && <SecurityEventsView />}
          {status === "allowed" && tab === "users" && <SecurityUsersView />}
          {status === "allowed" && tab === "ipBlocks" && <SecurityIpBlocksView />}
          {status === "allowed" && tab === "auditLog" && <SecurityAuditLogView />}
        </div>
      </div>

      <style>{SECURITY_CENTER_STYLES}</style>
    </div>
  );
}

export const SECURITY_CENTER_STYLES = `
  .sc-drawer { max-width: 720px; margin-left: auto; }
  .sc-header {
    padding: 20px 24px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-bottom: 1px solid var(--border);
  }
  .sc-header-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .sc-header-icon {
    width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0;
    background: var(--danger-soft); color: var(--danger);
    display: grid; place-items: center;
  }
  .sc-tabbar {
    display: flex; gap: 4px; padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .sc-tab {
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    padding: 9px 14px; border-radius: 999px; border: 1px solid transparent;
    background: transparent; color: var(--ink-soft); font-size: 13px; font-weight: 600;
    cursor: pointer; flex-shrink: 0;
  }
  .sc-tab--active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-soft); }
  .sc-body { padding: 20px; overflow-y: auto; }
  .sc-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; padding: 60px 20px; text-align: center; height: 100%;
  }
  .sc-error { padding: 20px; color: var(--danger); font-size: 14px; }
  @media (max-width: 768px) {
    .sc-drawer { max-width: 100%; }
    .sc-body { padding: 14px; }
  }
`;
