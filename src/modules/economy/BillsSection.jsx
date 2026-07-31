import React, { useEffect, useState } from "react";
import { economyService } from "./services/economyService";
import { Plus, Calendar, CheckCircle2, Star } from "lucide-react";
import { FavoriteStar } from "../../components/FavoriteStar";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";

export default function BillsSection({ currentHome, openModal, state, dispatch, user }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const FREQUENCY_LABELS = {
    once: t("bills.once"),
    monthly: t("bills.monthly"),
    quarterly: t("bills.quarterly"),
    semiannual: t("bills.semiannual"),
    every9months: t("bills.every9months"),
    yearly: t("bills.yearly"),
  };
  const [filter, setFilter] = useState("pending"); // pending | upcoming | paid | favorites
  const [bills, setBills] = useState([]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, currentHome?.id]);

  const loadBills = async () => {
    if (!currentHome?.id) return;
    setLoading(true);
    try {
      let data = [];
      if (filter === "pending") {
        data = await economyService.getPendingBills(currentHome.id);
      } else {
        // load all and filter locally for upcoming/paid
        data = await economyService.getAllBills(currentHome.id);
      }

      if (filter === "upcoming") {
        const today = new Date();
        data = (data || []).filter((b) => b.status === "pending" && new Date(b.due_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
      }

      if (filter === "paid") {
        data = (data || []).filter((b) => b.status === "paid").sort((a,b)=> new Date(b.paid_date) - new Date(a.paid_date));
      }

      if (filter === "favorites") {
        data = (data || []).filter((b) => b.favorite);
      }

      // Sort pending / upcoming / favorites by due_date asc
      if (filter === "pending" || filter === "upcoming" || filter === "favorites") {
        data = (data || []).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      }

      setBills(data || []);
    } catch (err) {
      console.error("Error loading bills:", err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntil = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const openDetail = (bill) => {
    setSelectedBill(bill);
    setEditValues({ name: bill.name, amount: bill.amount, due_date: bill.due_date, category: bill.category, frequency: bill.frequency, notes: bill.notes });
    setIsEditing(false);
    setConfirmingDelete(false);
    setActionError("");
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedBill(null);
    setConfirmingDelete(false);
    setActionError("");
  };

  const markAsPaid = async (bill) => {
    try {
      await economyService.markBillAsPaid(bill.id);
      // optimistic update in dispatch if available
      if (dispatch) {
        dispatch((s) => ({ ...s, bills: (s.bills || []).map((b) => (b.id === bill.id ? { ...b, status: "paid", paid_date: new Date().toISOString().slice(0,10) } : b)) }));
      }
      // Reflect the payment as an expense so it counts in the economy summary/movements.
      if (currentHome?.id && user?.id) {
        economyService.createExpense({
          house_id: currentHome.id,
          created_by: user.id,
          name: bill.name,
          amount: bill.amount,
          category: bill.category || "Otros",
        }).catch((err) => console.error("Error registrando el gasto de la factura:", err));
      }
      await loadBills();
      closeDetail();
    } catch (err) {
      console.error(err);
      setActionError(t("bills.markPaidError"));
    }
  };

  const toggleFavorite = async (bill) => {
    try {
      await economyService.updateBill(bill.id, { favorite: !bill.favorite });
      await loadBills();
    } catch (err) {
      console.error("Error updating bill favorite:", err);
    }
  };

  const confirmRemoveBill = async (billId) => {
    try {
      const ok = await economyService.deleteBill(billId);
      if (ok) {
        if (dispatch) dispatch((s) => ({ ...s, bills: (s.bills || []).filter((b) => b.id !== billId) }));
        await loadBills();
        closeDetail();
      } else {
        setActionError(t("bills.deleteError"));
        setConfirmingDelete(false);
      }
    } catch (err) {
      console.error(err);
      setActionError(t("bills.deleteErrorGeneric"));
      setConfirmingDelete(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedBill) return;
    try {
      const updates = {
        name: editValues.name,
        amount: parseFloat(editValues.amount) || 0,
        due_date: editValues.due_date,
        category: editValues.category,
        frequency: editValues.frequency,
        notes: editValues.notes,
      };
      const updated = await economyService.updateBill(selectedBill.id, updates);
      if (updated) {
        await loadBills();
        setIsEditing(false);
        setSelectedBill(updated);
      }
    } catch (err) {
      console.error(err);
      setActionError(t("bills.updateError"));
    }
  };

  const filterPill = (active) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-ink)" : "var(--ink-soft)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header: filtro + añadir */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 999, padding: 4, flexWrap: "wrap" }}>
          <button style={filterPill(filter === "pending")} onClick={() => setFilter("pending")}>{t("bills.filterPending")}</button>
          <button style={filterPill(filter === "upcoming")} onClick={() => setFilter("upcoming")}>{t("bills.filterUpcoming")}</button>
          <button style={filterPill(filter === "paid")} onClick={() => setFilter("paid")}>{t("bills.filterPaid")}</button>
          <button style={filterPill(filter === "favorites")} onClick={() => setFilter("favorites")}>
            <Star size={12} fill={filter === "favorites" ? "currentColor" : "none"} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t("common.favoritesFilter")}
          </button>
        </div>
        <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => openModal && openModal("addBill")}>
          <Plus size={15} /> {t("bills.add")}
        </button>
      </div>

      <div className="hm-card" style={{ padding: 18 }}>
        {loading && <div style={{ padding: 20, textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("bills.loading")}</div>}

        {!loading && bills.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
            {filter === "favorites" ? t("bills.noFavoriteBills") : t("bills.noBills")}
          </div>
        )}

        {!loading && bills.slice(0, visibleCount).map((bill, idx) => {
          const days = getDaysUntil(bill.due_date);
          const isLast = idx === Math.min(bills.length, visibleCount) - 1;
          const isPaid = bill.status === "paid";
          const overdue = !isPaid && days !== null && days < 0;
          const urgent = !isPaid && days !== null && days >= 0 && days <= 3;
          const statusText = isPaid
            ? t("bills.paidOn", { date: bill.paid_date || "" })
            : days !== null
            ? (days < 0 ? t("bills.overdueDays", { days: Math.abs(days) }) : t("bills.dueInDays", { days }))
            : "";
          const statusColor = isPaid ? "var(--success)" : overdue ? "var(--danger)" : urgent ? "var(--pin)" : "var(--ink-soft)";
          const iconBg = isPaid ? "var(--success-soft)" : overdue ? "var(--danger-soft)" : urgent ? "var(--pin-soft)" : "var(--surface-alt)";
          const iconColor = isPaid ? "var(--success)" : overdue ? "var(--danger)" : urgent ? "var(--pin)" : "var(--ink-soft)";

          return (
            <div
              key={bill.id}
              onClick={() => openDetail(bill)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: isLast ? "none" : "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: iconBg, display: "grid", placeItems: "center", flexShrink: 0, color: iconColor }}>
                {isPaid ? <CheckCircle2 size={17} /> : <Calendar size={17} />}
              </div>
              <FavoriteStar active={bill.favorite} onToggle={() => toggleFavorite(bill)} size={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{bill.category || "Otros"} · {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : "-"}</div>
                {statusText && <div style={{ fontSize: 11.5, color: statusColor, fontWeight: 700, marginTop: 2 }}>{statusText}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(bill.amount)}</div>
                {bill.status === "pending" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsPaid(bill); }}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", padding: 0 }}
                  >
                    {t("bills.markPaid")}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && bills.length > visibleCount && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => setVisibleCount((v) => v + 8)}
              style={{ background: "none", border: "none", color: "var(--ink-soft)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {t("bills.viewMore")}
            </button>
          </div>
        )}
      </div>

      {/* Detalle modal */}
      {showDetail && selectedBill && (
        <div className="hm-modal-overlay" onClick={closeDetail}>
          <div className="hm-modal hm-scroll" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="hm-modal-handle" />
            <div className="hm-modal-header">
              <button className="hm-modal-close" onClick={closeDetail} aria-label={t("bills.close")}>✕</button>
              <h3 className="hm-display hm-modal-title">{selectedBill.name}</h3>
            </div>
            <div className="hm-modal-body">
              {!isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{selectedBill.category} • {FREQUENCY_LABELS[selectedBill.frequency] || t("bills.once")}</div>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(selectedBill.amount)}</div>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                    {t("bills.dueDateLabel")} <strong>{selectedBill.due_date ? new Date(selectedBill.due_date).toLocaleDateString() : '-'}</strong>
                  </div>

                  {selectedBill.attachment_url && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>{t("bills.attachmentLabel")}</div>
                      <div><a href={selectedBill.attachment_url} target="_blank" rel="noreferrer">{t("bills.viewAttachment")}</a></div>
                    </div>
                  )}

                  {selectedBill.notes && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>{t("bills.notesLabel")}</div>
                      <div style={{ background: "var(--surface-alt)", padding: 8, borderRadius: 8 }}>{selectedBill.notes}</div>
                    </div>
                  )}

                  {actionError && (
                    <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", padding: "8px 10px", borderRadius: 8 }}>{actionError}</div>
                  )}

                  {!confirmingDelete ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      {selectedBill.status === "pending" && (
                        <button className="hm-btn hm-btn-primary" onClick={() => markAsPaid(selectedBill)}>{t("bills.markAsPaidButton")}</button>
                      )}
                      <button className="hm-btn hm-btn-soft" onClick={() => setIsEditing(true)}>{t("bills.edit")}</button>
                      <button className="hm-btn hm-btn-ghost" onClick={() => { setActionError(""); setConfirmingDelete(true); }} style={{ color: 'var(--danger)' }}>{t("bills.delete")}</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, background: "var(--danger-soft)", padding: 12, borderRadius: 12 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("bills.confirmDelete")} {t("bills.cannotUndo")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="hm-btn hm-btn-soft" onClick={() => setConfirmingDelete(false)}>{t("bills.cancel")}</button>
                        <button className="hm-btn hm-btn--danger" onClick={() => confirmRemoveBill(selectedBill.id)}>{t("bills.confirmYesDelete")}</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label className="hm-label">{t("bills.nameLabel")}</label>
                  <input className="hm-input" value={editValues.name} onChange={(e)=> setEditValues({...editValues, name: e.target.value})} />

                  <label className="hm-label">{t("bills.amountLabel")}</label>
                  <input type="number" className="hm-input" value={editValues.amount} onChange={(e)=> setEditValues({...editValues, amount: e.target.value})} />

                  <label className="hm-label">{t("bills.dueDateLabel").replace(":", "")}</label>
                  <input type="date" className="hm-input" value={editValues.due_date ? editValues.due_date.slice(0,10) : ''} onChange={(e)=> setEditValues({...editValues, due_date: e.target.value})} />

                  <label className="hm-label">{t("bills.categoryLabel")}</label>
                  <input className="hm-input" value={editValues.category} onChange={(e)=> setEditValues({...editValues, category: e.target.value})} />

                  <label className="hm-label">{t("bills.repetitionLabel")}</label>
                  <select className="hm-input" value={editValues.frequency || "once"} onChange={(e)=> setEditValues({...editValues, frequency: e.target.value})}>
                    <option value="once">{t("bills.once")}</option>
                    <option value="monthly">{t("bills.monthly")}</option>
                    <option value="quarterly">{t("bills.quarterly")}</option>
                    <option value="semiannual">{t("bills.semiannual")}</option>
                    <option value="every9months">{t("bills.every9months")}</option>
                    <option value="yearly">{t("bills.yearly")}</option>
                  </select>

                  <label className="hm-label">{t("bills.notesLabel")}</label>
                  <textarea className="hm-input" value={editValues.notes || ''} onChange={(e)=> setEditValues({...editValues, notes: e.target.value})} />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="hm-btn hm-btn-primary" onClick={saveEdit}>{t("bills.save")}</button>
                    <button className="hm-btn hm-btn-soft" onClick={() => setIsEditing(false)}>{t("bills.cancel")}</button>
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
