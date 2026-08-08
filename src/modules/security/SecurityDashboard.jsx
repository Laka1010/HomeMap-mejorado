import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, KeyRound, Ban } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { SecuritySpinner } from "./SecuritySpinner";

export function SecurityDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    securityAdminService.getDashboardStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Error al cargar el dashboard"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="sc-error">{error}</div>;
  if (!stats) return <div className="sc-empty"><SecuritySpinner /></div>;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <SectionTitle icon={AlertTriangle} title="Eventos (últimas 24h)" />
      <StatGrid>
        <StatCard label="Total" value={stats.events_24h_total} />
        <StatCard label="Failed logins" value={stats.events_24h_failed_logins} tone="warning" />
        <StatCard label="Blocked authz" value={stats.events_24h_blocked_authz} tone="warning" />
        <StatCard label="Suspicious activity" value={stats.events_24h_suspicious} tone="danger" />
        <StatCard label="HIGH" value={stats.events_24h_high} tone="warning" />
        <StatCard label="CRITICAL" value={stats.events_24h_critical} tone="danger" />
      </StatGrid>

      <SectionTitle icon={ShieldCheck} title="Cuentas" />
      <StatGrid>
        <StatCard label="Active" value={stats.accounts_active} tone="success" />
        <StatCard label="Restricted" value={stats.accounts_restricted} tone="warning" />
        <StatCard label="Suspended" value={stats.accounts_suspended} tone="danger" />
        <StatCard label="Banned" value={stats.accounts_banned} tone="danger" />
      </StatGrid>

      <SectionTitle icon={KeyRound} title="Sesiones" />
      <StatGrid>
        <StatCard label="Active sessions" value={stats.sessions_active} />
        <StatCard label="Recently revoked (24h)" value={stats.sessions_recently_revoked} />
      </StatGrid>

      <SectionTitle icon={Ban} title="IP" />
      <StatGrid>
        <StatCard label="Active IP blocks" value={stats.ip_blocks_active} tone="warning" />
      </StatGrid>

      <style>{`
        .sc-section-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--ink); }
        .sc-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: -8px; }
        .sc-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
        .sc-stat-value { font-size: 24px; font-weight: 800; line-height: 1.1; }
        .sc-stat-label { font-size: 12px; color: var(--ink-soft); margin-top: 4px; }
      `}</style>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return <div className="sc-section-title"><Icon size={15} /> {title}</div>;
}

function StatGrid({ children }) {
  return <div className="sc-stat-grid">{children}</div>;
}

const TONE_COLOR = {
  success: "var(--success, #2f9e5c)",
  warning: "var(--chart-warning, #d69e2e)",
  danger: "var(--danger)",
};

function StatCard({ label, value, tone }) {
  return (
    <div className="sc-stat-card">
      <div className="sc-stat-value" style={tone ? { color: TONE_COLOR[tone] } : undefined}>
        {value ?? "—"}
      </div>
      <div className="sc-stat-label">{label}</div>
    </div>
  );
}
