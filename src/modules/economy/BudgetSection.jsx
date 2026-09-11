import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { economyGoalsService } from "./services/economyGoalsService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { normalizeText } from "../../utils/textMatch";
import { categoryLabel, categoryEmoji } from "./economyCategories";
import { useEconomyCategories } from "./EconomyCategoriesContext";
import { CategoryField } from "./CategoryField";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";
import { AmountHero, FieldGroup } from "../../components/MoneyEntry";

/**
 * Presupuesto del mes: cuánto quieres gastar como máximo, por categoría de
 * gasto. Reutiliza economy_goals (siempre type='spending_limit' — el tipo
 * 'savings_target' que tenía Objetivos ya no se crea desde aquí, aunque el
 * check de la tabla lo sigue permitiendo por si quedan filas antiguas).
 * Sin periodo que gestionar: el progreso se recalcula siempre sobre el mes
 * actual, a partir de `expenseCategoryTotals` que ya calculó EconomyOverview.
 */
export function BudgetSection({ houseId, userId, expenseCategoryTotals }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const { expense: expenseCategories } = useEconomyCategories();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!houseId) return;
    setLoading(true);
    try {
      const rows = await economyGoalsService.listGoals(houseId);
      setBudgets((rows || []).filter((g) => g.type === "spending_limit"));
    } catch (error) {
      console.error("Error loading budget:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [houseId]);

  const handleDelete = async (goalId) => {
    try {
      await economyGoalsService.deleteGoal(goalId);
      setBudgets((prev) => prev.filter((g) => g.id !== goalId));
    } catch (error) {
      console.error("Error deleting budget row:", error);
    }
  };

  return (
    <div className="hm-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          {t("budget.title")}
        </div>
        <button className="hm-btn hm-btn-ghost" style={{ padding: "4px 6px", fontSize: 13, color: "var(--accent)", fontWeight: 700 }} onClick={() => setShowAdd(true)}>
          <Plus size={14} /> {t("budget.add")}
        </button>
      </div>

      {!loading && budgets.length === 0 ? (
        <div style={{ padding: "16px 0", display: "grid", gap: 10, justifyItems: "center", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
          {t("budget.empty")}
          <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setShowAdd(true)}>{t("budget.setBudget")}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {budgets.map((b) => (
            <BudgetRow
              key={b.id}
              budget={b}
              spent={expenseCategoryTotals[normalizeText(b.name)] || 0}
              onDelete={() => handleDelete(b.id)}
              formatCurrency={formatCurrency}
              t={t}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddBudgetModal
          houseId={houseId}
          userId={userId}
          categories={expenseCategories}
          budgets={budgets}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function BudgetRow({ budget, spent, onDelete, formatCurrency, t }) {
  const target = parseFloat(budget.target_amount) || 0;
  const pct = target > 0 ? Math.min(100, (spent / target) * 100) : 0;
  const exceeded = target > 0 && spent > target;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {categoryEmoji(budget.name)} {categoryLabel(budget.name, t)}
        </span>
        <button className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onDelete} aria-label={t("budget.deleteAria")} style={{ color: "var(--ink-soft)", flexShrink: 0 }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)" }}>
        <div style={{ height: "100%", borderRadius: 999, width: `${Math.max(4, pct)}%`, background: exceeded ? "var(--danger)" : "var(--accent)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: "var(--ink-soft)" }}>
        <span>{formatCurrency(spent)} / {formatCurrency(target)}</span>
        {exceeded && <span style={{ color: "var(--danger)", fontWeight: 700 }}>{t("budget.exceeded")}</span>}
      </div>
    </div>
  );
}

/**
 * Alta de un presupuesto: importe primero (protagonista, como en
 * Movimientos/Facturas) y luego la categoría a la que se aplica. Si la
 * categoría elegida ya tiene presupuesto, esto lo ACTUALIZA (upsert) en vez
 * de crear un duplicado — así también sirve para corregir un importe sin
 * un flujo de edición aparte.
 */
function AddBudgetModal({ houseId, userId, categories, budgets, onClose, onSaved }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsedAmount = parseFloat(amount);
  const valid = parsedAmount > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const existing = budgets.find((b) => b.name === category);
      if (existing) {
        await economyGoalsService.updateGoal(existing.id, parsedAmount);
      } else {
        await economyGoalsService.createGoal(houseId, userId, { type: "spending_limit", name: category, targetAmount: parsedAmount });
      }
      onSaved();
    } catch (err) {
      console.error("Error saving budget:", err);
      setError(t("budget.saveError"));
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
          <button className="hm-modal-close" onClick={onClose} aria-label={t("budget.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("budget.addTitle")}</h3>
        </div>
        <div className="hm-modal-body">
          <AmountHero value={amount} onChange={setAmount} />

          <FieldGroup label={t("budget.categoryLabel")}>
            <CategoryField
              categories={categories}
              value={category}
              onChange={setCategory}
              variant="row"
              title={t("budget.categoryLabel")}
            />
          </FieldGroup>

          {error && <p className="hm-money-error">{error}</p>}

          <div className="hm-money-actions">
            <button className="hm-btn hm-btn-soft" onClick={onClose} disabled={saving}>{t("budget.cancel")}</button>
            <button className="hm-btn hm-btn-primary hm-btn--full" onClick={handleSubmit} disabled={saving || !valid}>{t("budget.save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
