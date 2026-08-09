import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { usersService } from "../services/usersService";
import { SecuritySpinner } from "../../modules/security/SecuritySpinner";
import { AccountStatusBadge } from "../../modules/security/SeverityBadge";
import { SecurityUserDetailModal } from "../../modules/security/SecurityUserDetailModal";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { value: "", label: "Todos los estados" },
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

/**
 * Users — listado/búsqueda/filtro/paginación (RPC nueva
 * security_admin_list_users, único bloque genuinamente nuevo de esta
 * fase). El detalle y las 4 acciones administrativas (restrict/suspend/
 * ban/reactivate) + revocar sesiones se delegan íntegramente en
 * SecurityUserDetailModal, importado tal cual desde Security Center —
 * cero lógica de acciones reimplementada aquí.
 */
export function UsersPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ status: "loading", rows: [], totalCount: 0, error: "" });
  const [openUserId, setOpenUserId] = useState(null);

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    usersService
      .listUsers({ status: statusFilter || null, query: query.trim() || null, limit: PAGE_SIZE, offset })
      .then(({ rows, totalCount }) => setState({ status: "ready", rows, totalCount, error: "" }))
      .catch((e) => setState((s) => ({ ...s, status: "error", error: e?.message || "No se han podido cargar los usuarios" })));
  }, [statusFilter, query, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    load();
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setOffset(0);
  };

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < state.totalCount;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
          <input
            className="hm-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por email o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="hm-input"
          style={{ width: 200 }}
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button type="submit" className="hm-btn hm-btn-primary" disabled={state.status === "loading"}>Buscar</button>
      </form>

      {state.status === "loading" && (
        <div className="admin-users-empty"><SecuritySpinner /></div>
      )}

      {state.status === "error" && (
        <div className="hm-empty">
          <p className="hm-empty-title">No se pudo cargar la lista de usuarios</p>
          <p className="hm-empty-subtitle">{state.error}</p>
          <button type="button" className="hm-btn hm-btn-primary hm-btn--compact" onClick={load}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {state.status === "ready" && state.rows.length === 0 && (
        <div className="admin-users-empty">Sin resultados.</div>
      )}

      {state.status === "ready" && state.rows.length > 0 && (
        <>
          <div className="admin-user-list">
            {state.rows.map((u) => (
              <button key={u.user_id} type="button" className="admin-user-row" onClick={() => setOpenUserId(u.user_id)}>
                <div className="hm-avatar hm-avatar--md">{(u.display_name || u.email || "?").charAt(0).toUpperCase()}</div>
                <div className="admin-user-row-main">
                  <div className="admin-user-row-name">{u.display_name || u.email}</div>
                  <div className="admin-user-row-email">{u.email}</div>
                </div>
                <div className="admin-user-row-meta">
                  <AccountStatusBadge status={u.status} />
                  <div className="admin-user-row-events">
                    {u.recent_events_count} eventos (30d) · {u.high_critical_count} HIGH/CRITICAL
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="admin-users-pager">
            <span className="admin-users-pager-count">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, state.totalCount)} de {state.totalCount}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" disabled={!hasPrev} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                <ChevronLeft size={14} /> Anterior
              </button>
              <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" disabled={!hasNext} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {openUserId && (
        <SecurityUserDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={load}
        />
      )}

      <style>{`
        .admin-users-empty { text-align: center; padding: 60px 0; color: var(--ink-soft); }
        .admin-user-list { display: flex; flex-direction: column; gap: 8px; }
        .admin-user-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%;
        }
        .admin-user-row:hover { border-color: var(--accent); }
        .admin-user-row-main { flex: 1; min-width: 0; overflow: hidden; }
        .admin-user-row-name { font-weight: 700; font-size: 14px; }
        .admin-user-row-email { font-size: 12px; color: var(--ink-soft); }
        .admin-user-row-meta { text-align: right; flex-shrink: 0; }
        .admin-user-row-events { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }
        .admin-users-pager { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .admin-users-pager-count { font-size: 12px; color: var(--ink-soft); }
      `}</style>
    </div>
  );
}
