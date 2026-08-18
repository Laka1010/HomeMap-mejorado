import { useEffect, useRef, useState } from "react";
import { Plus, TrendingUp, TrendingDown, ShoppingCart } from "lucide-react";
import { economyService } from "./services/economyService";
import { accountsService } from "./services/accountsService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./economyCategories";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

export default function MovementsSection({ currentHome, spaceId, user, initialType = "expenses" }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [type, setType] = useState(initialType);
  const [period, setPeriod] = useState("thisMonth"); // thisMonth | lastMonth | all
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
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
  }, [type, period, spaceId]);

  useEffect(() => {
    if (!spaceId) return;
    accountsService.listAccounts(spaceId).then((list) => setAccounts(list.filter((a) => a.status === "active"))).catch(() => {});
  }, [spaceId]);

  const loadItems = async () => {
    if (!spaceId) return;
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
        ? await economyService.getAllExpensesBySpace(spaceId, 200)
        : await economyService.getAllIncomeBySpace(spaceId, 200);

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
    setEditValues({ name: item.name, amount: item.amount, category: item.category, date: item.date, notes: item.notes, account_id: item.account_id });
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

  const { handleRef: detailHandleRef, handleMouseDown: detailHandleMouseDown, isSuppressingClick: isDetailSuppressingClick, sheetStyle: detailSheetStyle } = useDragToDismiss(closeDetail);

  const saveEdit = async () => {
    if (!selected) return;
    const updates = {
      name: editValues.name,
      amount: parseFloat(editValues.amount) || 0,
      category: editValues.category,
      date: editValues.date,
      notes: editValues.notes,
      account_id: editValues.account_id,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
          onClick={() => setShowAdd(true)}
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
                <div className="hm-row-icon" style={{ background: accentSoft, color: accent }}>
                  {type === "expenses" ? <TrendingDown size={17} /> : <TrendingUp size={17} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    {type === "expenses" && item.shopping_purchase_id ? (
                      <ShoppingCart size={11} style={{ color: "var(--ink-soft)", flexShrink: 0 }} title={t("movements.fromPurchase")} />
                    ) : null}
                  </div>
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
        <div className="hm-modal-overlay" onClick={(e) => { if (isDetailSuppressingClick()) return; closeDetail(e); }}>
          <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, ...detailSheetStyle }}>
            <div ref={detailHandleRef} className="hm-modal-handle-wrap" onMouseDown={detailHandleMouseDown}>
              <div className="hm-modal-handle" />
            </div>
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
                  <select className="hm-input" value={editValues.category || (type === "expenses" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0])} onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}>
                    {(type === "expenses" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {accounts.length > 0 && (
                    <>
                      <label className="hm-label">{t("accounts.title")}</label>
                      <select className="hm-input" value={editValues.account_id || ""} onChange={(e) => setEditValues({ ...editValues, account_id: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                      </select>
                    </>
                  )}

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

      {showAdd && (
        <AddMovementModal
          type={type}
          spaceId={spaceId}
          userId={user?.id}
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadItems(); }}
        />
      )}
    </div>
  );
}

function AddMovementModal({ type, spaceId, userId, accounts, onClose, onCreated }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const categories = type === "expenses" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.is_default)?.id || accounts[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || !parsedAmount || parsedAmount <= 0) return;

    setSaving(true);
    setError("");
    const payload = {
      financial_space_id: spaceId,
      account_id: accountId || undefined,
      created_by: userId,
      performed_by: userId,
      name: name.trim(),
      amount: parsedAmount,
      category,
      notes: notes.trim() || null,
    };

    try {
      if (type === "expenses") await economyService.createExpense(payload);
      else await economyService.createIncome(payload);
      onCreated();
    } catch (err) {
      console.error("Error creating movement:", err);
      setError(t("movements.updateError"));
      setSaving(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("movements.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("movements.add")}</h3>
        </div>
        <div className="hm-modal-body">
          <label className="hm-label">{t("movements.nameLabel")}</label>
          <input className="hm-input" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="hm-label" style={{ marginTop: 14 }}>{t("movements.amountLabel")}</label>
          <input type="number" className="hm-input" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <label className="hm-label" style={{ marginTop: 14 }}>{t("movements.categoryLabel")}</label>
          <select className="hm-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {accounts.length > 0 && (
            <>
              <label className="hm-label" style={{ marginTop: 14 }}>{t("accounts.title")}</label>
              <select className="hm-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </>
          )}

          <label className="hm-label" style={{ marginTop: 14 }}>{t("movements.notesLabel")}</label>
          <textarea className="hm-input" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("movements.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving || !name.trim() || !amount}>
              {t("movements.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
