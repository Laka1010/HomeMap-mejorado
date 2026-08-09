import { useCallback, useEffect, useState } from "react";
import { Users, Home, Layers, ShieldAlert, TrendingUp, ListTree, RefreshCw, ArrowRight } from "lucide-react";
import { platformStatsService } from "../services/platformStatsService";
import { securityAdminService } from "../../modules/security/services/securityAdminService";
import { SecuritySpinner } from "../../modules/security/SecuritySpinner";
import { SeverityBadge } from "../../modules/security/SeverityBadge";
import { SectionTitle, StatGrid, StatCard, STAT_CARD_STYLES } from "../../modules/security/SecurityDashboard";

/**
 * Overview — pantalla inicial de Admin Console (Fase 2).
 *
 * Datos: compone security_admin_platform_stats() (nueva, solo
 * usuarios/casas/workspaces — lo único que no existía ya) +
 * security_admin_dashboard_stats() y security_admin_list_events() (ya
 * existentes, reutilizadas tal cual — cero lógica de seguridad
 * recalculada aquí). No hay ninguna consulta directa a tablas: todo pasa
 * por las 3 RPCs administrativas de siempre.
 */
export function OverviewPage({ onNavigate }) {
  const [state, setState] = useState({ status: "loading", platform: null, security: null, events: [], error: "" });

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    Promise.all([
      platformStatsService.getPlatformStats(),
      securityAdminService.getDashboardStats(),
      securityAdminService.listEvents({}, 5, 0),
    ])
      .then(([platform, security, eventsResult]) => {
        setState({ status: "ready", platform, security, events: eventsResult.rows || [], error: "" });
      })
      .catch((e) => {
        setState((s) => ({ ...s, status: "error", error: e?.message || "No se han podido cargar los datos del Overview" }));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="admin-overview-loading">
        <SecuritySpinner size={32} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="hm-empty">
        <div className="hm-empty-icon"><ShieldAlert size={26} /></div>
        <p className="hm-empty-title">No se pudo cargar el Overview</p>
        <p className="hm-empty-subtitle">{state.error}</p>
        <button type="button" className="hm-btn hm-btn-primary hm-btn--compact" onClick={load}>
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    );
  }

  const { platform, security, events } = state;
  const maxSignup = Math.max(1, ...platform.signups_last_7_days.map((d) => d.count));

  return (
    <div className="admin-overview" style={{ display: "grid", gap: 28 }}>
      <div className="admin-overview-quicknav">
        <QuickNavCard icon={Users} label="Users" value={platform.total_users} onClick={() => onNavigate("users")} />
        <QuickNavCard icon={Home} label="Houses" value={platform.total_houses} onClick={() => onNavigate("houses")} />
        <QuickNavCard icon={Layers} label="Workspaces" value={platform.total_workspaces} onClick={() => onNavigate("workspaces")} />
        <QuickNavCard icon={ShieldAlert} label="Security" value={security.ip_blocks_active} valueLabel="IP blocks" onClick={() => onNavigate("security")} />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <SectionTitle icon={Users} title="Cuentas" />
        <StatGrid>
          <StatCard label="Total users" value={platform.total_users} />
          <StatCard label="Con casa" value={platform.users_with_house} />
          <StatCard label="Active" value={security.accounts_active} tone="success" />
          <StatCard label="Restricted" value={security.accounts_restricted} tone="warning" />
          <StatCard label="Suspended" value={security.accounts_suspended} tone="danger" />
          <StatCard label="Banned" value={security.accounts_banned} tone="danger" />
        </StatGrid>
      </div>

      <div>
        <SectionTitle icon={TrendingUp} title="Platform activity — altas por día (7 días)" />
        <div className="admin-signup-chart">
          {platform.signups_last_7_days.map((d) => (
            <div key={d.date} className="admin-signup-bar-col" title={`${d.date}: ${d.count}`}>
              <div className="admin-signup-bar" style={{ height: `${Math.max(4, (d.count / maxSignup) * 64)}px` }} />
              <div className="admin-signup-bar-label">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle icon={ListTree} title="Recent activity" />
        {events.length === 0 && <p className="hm-empty-subtitle" style={{ margin: 0 }}>Sin eventos recientes.</p>}
        {events.length > 0 && (
          <div className="admin-recent-list">
            {events.map((e) => (
              <div key={e.event_id} className="admin-recent-row">
                <SeverityBadge severity={e.severity} />
                <div className="admin-recent-row-main">
                  <div className="admin-recent-row-type">{e.event_type}</div>
                  <div className="admin-recent-row-sub">{e.user_display || "—"}</div>
                </div>
                <div className="admin-recent-row-date">{new Date(e.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <SectionTitle icon={ShieldAlert} title="Security snapshot" />
        <StatGrid>
          <StatCard label="Eventos HIGH (24h)" value={security.events_24h_high} tone="warning" />
          <StatCard label="Eventos CRITICAL (24h)" value={security.events_24h_critical} tone="danger" />
          <StatCard label="IP blocks activos" value={security.ip_blocks_active} tone="warning" />
        </StatGrid>
        <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" style={{ marginTop: 10 }} onClick={() => onNavigate("security")}>
          Ver Security Center <ArrowRight size={14} />
        </button>
      </div>

      <style>{STAT_CARD_STYLES}</style>
      <style>{`
        .admin-overview-loading { display: flex; align-items: center; justify-content: center; padding: 80px 0; }
        .admin-overview-quicknav { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .admin-quicknav-card {
          display: flex; align-items: center; gap: 10px; text-align: left;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 14px; cursor: pointer;
        }
        .admin-quicknav-card:hover { background: var(--surface-alt); }
        .admin-quicknav-icon {
          width: 34px; height: 34px; border-radius: 10px; background: var(--accent-soft); color: var(--accent);
          display: grid; place-items: center; flex-shrink: 0;
        }
        .admin-quicknav-value { font-size: 18px; font-weight: 800; line-height: 1.1; }
        .admin-quicknav-label { font-size: 12px; color: var(--ink-soft); }
        .admin-signup-chart { display: flex; align-items: flex-end; gap: 10px; height: 90px; padding: 8px 4px 0; }
        .admin-signup-bar-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
        .admin-signup-bar { width: 100%; max-width: 28px; background: var(--accent); border-radius: 4px 4px 0 0; }
        .admin-signup-bar-label { font-size: 10px; color: var(--ink-soft); }
        .admin-recent-list { display: grid; gap: 6px; }
        .admin-recent-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
        .admin-recent-row-main { flex: 1; min-width: 0; }
        .admin-recent-row-type { font-size: 12.5px; font-weight: 600; font-family: monospace; }
        .admin-recent-row-sub { font-size: 11px; color: var(--ink-soft); }
        .admin-recent-row-date { font-size: 11px; color: var(--ink-soft); flex-shrink: 0; }
      `}</style>
    </div>
  );
}

function QuickNavCard({ icon: Icon, label, value, valueLabel, onClick }) {
  return (
    <button type="button" className="admin-quicknav-card" onClick={onClick}>
      <div className="admin-quicknav-icon"><Icon size={16} /></div>
      <div>
        <div className="admin-quicknav-value">{value ?? "—"}</div>
        <div className="admin-quicknav-label">{valueLabel ? `${label} · ${valueLabel}` : label}</div>
      </div>
    </button>
  );
}
