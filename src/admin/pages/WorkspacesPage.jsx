import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, Layers, Users, Archive } from "lucide-react";
import { workspacesService } from "../services/workspacesService";
import { SecuritySpinner } from "../../modules/security/SecuritySpinner";

const PAGE_SIZE = 25;

const TYPE_LABELS = { personal: "Personal", household: "Household", shared: "Shared" };
const ROLE_LABELS = { owner: "Owner", manager: "Manager", contributor: "Contributor", viewer: "Viewer" };
const HOUSE_ROLE_LABELS = { admin: "Admin", adult: "Adult", child: "Child" };

/**
 * Workspaces — listado/búsqueda/paginación + detalle (solo lectura, mismo
 * alcance que Houses: ninguna de las ~20 RPCs de gestión de Workspaces
 * comprueba is_security_admin(), todas gatean en is_workspace_owner()/
 * can_manage_financial_space() — no hay ninguna base existente que
 * reutilizar para escritura, decisión de producto confirmada).
 *
 * "Miembros" y "owner" NO son uniformes entre los 3 tipos de Workspace —
 * ver comentario en la migración 20260809_063. personal: un único owner.
 * shared: financial_space_members tal cual. household: derivado de
 * home_members (no tiene "owner" vivo — financial_spaces.owner_id puede
 * quedar desactualizado tras transfer_house_ownership, que nunca lo
 * toca — así que para household se muestra house_role + resolved_role
 * de cada miembro de la casa, no un owner único).
 */
export function WorkspacesPage() {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ status: "loading", rows: [], totalCount: 0, error: "" });
  const [openWorkspaceId, setOpenWorkspaceId] = useState(null);

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    workspacesService
      .listWorkspaces({ query: query.trim() || null, limit: PAGE_SIZE, offset })
      .then(({ rows, totalCount }) => setState({ status: "ready", rows, totalCount, error: "" }))
      .catch((e) => setState((s) => ({ ...s, status: "error", error: e?.message || "No se han podido cargar los workspaces" })));
  }, [query, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    load();
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
            placeholder="Buscar por nombre de workspace o por quien lo creó..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="hm-btn hm-btn-primary" disabled={state.status === "loading"}>Buscar</button>
      </form>

      {state.status === "loading" && (
        <div className="admin-ws-empty"><SecuritySpinner /></div>
      )}

      {state.status === "error" && (
        <div className="hm-empty">
          <p className="hm-empty-title">No se pudo cargar la lista de workspaces</p>
          <p className="hm-empty-subtitle">{state.error}</p>
          <button type="button" className="hm-btn hm-btn-primary hm-btn--compact" onClick={load}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {state.status === "ready" && state.rows.length === 0 && (
        <div className="admin-ws-empty">Sin resultados.</div>
      )}

      {state.status === "ready" && state.rows.length > 0 && (
        <>
          <div className="admin-ws-list">
            {state.rows.map((w) => (
              <button key={w.workspace_id} type="button" className="admin-ws-row" onClick={() => setOpenWorkspaceId(w.workspace_id)}>
                <div className="hm-avatar hm-avatar--md">{w.icon || <Layers size={18} />}</div>
                <div className="admin-ws-row-main">
                  <div className="admin-ws-row-name">
                    {w.name} <span className="admin-ws-type-tag">{TYPE_LABELS[w.type] || w.type}</span>
                    {w.archived_at && <span className="admin-ws-archived-tag"><Archive size={10} /> Archivado</span>}
                  </div>
                  <div className="admin-ws-row-owner">
                    {w.type === "household"
                      ? `Creado por ${w.created_by_display_name || w.created_by_email}`
                      : (w.owner_display_name || w.owner_email)}
                  </div>
                </div>
                <div className="admin-ws-row-meta">
                  <div className="admin-ws-row-members"><Users size={12} /> {w.member_count}</div>
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

      {openWorkspaceId && (
        <WorkspaceDetailModal workspaceId={openWorkspaceId} onClose={() => setOpenWorkspaceId(null)} />
      )}

      <style>{`
        .admin-ws-empty { text-align: center; padding: 60px 0; color: var(--ink-soft); }
        .admin-ws-list { display: flex; flex-direction: column; gap: 8px; }
        .admin-ws-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%;
        }
        .admin-ws-row:hover { border-color: var(--accent); }
        .admin-ws-row-main { flex: 1; min-width: 0; overflow: hidden; }
        .admin-ws-row-name { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .admin-ws-type-tag { font-size: 10px; font-weight: 700; color: var(--ink-soft); background: var(--surface-alt); border-radius: 999px; padding: 2px 8px; text-transform: uppercase; letter-spacing: 0.03em; }
        .admin-ws-archived-tag { font-size: 10px; font-weight: 700; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 3px; }
        .admin-ws-row-owner { font-size: 12px; color: var(--ink-soft); }
        .admin-ws-row-meta { text-align: right; flex-shrink: 0; }
        .admin-ws-row-members { display: flex; align-items: center; gap: 4px; justify-content: flex-end; font-size: 12px; font-weight: 600; }
        .admin-users-pager { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .admin-users-pager-count { font-size: 12px; color: var(--ink-soft); }
      `}</style>
    </div>
  );
}

function WorkspaceDetailModal({ workspaceId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    workspacesService
      .getWorkspaceDetail(workspaceId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Error al cargar el workspace"); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal admin-ws-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-ws-modal-header">
          <div style={{ fontWeight: 700, fontSize: 16 }}>Workspace</div>
          <button type="button" className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="admin-ws-modal-body hm-scroll">
          {error && <div className="admin-ws-modal-error">{error}</div>}
          {!error && !detail && <div className="admin-ws-empty"><SecuritySpinner /></div>}

          {detail && (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="hm-avatar hm-avatar--lg">{detail.icon || <Layers size={24} />}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{TYPE_LABELS[detail.type] || detail.type}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <Kv label="Creado">{new Date(detail.created_at).toLocaleDateString()}</Kv>
                <Kv label="Creado por">{detail.created_by_display_name || detail.created_by_email}</Kv>
                {(detail.type === "personal" || detail.type === "shared") && (
                  <Kv label="Propietario">{detail.owner_display_name || detail.owner_email}</Kv>
                )}
                <Kv label="Archivado">{detail.archived_at ? new Date(detail.archived_at).toLocaleString() : "No"}</Kv>
              </div>

              <div>
                <div className="admin-ws-section-label"><Users size={12} /> Miembros ({detail.members.length})</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {detail.members.map((m) => (
                    <div key={m.user_id} className="admin-ws-member-row">
                      <div className="hm-avatar hm-avatar--sm">{(m.display_name || m.email || "?").charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.display_name || m.email}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{m.email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {detail.type === "household" ? (
                          <>
                            <div className="admin-ws-member-role">{m.resolved_role ? ROLE_LABELS[m.resolved_role] || m.resolved_role : "Sin acceso"}</div>
                            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>Casa: {HOUSE_ROLE_LABELS[m.house_role] || m.house_role}</div>
                          </>
                        ) : (
                          <div className="admin-ws-member-role">{ROLE_LABELS[m.role] || m.role}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-ws-modal { max-width: 520px; width: 100%; }
        .admin-ws-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .admin-ws-modal-body { padding: 18px; overflow-y: auto; max-height: 70vh; }
        .admin-ws-modal-error { padding: 12px; color: var(--danger); font-size: 13px; }
        .admin-ws-section-label { font-size: 11px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .admin-ws-member-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--surface-alt); border-radius: 10px; }
        .admin-ws-member-role { font-size: 12px; font-weight: 700; }
      `}</style>
    </div>
  );
}

function Kv({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}
