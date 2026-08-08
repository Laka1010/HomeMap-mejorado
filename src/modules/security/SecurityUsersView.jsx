import { useState } from "react";
import { Search } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { AccountStatusBadge } from "./SeverityBadge";
import { SecurityUserDetailModal } from "./SecurityUserDetailModal";
import { SecuritySpinner } from "./SecuritySpinner";

export function SecurityUsersView() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [openUserId, setOpenUserId] = useState(null);

  const runSearch = (e) => {
    e?.preventDefault();
    if (query.trim().length < 2) {
      setError("Introduce al menos 2 caracteres");
      return;
    }
    setLoading(true);
    setError("");
    securityAdminService.searchUsers(query.trim())
      .then((r) => { setRows(r); setSearched(true); })
      .catch((e) => setError(e?.message || "Error al buscar"))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <form onSubmit={runSearch} style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
          <input
            className="hm-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por email o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="hm-btn hm-btn-primary" disabled={loading}>Buscar</button>
      </form>

      {error && <div className="sc-error">{error}</div>}
      {loading && <div className="sc-empty"><SecuritySpinner /></div>}

      {!loading && searched && rows.length === 0 && !error && (
        <div className="sc-empty" style={{ padding: 30 }}>Sin resultados.</div>
      )}

      {!loading && rows.length > 0 && (
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

      {openUserId && (
        <SecurityUserDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={runSearch}
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
