import { useEffect, useState } from "react";
import { securityAdminService } from "./services/securityAdminService";
import { Pager } from "./SecurityEventsView";
import { SecuritySpinner } from "./SecuritySpinner";

const PAGE_SIZE = 30;

/**
 * Auditoría del propio Security Center — solo lectura. No hay ni un solo
 * botón de borrado aquí a propósito: security_admin_audit_log no concede
 * DELETE/UPDATE a nadie (ni siquiera a un Security Admin) a nivel de base
 * de datos, así que no habría ninguna acción real que este botón pudiera
 * ejecutar.
 */
export function SecurityAuditLogView() {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (nextOffset = 0) => {
    setLoading(true);
    securityAdminService.listAuditLog(PAGE_SIZE, nextOffset)
      .then(({ rows, totalCount }) => { setRows(rows); setTotalCount(totalCount); setOffset(nextOffset); })
      .catch((e) => setError(e?.message || "Error al cargar la auditoría"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0); }, []);

  if (error) return <div className="sc-error">{error}</div>;
  if (loading) return <div className="sc-empty"><SecuritySpinner /></div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
        Registro inmutable de todas las acciones de administración. Ningún Security Admin puede borrar estas filas.
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.length === 0 && <div className="sc-empty" style={{ padding: 30 }}>Sin acciones registradas todavía.</div>}
        {rows.map((l) => (
          <div key={l.id} className="sc-audit-row">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{l.action}</span>
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{new Date(l.created_at).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <b>Security Admin:</b> {l.admin_display}
              {l.target_user_display && <> · <b>Target:</b> {l.target_user_display}</>}
              {l.target_ip && <> · <b>IP:</b> {l.target_ip}</>}
            </div>
            {l.reason && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}><b>Reason:</b> {l.reason}</div>}
          </div>
        ))}
      </div>
      <Pager offset={offset} pageSize={PAGE_SIZE} totalCount={totalCount} onChange={load} />

      <style>{`
        .sc-audit-row { padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
      `}</style>
    </div>
  );
}
