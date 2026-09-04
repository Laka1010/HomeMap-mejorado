import { useEffect, useState } from "react";
import { securityAdminService } from "./services/securityAdminService";
import { SeverityBadge } from "./SeverityBadge";
import { SecurityEventDetailModal } from "./SecurityEventDetailModal";
import { SecuritySpinner } from "./SecuritySpinner";
import { SelectField } from "../../components/SelectField";

const EVENT_TYPES = [
  "auth_login_success", "auth_login_failure", "auth_logout", "auth_password_change",
  "auth_password_reset_requested", "auth_email_change",
  "authz_cross_account_access", "authz_cross_personal_economy_access", "authz_cross_workspace_access",
  "authz_unauthorized_write", "authz_unauthorized_financial_operation", "authz_rpc_rejected",
  "authz_permission_bypass_attempt", "security_suspicious_activity",
  "admin_account_suspended", "admin_account_unsuspended", "admin_account_restricted",
  "admin_account_unrestricted", "admin_account_banned", "admin_account_unbanned",
  "admin_session_revoked", "admin_all_sessions_revoked", "admin_ip_blocked", "admin_ip_unblocked",
];

const PAGE_SIZE = 30;

export function SecurityEventsView() {
  const [filters, setFilters] = useState({ severity: "", eventType: "", result: "", dateFrom: "", dateTo: "" });
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEventId, setOpenEventId] = useState(null);

  const load = (nextOffset = offset) => {
    setLoading(true);
    setError("");
    securityAdminService.listEvents(filters, PAGE_SIZE, nextOffset)
      .then(({ rows, totalCount }) => { setRows(rows); setTotalCount(totalCount); setOffset(nextOffset); })
      .catch((e) => setError(e?.message || "Error al cargar eventos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0); }, [filters.severity, filters.eventType, filters.result, filters.dateFrom, filters.dateTo]); // eslint-disable-line

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="sc-filters">
        <SelectField
          className="hm-input" title="Severity" value={filters.severity} onChange={(v) => setFilter("severity", v)}
          options={[
            { value: "", label: "Severity: todas" },
            { value: "info", label: "INFO" },
            { value: "warning", label: "HIGH" },
            { value: "critical", label: "CRITICAL" },
          ]}
        />
        <SelectField
          className="hm-input" title="Result" value={filters.result} onChange={(v) => setFilter("result", v)}
          options={[
            { value: "", label: "Result: todos" },
            { value: "success", label: "success" },
            { value: "failure", label: "failure" },
            { value: "denied", label: "denied" },
          ]}
        />
        <SelectField
          className="hm-input" title="Event type" value={filters.eventType} onChange={(v) => setFilter("eventType", v)}
          options={[{ value: "", label: "Event type: todos" }, ...EVENT_TYPES.map((t) => ({ value: t, label: t }))]}
        />
        <input type="date" className="hm-input" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value ? `${e.target.value}T00:00:00` : "")} />
        <input type="date" className="hm-input" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value ? `${e.target.value}T23:59:59` : "")} />
      </div>

      {error && <div className="sc-error">{error}</div>}
      {loading && <div className="sc-empty"><SecuritySpinner /></div>}

      {!loading && !error && (
        <>
          <div className="sc-event-list">
            {rows.length === 0 && <div className="sc-empty" style={{ padding: 30 }}>Sin eventos con estos filtros.</div>}
            {rows.map((ev) => (
              <button key={ev.event_id} className="sc-event-row" onClick={() => setOpenEventId(ev.event_id)}>
                <SeverityBadge severity={ev.severity} />
                <div className="sc-event-row-main">
                  <div className="sc-event-row-type">{ev.event_type}</div>
                  <div className="sc-event-row-sub">{ev.user_display || "—"} · {ev.result}{ev.resource_type ? ` · ${ev.resource_type}` : ""}</div>
                </div>
                <div className="sc-event-row-date">{new Date(ev.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>

          <Pager offset={offset} pageSize={PAGE_SIZE} totalCount={totalCount} onChange={load} />
        </>
      )}

      {openEventId && <SecurityEventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />}

      <style>{`
        .sc-filters { display: flex; flex-wrap: wrap; gap: 8px; }
        .sc-filters .hm-input { width: auto; min-width: 130px; flex: 1 1 130px; }
        .sc-event-list { display: flex; flex-direction: column; gap: 8px; }
        .sc-event-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%;
        }
        .sc-event-row:hover { border-color: var(--accent); }
        .sc-event-row-main { flex: 1; min-width: 0; }
        .sc-event-row-type { font-weight: 700; font-size: 13px; font-family: monospace; }
        .sc-event-row-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sc-event-row-date { font-size: 11px; color: var(--ink-soft); white-space: nowrap; flex-shrink: 0; }
        @media (max-width: 600px) {
          .sc-event-row { flex-wrap: wrap; }
          .sc-event-row-date { width: 100%; order: 3; }
        }
      `}</style>
    </div>
  );
}

export function Pager({ offset, pageSize, totalCount, onChange }) {
  if (totalCount <= pageSize) return null;
  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.ceil(totalCount / pageSize);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 13, color: "var(--ink-soft)" }}>
      <button className="hm-btn hm-btn-ghost hm-btn--compact" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - pageSize))}>Anterior</button>
      <span>{page} / {pageCount}</span>
      <button className="hm-btn hm-btn-ghost hm-btn--compact" disabled={offset + pageSize >= totalCount} onClick={() => onChange(offset + pageSize)}>Siguiente</button>
    </div>
  );
}
