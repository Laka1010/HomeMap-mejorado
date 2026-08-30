import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { AccountStatusBadge } from "./SeverityBadge";
import { SecurityUserDetailModal } from "./SecurityUserDetailModal";
import { SecuritySpinner } from "./SecuritySpinner";
import { Pager } from "./SecurityEventsView";

const PAGE_SIZE = 30;

const STATUS_OPTIONS = [
  { value: "", label: "Estado: todos" },
  { value: "active", label: "Activos" },
  { value: "restricted", label: "Restringidos" },
  { value: "suspended", label: "Suspendidos" },
  { value: "banned", label: "Baneados" },
];

export function SecurityUsersView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openUserId, setOpenUserId] = useState(null);

  // El texto de búsqueda se aplica con un pequeño retardo para no lanzar una
  // consulta por cada tecla; el estado (dropdown) se aplica al instante.
  const [appliedQuery, setAppliedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = (nextOffset = 0) => {
    setLoading(true);
    setError("");
    securityAdminService.listUsers({ query: appliedQuery || null, status: status || null }, PAGE_SIZE, nextOffset)
      .then(({ rows, totalCount }) => { setRows(rows); setTotalCount(totalCount); setOffset(nextOffset); })
      .catch((e) => setError(e?.message || "Error al cargar usuarios"))
      .finally(() => setLoading(false));
  };

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => { load(0); }, [appliedQuery, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadCurrentPage = () => load(offset);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <form onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query.trim()); }} style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
          <input
            className="hm-input"
            style={{ paddingLeft: 36, width: "100%" }}
            placeholder="Buscar por email o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <select className="hm-input" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="sc-error">{error}</div>}
      {loading && <div className="sc-empty"><SecuritySpinner /></div>}

      {!loading && !error && (
        <>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {totalCount} usuario{totalCount === 1 ? "" : "s"}
            {(appliedQuery || status) ? " (filtrado)" : ""}
          </div>

          {rows.length === 0 ? (
            <div className="sc-empty" style={{ padding: 30 }}>
              {(appliedQuery || status) ? "Sin resultados con estos filtros." : "No hay usuarios."}
            </div>
          ) : (
            <div className="sc-user-list">
              {rows.map((u) => (
                <button key={u.user_id} className="sc-user-row" onClick={() => setOpenUserId(u.user_id)}>
                  <div className="hm-avatar hm-avatar--md">{(u.display_name || u.email || "?").charAt(0).toUpperCase()}</div>
                  <div className="sc-user-row-main">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.display_name || u.email}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{u.email}</div>
                  </div>
                  <div className="sc-user-row-meta">
                    <AccountStatusBadge status={u.status} />
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
                      {u.recent_events_count} eventos (30d) · {u.high_critical_count} HIGH/CRITICAL
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Pager offset={offset} pageSize={PAGE_SIZE} totalCount={totalCount} onChange={load} />
        </>
      )}

      {openUserId && (
        <SecurityUserDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={reloadCurrentPage}
        />
      )}

      <style>{`
        .sc-user-list { display: flex; flex-direction: column; gap: 8px; }
        .sc-user-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%;
        }
        .sc-user-row:hover { border-color: var(--accent); }
        .sc-user-row-main { flex: 1; min-width: 0; overflow: hidden; }
        .sc-user-row-meta { text-align: right; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
