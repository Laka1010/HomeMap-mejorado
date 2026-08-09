import { useState } from "react";
import { LayoutDashboard, ListTree, Users, Ban, ScrollText } from "lucide-react";
import { SecurityDashboard } from "../../modules/security/SecurityDashboard";
import { SecurityEventsView } from "../../modules/security/SecurityEventsView";
import { SecurityUsersView } from "../../modules/security/SecurityUsersView";
import { SecurityIpBlocksView } from "../../modules/security/SecurityIpBlocksView";
import { SecurityAuditLogView } from "../../modules/security/SecurityAuditLogView";
import { SECURITY_CENTER_STYLES } from "../../modules/security/SecurityCenter";

/**
 * Integración de Security Center dentro de Admin Console.
 *
 * Esto NO es una segunda implementación de Security Center: los 5
 * componentes de contenido (SecurityDashboard/Events/Users/IpBlocks/
 * AuditLog) se importan literalmente desde src/modules/security/, sin
 * copiar ni modificar ni una línea de su lógica ni de sus llamadas a
 * securityAdminService. Lo único que NO se reutiliza es el shell de
 * SecurityCenter.jsx (su overlay tipo drawer + botón de cierre + tabbar
 * propios) porque ese shell fue diseñado para abrirse como modal flotante
 * SOBRE App.jsx — dentro de Admin Console, Security ya es una sección más
 * del panel, con su propio AdminShell alrededor. Sí se reutiliza (import
 * literal) el string de estilos SECURITY_CENTER_STYLES que ya define
 * SecurityCenter.jsx para sus clases .sc-* — por eso ese archivo tiene un
 * único cambio de una palabra (`export`), sin alterar su comportamiento.
 *
 * El componente original SecurityCenter.jsx (el modal que se abre desde
 * AccountHub dentro de la app de consumo) sigue existiendo y funcionando
 * exactamente igual — no se ha tocado su render ni su lógica.
 */
const TABS = [
  { id: "dashboard", label: "Security Status", icon: LayoutDashboard },
  { id: "events", label: "Security Events", icon: ListTree },
  { id: "users", label: "Security Users", icon: Users },
  { id: "ipBlocks", label: "IP Security", icon: Ban },
  { id: "auditLog", label: "Auditoría", icon: ScrollText },
];

export function SecurityPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div>
      <div className="sc-tabbar admin-security-tabbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`sc-tab ${tab === t.id ? "sc-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <SecurityDashboard />}
      {tab === "events" && <SecurityEventsView />}
      {tab === "users" && <SecurityUsersView />}
      {tab === "ipBlocks" && <SecurityIpBlocksView />}
      {tab === "auditLog" && <SecurityAuditLogView />}

      <style>{SECURITY_CENTER_STYLES}</style>
      <style>{`
        .admin-security-tabbar { padding: 0 0 16px; margin-bottom: 4px; border-bottom: 1px solid var(--border); }
      `}</style>
    </div>
  );
}
