import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, Home, Users, Clock } from "lucide-react";
import { housesService } from "../services/housesService";
import { SecuritySpinner } from "../../modules/security/SecuritySpinner";
import { SectionTitle, StatGrid, StatCard, STAT_CARD_STYLES } from "../../modules/security/SecurityDashboard";

const PAGE_SIZE = 25;

const ROLE_LABELS = { admin: "Admin", adult: "Adult", child: "Child" };

/**
 * Houses — listado/búsqueda/paginación + detalle (solo lectura, sin
 * ninguna acción administrativa: ninguna de las 9 RPCs de gestión de
 * casas comprueba is_security_admin(), todas gatean en is_house_admin(),
 * así que no hay ninguna base existente que reutilizar para escritura —
 * decisión de producto confirmada, fuera de alcance de esta fase).
 *
 * No existe ningún componente de detalle de casa que reutilizar (a
 * diferencia de Users, que reutiliza SecurityUserDetailModal) — el modal
 * de aquí es contenido nuevo, pero reutiliza SectionTitle/StatGrid/
 * StatCard/STAT_CARD_STYLES ya exportados desde SecurityDashboard.jsx
 * para los recuentos, y las clases .hm-modal-overlay/.hm-modal ya
 * portadas en admin-shared.css.
 */
export function HousesPage() {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ status: "loading", rows: [], totalCount: 0, error: "" });
  const [openHouseId, setOpenHouseId] = useState(null);

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    housesService
      .listHouses({ query: query.trim() || null, limit: PAGE_SIZE, offset })
      .then(({ rows, totalCount }) => setState({ status: "ready", rows, totalCount, error: "" }))
      .catch((e) => setState((s) => ({ ...s, status: "error", error: e?.message || "No se han podido cargar las casas" })));
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
            placeholder="Buscar por nombre de casa, nombre o email del propietario..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="hm-btn hm-btn-primary" disabled={state.status === "loading"}>Buscar</button>
      </form>

      {state.status === "loading" && (
        <div className="admin-houses-empty"><SecuritySpinner /></div>
      )}

      {state.status === "error" && (
        <div className="hm-empty">
          <p className="hm-empty-title">No se pudo cargar la lista de casas</p>
          <p className="hm-empty-subtitle">{state.error}</p>
          <button type="button" className="hm-btn hm-btn-primary hm-btn--compact" onClick={load}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {state.status === "ready" && state.rows.length === 0 && (
        <div className="admin-houses-empty">Sin resultados.</div>
      )}

      {state.status === "ready" && state.rows.length > 0 && (
        <>
          <div className="admin-house-list">
            {state.rows.map((h) => (
              <button key={h.house_id} type="button" className="admin-house-row" onClick={() => setOpenHouseId(h.house_id)}>
                <div className="hm-avatar hm-avatar--md">
                  {h.photo ? <img src={h.photo} alt="" /> : <Home size={18} />}
                </div>
                <div className="admin-house-row-main">
                  <div className="admin-house-row-name">{h.name}</div>
                  <div className="admin-house-row-owner">{h.owner_display_name || h.owner_email}</div>
                </div>
                <div className="admin-house-row-meta">
                  <div className="admin-house-row-members"><Users size={12} /> {h.member_count}</div>
                  <div className="admin-house-row-currency">{h.currency_code}</div>
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

      {openHouseId && (
        <HouseDetailModal houseId={openHouseId} onClose={() => setOpenHouseId(null)} />
      )}

      <style>{`
        .admin-houses-empty { text-align: center; padding: 60px 0; color: var(--ink-soft); }
        .admin-house-list { display: flex; flex-direction: column; gap: 8px; }
        .admin-house-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%;
        }
        .admin-house-row:hover { border-color: var(--accent); }
        .admin-house-row-main { flex: 1; min-width: 0; overflow: hidden; }
        .admin-house-row-name { font-weight: 700; font-size: 14px; }
        .admin-house-row-owner { font-size: 12px; color: var(--ink-soft); }
        .admin-house-row-meta { text-align: right; flex-shrink: 0; display: grid; gap: 4px; }
        .admin-house-row-members { display: flex; align-items: center; gap: 4px; justify-content: flex-end; font-size: 12px; font-weight: 600; }
        .admin-house-row-currency { font-size: 11px; color: var(--ink-soft); }
        .admin-users-pager { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .admin-users-pager-count { font-size: 12px; color: var(--ink-soft); }
      `}</style>
    </div>
  );
}

function HouseDetailModal({ houseId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    housesService
      .getHouseDetail(houseId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Error al cargar la casa"); });
    return () => { cancelled = true; };
  }, [houseId]);

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal admin-house-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-house-modal-header">
          <div style={{ fontWeight: 700, fontSize: 16 }}>Casa</div>
          <button type="button" className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="admin-house-modal-body hm-scroll">
          {error && <div className="admin-house-modal-error">{error}</div>}
          {!error && !detail && <div className="admin-houses-empty"><SecuritySpinner /></div>}

          {detail && (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="hm-avatar hm-avatar--lg">
                  {detail.photo ? <img src={detail.photo} alt="" /> : <Home size={24} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {detail.owner_display_name || detail.owner_email} · {detail.currency_code}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <Kv label="Creada">{new Date(detail.created_at).toLocaleDateString()}</Kv>
                <Kv label="Última actividad">
                  {detail.last_activity_at ? new Date(detail.last_activity_at).toLocaleString() : "Sin actividad registrada"}
                </Kv>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <SectionTitle icon={Home} title="Contenido" />
                <StatGrid>
                  <StatCard label="Rooms" value={detail.rooms_count} />
                  <StatCard label="Objects" value={detail.objects_count} />
                  <StatCard label="Tasks" value={detail.tasks_count} />
                  <StatCard label="Notes" value={detail.notes_count} />
                  <StatCard label="Shopping lists" value={detail.shopping_lists_count} />
                </StatGrid>
              </div>

              <div>
                <div className="admin-house-section-label"><Users size={12} /> Miembros ({detail.members.length})</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {detail.members.map((m) => (
                    <div key={m.user_id} className="admin-house-member-row">
                      <div className="hm-avatar hm-avatar--sm">{(m.display_name || m.email || "?").charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.display_name || m.email}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{m.email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="admin-house-member-role">{ROLE_LABELS[m.role] || m.role}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                          <Clock size={10} style={{ verticalAlign: "middle" }} /> {new Date(m.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{STAT_CARD_STYLES}</style>
      <style>{`
        .admin-house-modal { max-width: 520px; width: 100%; }
        .admin-house-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .admin-house-modal-body { padding: 18px; overflow-y: auto; max-height: 70vh; }
        .admin-house-section-label { font-size: 11px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .admin-house-member-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--surface-alt); border-radius: 10px; }
        .admin-house-member-role { font-size: 12px; font-weight: 700; }
        .admin-house-modal-error { padding: 12px; color: var(--danger); font-size: 13px; }
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
