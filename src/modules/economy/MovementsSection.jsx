import { useEffect, useRef, useState } from "react";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { economyService } from "./services/economyService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";

export default function MovementsSection({ currentHome, openModal, initialType = "expenses" }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [type, setType] = useState(initialType);
  const [period, setPeriod] = useState("thisMonth"); // thisMonth | lastMonth | all
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState("");
  const prevTypeRef = useRef(type);

  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, period, currentHome?.id]);

  const loadItems = async () => {
    if (!currentHome?.id) return;
    // Al cambiar de tipo (gastos/ingresos) los items antiguos ya no aplican
    // (icono/color/signo dependen de `type`), así que se limpian antes de
    // pedir los nuevos. Al cambiar solo de periodo, se dejan visibles
    // (atenuados) mientras carga, para que la lista no colapse y la
    // estructura no "salte" — ver el contenedor con opacity más abajo.
    if (prevTypeRef.current !== type) {
      setItems([]);
    }
    prevTypeRef.current = type;
    setLoading(true);
    try {
      const data = type === "expenses"
        ? await economyService.getAllExpenses(currentHome.id, 200)
        : await economyService.getAllIncome(currentHome.id, 200);

      const filtered = filterByPeriod(data || [], period);
      setItems(filtered);
    } catch (err) {
      console.error("Error loading movements:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filterByPeriod = (data, p) => {
    if (p === "all") return data;
    const today = new Date();
    const monthStart = p === "thisMonth"
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthEnd = p === "thisMonth"
      ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
      : new Date(today.getFullYear(), today.getMonth(), 0);
    return data.filter((item) => {
      const d = new Date(item.date);
      return d >= monthStart && d <= monthEnd;
    });
  };

  const openDetail = (item) => {
    setSelected(item);
    setEditValues({ name: item.name, amount: item.amount, category: item.category, date: item.date, notes: item.notes });
    setIsEditing(false);
    setConfirmingDelete(false);
    setActionError("");
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelected(null);
    setIsEditing(false);
    setConfirmingDelete(false);
    setActionError("");
  };

  const saveEdit = async () => {
    if (!selected) return;
    const updates = {
      name: editValues.name,
      amount: parseFloat(editValues.amount) || 0,
      category: editValues.category,
      date: editValues.date,
      notes: editValues.notes,
    };
    try {
      if (type === "expenses") await economyService.updateExpense(selected.id, updates);
      else await economyService.updateIncome(selected.id, updates);
      await loadItems();
      setIsEditing(false);
      closeDetail();
    } catch (err) {
      console.error("Error updating movement:", err);
      setActionError(t("movements.updateError"));
    }
  };

  const confirmRemoveItem = async () => {
    if (!selected) return;
    try {
      if (type === "expenses") await economyService.deleteExpense(selected.id);
      else await economyService.deleteIncome(selected.id);
      await loadItems();
      closeDetail();
    } catch (err) {
      console.error("Error deleting movement:", err);
      setActionError(t("movements.deleteError"));
      setConfirmingDelete(false);
    }
  };

  const accent = type === "expenses" ? "var(--danger)" : "var(--success)";
  const accentSoft = type === "expenses" ? "var(--danger-soft)" : "var(--success-soft)";

  const periodPill = (active) => ({
    padding: "6px 12px",
    background: active ? "var(--surface)" : "transparent",
    border: "none",
    borderRadius: 999,
    color: active ? "var(--ink)" : "var(--ink-soft)",
    fontWeight: active ? 700 : 500,
    fontSize: 12.5,
    cursor: "pointer",
    boxShadow: active ? "var(--shadow-elev-1)" : "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header: toggle + add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 999, padding: 4 }}>
          <button
            onClick={() => setType("expenses")}
            style={{
              padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13.5,
              background: type === "expenses" ? "var(--danger)" : "transparent",
              color: type === "expenses" ? "#fff" : "var(--ink-soft)",
            }}
          >
            {t("movements.expensesTab")}
          </button>
          <button
            onClick={() => setType("income")}
            style={{
              padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13.5,
              background: type === "income" ? "var(--success)" : "transparent",
              color: type === "income" ? "#fff" : "var(--ink-soft)",
            }}
          >
            {t("movements.incomeTab")}
          </button>
        </div>
        <button
          className="hm-btn hm-btn-primary hm-btn--compact"
          onClick={() => openModal && openModal(type === "expenses" ? "addExpense" : "addIncome")}
        >
          <Plus size={15} /> {t("movements.add")}
        </button>
      </div>

      {/* Period pills */}
      <div style={{ display: "flex", gap: 6 }}>
        <button style={periodPill(period === "thisMonth")} onClick={() => setPeriod("thisMonth")}>{t("movements.thisMonth")}</button>
        <button style={periodPill(period === "lastMonth")} onClick={() => setPeriod("lastMonth")}>{t("movements.lastMonth")}</button>
        <button style={periodPill(period === "all")} onClick={() => setPeriod("all")}>{t("movements.all")}</button>
      </div>

      {/* List */}
      <div className="hm-card" style={{ padding: 18, minHeight: 220 }}>
        {loading && items.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("movements.loading")}</div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
            {type === "expenses" ? t("movements.noExpenses") : t("movements.noIncome")}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s ease" }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => !loading && openDetail(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: accentSoft, display: "grid", placeItems: "center", flexShrink: 0, color: accent }}>
                  {type === "expenses" ? <TrendingDown size={17} /> : <TrendingUp size={17} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{item.category || "Otros"} · {item.date}</div>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: accent, whiteSpace: "nowrap" }}>
                  {type === "expenses" ? "-" : "+"}{formatCurrency(item.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetail && selected && (
        <div className="hm-modal-overlay" onClick={closeDetail}>
          <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="hm-modal-handle" />
            <div className="hm-modal-header">
              <button className="hm-modal-close" onClick={closeDetail} aria-label="Cerrar">✕</button>
              <h3 className="hm-display hm-modal-title">{selected.name}</h3>
            </div>
            <div className="hm-modal-body">
              {!isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{selected.category || "Otros"}</div>
                    <div style={{ fontWeight: 700, color: accent }}>{formatCurrency(selected.amount)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("movements.dateLabel")} <strong>{selected.date}</strong></div>
                  {selected.notes && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>{t("movements.notesLabel")}</div>
                      <div style={{ background: "var(--surface-alt)", padding: 8, borderRadius: 8 }}>{selected.notes}</div>
                    </div>
                  )}
                  {actionError && (
                    <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", padding: "8px 10px", borderRadius: 8 }}>{actionError}</div>
                  )}

                  {!confirmingDelete ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button className="hm-btn hm-btn-soft" onClick={() => setIsEditing(true)}>{t("movements.edit")}</button>
                      <button className="hm-btn hm-btn-ghost" onClick={() => { setActionError(""); setConfirmingDelete(true); }} style={{ color: "var(--danger)" }}>{t("movements.delete")}</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, background: "var(--danger-soft)", padding: 12, borderRadius: 12 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{type === "expenses" ? t("movements.confirmDeleteExpense") : t("movements.confirmDeleteIncome")} {t("movements.cannotUndo")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="hm-btn hm-btn-soft" onClick={() => setConfirmingDelete(false)}>{t("movements.cancel")}</button>
                        <button className="hm-btn hm-btn--danger" onClick={confirmRemoveItem}>{t("movements.confirmYesDelete")}</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label className="hm-label">{t("movements.nameLabel")}</label>
                  <input className="hm-input" value={editValues.name} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />

                  <label className="hm-label">{t("movements.amountLabel")}</label>
                  <input type="number" className="hm-input" value={editValues.amount} onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })} />

                  <label className="hm-label">{t("movements.dateLabel").replace(":", "")}</label>
                  <input type="date" className="hm-input" value={editValues.date ? editValues.date.slice(0, 10) : ""} onChange={(e) => setEditValues({ ...editValues, date: e.target.value })} />

                  <label className="hm-label">{t("movements.categoryLabel")}</label>
                  <input className="hm-input" value={editValues.category || ""} onChange={(e) => setEditValues({ ...editValues, category: e.target.value })} />

                  <label className="hm-label">{t("movements.notesLabel")}</label>
                  <textarea className="hm-input" value={editValues.notes || ""} onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })} />

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="hm-btn hm-btn-primary" onClick={saveEdit}>{t("movements.save")}</button>
                    <button className="hm-btn hm-btn-soft" onClick={() => setIsEditing(false)}>{t("movements.cancel")}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
