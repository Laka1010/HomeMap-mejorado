import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { securityAdminService } from "./services/securityAdminService";
import { SeverityBadge } from "./SeverityBadge";
import { SecuritySpinner } from "./SecuritySpinner";

const DURATIONS = [
  { label: "15 minutos", value: 15 },
  { label: "1 hora", value: 60 },
  { label: "24 horas", value: 60 * 24 },
  { label: "Indefinido", value: null },
];

export function SecurityIpBlocksView() {
  const [rows, setRows] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ip: "", reason: "", severity: "warning", duration: 60 });
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    securityAdminService.listIpBlocks(activeOnly)
      .then(setRows)
      .catch((e) => setError(e?.message || "Error al cargar bloqueos de IP"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeOnly]); // eslint-disable-line

  const submitBlock = async (e) => {
    e.preventDefault();
    if (!form.ip.trim() || !form.reason.trim()) {
      setError("IP y motivo son obligatorios");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await securityAdminService.blockIp(form.ip.trim(), form.reason.trim(), form.severity, form.duration);
      setForm({ ip: "", reason: "", severity: "warning", duration: 60 });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e?.message || "No se pudo bloquear la IP");
    } finally {
      setBusy(false);
    }
  };

  const unblock = async (ip) => {
    setBusy(true);
    setError("");
    try {
      await securityAdminService.unblockIp(ip);
      load();
    } catch (e) {
      setError(e?.message || "No se pudo desbloquear la IP");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Solo bloqueos activos
        </label>
        <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Block IP
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitBlock} className="sc-ip-form">
          <input className="hm-input" placeholder="Dirección IP (ej. 203.0.113.55)" value={form.ip} onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))} />
          <textarea className="hm-input" style={{ minHeight: 60 }} placeholder="Motivo (obligatorio)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="hm-input" style={{ width: "auto" }} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
              <option value="info">INFO</option>
              <option value="warning">HIGH</option>
              <option value="critical">CRITICAL</option>
            </select>
            <select
              className="hm-input"
              style={{ width: "auto" }}
              value={form.duration === null ? "null" : form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value === "null" ? null : Number(e.target.value) }))}
            >
              {DURATIONS.map((d) => <option key={d.label} value={d.value === null ? "null" : d.value}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" onClick={() => setShowForm(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="hm-btn hm-btn-primary hm-btn--compact" disabled={busy}>Confirmar bloqueo</button>
          </div>
        </form>
      )}

      {error && <div className="sc-error">{error}</div>}
      {loading && <div className="sc-empty"><SecuritySpinner /></div>}

      {!loading && (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.length === 0 && <div className="sc-empty" style={{ padding: 30 }}>Sin bloqueos de IP.</div>}
          {rows.map((b) => (
            <div key={b.id} className="sc-ip-row">
              <SeverityBadge severity={b.severity} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{b.ip}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{b.reason}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  Por {b.created_by_display} · {new Date(b.created_at).toLocaleString()} · {b.expires_at ? `expira ${new Date(b.expires_at).toLocaleString()}` : "indefinido"}
                </div>
              </div>
              {b.is_active ? (
                <button className="hm-btn hm-btn-ghost hm-btn--compact" disabled={busy} onClick={() => unblock(b.ip)}>Unblock</button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{b.unblocked_at ? "Unblocked" : "Expired"}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sc-ip-form { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-alt); }
        .sc-ip-row { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
