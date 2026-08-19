import { useEffect, useRef, useState } from "react";
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingCart } from "lucide-react";
import { economyService } from "./services/economyService";
import { accountsService } from "./services/accountsService";
import { transfersService } from "./services/transfersService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DEFAULT_CATEGORY } from "./economyCategories";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

/**
 * Movimientos = "qué ha pasado con mi dinero": las tres formas en que el
 * dinero se mueve — entra (ingresos), sale (gastos) y cambia de sitio
 * (transferencias/aportaciones entre cuentas o Spaces).
 *
 * Lo que NO es esta pantalla: un sitio donde registrar compras. Los
 * productos, cantidades y listas viven en Compras; cuando una compra se
 * cierra con importe > 0 genera aquí su gasto automáticamente (ver
 * registerPurchaseExpense en App.jsx) y se marca con el distintivo "Compras"
 * — mismo dato, un único origen, sin doble registro.
 *
 * Las transferencias se listan pero no se crean aquí: nacen en Cuentas
 * (AccountsSection -> TransferModal), que es donde el usuario elige cuenta
 * origen y destino. Este listado es solo lectura para no duplicar ese alta.
 */
export default function MovementsSection({ currentHome, spaceId, user, initialType = "expenses" }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [type, setType] = useState(initialType);
  const [period, setPeriod] = useState("thisMonth"); // thisMonth | lastMonth | all
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  // Ids de TODAS las cuentas del Space (incluidas las archivadas), no solo
  // las activas de `accounts`: se usan para saber si una transferencia entra
  // o sale de este Space, y una cuenta archivada sigue teniendo histórico.
  const [spaceAccountIds, setSpaceAccountIds] = useState(() => new Set());
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
    accountsService.listAccounts(spaceId).then((list) => {
      setAccounts(list.filter((a) => a.status === "active"));
      setSpaceAccountIds(new Set(list.map((a) => a.id)));
    }).catch(() => {});
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
      if (type === "transfers") {
        const rows = await transfersService.listTransfersForSpace(spaceId);
        // Se normaliza created_at -> date para reutilizar tal cual
        // filterByPeriod y el pintado de la fila, en vez de duplicar ambos
        // solo porque esta tabla llama distinto a su fecha.
        const normalized = (rows || []).map((tr) => ({ ...tr, date: (tr.created_at || "").slice(0, 10) }));
        setItems(filterByPeriod(normalized, period));
        return;
      }

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
      // El servicio devuelve false cuando el DELETE no llegó a tocar ninguna
      // fila (RLS, o la fila ya no existe); sin comprobarlo, la pantalla se
      // cerraba como si hubiera funcionado y el movimiento reaparecía al
      // recargar.
      const deleted = type === "expenses"
        ? await economyService.deleteExpense(selected.id)
        : await economyService.deleteIncome(selected.id);
      if (!deleted) {
        setActionError(t("movements.deleteError"));
        setConfirmingDelete(false);
        return;
      }
      await loadItems();
      closeDetail();
    } catch (err) {
      console.error("Error deleting movement:", err);
      setActionError(t("movements.deleteError"));
      setConfirmingDelete(false);
    }
  };

  const accent = type === "expenses" ? "var(--danger)" : type === "income" ? "var(--success)" : "var(--ink-soft)";
  const accentSoft = type === "expenses" ? "var(--danger-soft)" : type === "income" ? "var(--success-soft)" : "var(--surface-alt)";

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
        <div className="hm-scroll" style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 999, padding: 4, maxWidth: "100%", overflowX: "auto" }}>
          <button
            onClick={() => setType("expenses")}
            style={{
              padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", flexShrink: 0,
              background: type === "expenses" ? "var(--danger)" : "transparent",
              color: type === "expenses" ? "#fff" : "var(--ink-soft)",
            }}
          >
            {t("movements.expensesTab")}
          </button>
          <button
            onClick={() => setType("income")}
            style={{
              padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", flexShrink: 0,
              background: type === "income" ? "var(--success)" : "transparent",
              color: type === "income" ? "#fff" : "var(--ink-soft)",
            }}
          >
            {t("movements.incomeTab")}
          </button>
          <button
            onClick={() => setType("transfers")}
            style={{
              padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", flexShrink: 0,
              background: type === "transfers" ? "var(--accent)" : "transparent",
              color: type === "transfers" ? "var(--accent-ink)" : "var(--ink-soft)",
            }}
          >
            {t("movements.transfersTab")}
          </button>
        </div>
        {/* Transferencias es solo lectura aquí: se crean en Cuentas, donde
            existe el selector de cuenta origen/destino. Mostrar un "Añadir"
            que abriera un formulario distinto sería un segundo sitio para la
            misma operación. */}
        {type !== "transfers" ? (
          <button
            className="hm-btn hm-btn-primary hm-btn--compact"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={15} /> {t("movements.add")}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t("movements.transfersCreatedInAccounts")}</span>
        )}
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
            {type === "expenses" ? t("movements.noExpenses") : type === "income" ? t("movements.noIncome") : t("movements.noTransfers")}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s ease" }}>
            {items.map((item, idx) => {
              // Una transferencia no "es" gasto ni ingreso: el signo y el
              // color dependen de si sale de una cuenta de este Space o
              // entra en ella, no del tipo de movimiento.
              const isTransfer = type === "transfers";
              // Si las dos cuentas son de este Space el dinero no ha entrado
              // ni salido, solo ha cambiado de sitio: mostrarlo con signo
              // (como si fuera salida) haría creer que hay menos dinero.
              const internal = isTransfer && spaceAccountIds.has(item.from_account_id) && spaceAccountIds.has(item.to_account_id);
              const outgoing = isTransfer && !internal && spaceAccountIds.has(item.from_account_id);
              const rowAccent = !isTransfer ? accent : internal ? "var(--ink-soft)" : outgoing ? "var(--danger)" : "var(--success)";
              const title = isTransfer
                ? (item.note || (item.kind === "contribution" ? t("movements.transferContribution") : t("movements.transferTitle")))
                : item.name;
              const transferDirection = internal ? t("movements.transferInternal") : outgoing ? t("movements.transferOut") : t("movements.transferIn");
              const subtitle = isTransfer
                ? `${transferDirection} · ${item.date}`
                : `${item.category || "Otros"} · ${item.date}`;
              return (
                <div
                  key={item.id}
                  onClick={() => { if (!loading && !isTransfer) openDetail(item); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: isTransfer ? "default" : "pointer",
                  }}
                >
                  <div className="hm-row-icon" style={{ background: accentSoft, color: accent }}>
                    {isTransfer ? <ArrowLeftRight size={17} /> : type === "expenses" ? <TrendingDown size={17} /> : <TrendingUp size={17} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                      {/* El origen "Compras" se etiqueta con texto, no solo
                          con un icono + title: en móvil no hay hover, así
                          que el tooltip nunca llegaba a verse y el gasto
                          parecía uno más creado a mano. */}
                      {type === "expenses" && item.shopping_purchase_id ? (
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                            padding: "1px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                            background: "var(--surface-alt)", color: "var(--ink-soft)",
                          }}
                        >
                          <ShoppingCart size={10} /> {t("movements.fromPurchaseTag")}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{subtitle}</div>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: rowAccent, whiteSpace: "nowrap" }}>
                    {isTransfer ? (internal ? "" : outgoing ? "-" : "+") : type === "expenses" ? "-" : "+"}{formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })}
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
                  {selected.shopping_purchase_id ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--surface-alt)", padding: "10px 12px", borderRadius: 10 }}>
                      <ShoppingCart size={14} style={{ color: "var(--ink-soft)", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("movements.fromPurchaseDetail")}</div>
                    </div>
                  ) : null}
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
                      {selected.shopping_purchase_id ? (
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("movements.deleteKeepsPurchase")}</div>
                      ) : null}
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
                  <select className="hm-input" value={editValues.category || DEFAULT_CATEGORY} onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}>
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
  // "Otros" y no categories[0]: el primer elemento es una categoría real
  // ("Alimentación"/"Salario"), así que quien no toque el desplegable acaba
  // falseando las estadísticas por categoría. Ver DEFAULT_CATEGORY.
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
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
