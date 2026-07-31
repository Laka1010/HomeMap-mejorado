import { useEffect, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { economyGoalsService } from "./services/economyGoalsService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { normalizeText } from "../../utils/textMatch";

/**
 * Objetivos económicos: límite de gasto por categoría o ahorro objetivo.
 * Sin periodo que gestionar — el progreso se recalcula siempre sobre el mes
 * actual, a partir de `expenseCategoryTotals`/`balance` que ya calculó
 * EconomyOverview (no se vuelve a consultar nada). Diseño deliberadamente
 * mínimo: una tarjeta más, misma barra que las de Estadísticas.
 */
export function GoalsSection({ houseId, userId, expenseCategoryTotals, balance }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadGoals = async () => {
    if (!houseId) return;
    setLoading(true);
    try {
      setGoals(await economyGoalsService.listGoals(houseId));
    } catch (error) {
      console.error("Error loading economy goals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGoals(); }, [houseId]);

  const handleCreate = async (goal) => {
    try {
      await economyGoalsService.createGoal(houseId, userId, goal);
      setShowAdd(false);
      await loadGoals();
    } catch (error) {
      console.error("Error creating economy goal:", error);
      throw error;
    }
  };

  const handleDelete = async (goalId) => {
    try {
      await economyGoalsService.deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (error) {
      console.error("Error deleting economy goal:", error);
    }
  };

  return (
    <div className="hm-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          {t("goals.title")}
        </div>
        <button className="hm-btn hm-btn-ghost" style={{ padding: "4px 6px", fontSize: 13, color: "var(--accent)", fontWeight: 700 }} onClick={() => setShowAdd(true)}>
          <Plus size={14} /> {t("goals.add")}
        </button>
      </div>

      {!loading && goals.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("goals.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              current={goal.type === "spending_limit" ? (expenseCategoryTotals[normalizeText(goal.name)] || 0) : Math.max(0, balance)}
              onDelete={() => handleDelete(goal.id)}
              formatCurrency={formatCurrency}
              t={t}
            />
          ))}
        </div>
      )}

      {showAdd && <AddGoalModal onCreate={handleCreate} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function GoalRow({ goal, current, onDelete, formatCurrency, t }) {
  const isLimit = goal.type === "spending_limit";
  const target = parseFloat(goal.target_amount) || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const exceeded = isLimit && current > target;
  const reached = !isLimit && current >= target;
  const barColor = exceeded ? "var(--danger)" : reached ? "var(--success)" : "var(--accent)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Target size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal.name}</span>
        </div>
        <button className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onDelete} aria-label={t("goals.deleteAria")} style={{ color: "var(--ink-soft)", flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)" }}>
        <div style={{ height: "100%", borderRadius: 999, width: `${Math.max(4, pct)}%`, background: barColor }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: "var(--ink-soft)" }}>
        <span>{formatCurrency(current)} / {formatCurrency(target)}</span>
        {exceeded && <span style={{ color: "var(--danger)", fontWeight: 700 }}>{t("goals.exceeded")}</span>}
        {reached && <span style={{ color: "var(--success)", fontWeight: 700 }}>{t("goals.reached")}</span>}
      </div>
    </div>
  );
}

function AddGoalModal({ onCreate, onClose }) {
  const { t } = useTranslation();
  const [type, setType] = useState("spending_limit");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const targetAmount = parseFloat(amount);
    if (!targetAmount || targetAmount <= 0) return;
    if (type === "spending_limit" && !category.trim()) return;

    setSaving(true);
    setError("");
    try {
      await onCreate({
        type,
        name: type === "spending_limit" ? category.trim() : t("goals.savingsName"),
        targetAmount,
      });
    } catch (err) {
      setError(t("goals.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="hm-modal-handle" />
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("goals.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("goals.addTitle")}</h3>
        </div>
        <div className="hm-modal-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={"hm-btn hm-btn--full " + (type === "spending_limit" ? "hm-btn-primary" : "hm-btn-soft")}
              onClick={() => setType("spending_limit")}
            >
              {t("goals.typeSpendingLimit")}
            </button>
            <button
              type="button"
              className={"hm-btn hm-btn--full " + (type === "savings_target" ? "hm-btn-primary" : "hm-btn-soft")}
              onClick={() => setType("savings_target")}
            >
              {t("goals.typeSavingsTarget")}
            </button>
          </div>

          {type === "spending_limit" && (
            <>
              <label className="hm-label">{t("goals.categoryLabel")}</label>
              <input className="hm-input" placeholder={t("goals.categoryPlaceholder")} value={category} onChange={(e) => setCategory(e.target.value)} />
              <p style={{ fontSize: 11.5, color: "var(--ink-soft)", margin: "6px 0 0" }}>{t("goals.categoryHint")}</p>
            </>
          )}

          <label className="hm-label" style={{ marginTop: 14 }}>
            {type === "spending_limit" ? t("goals.limitAmountLabel") : t("goals.savingsAmountLabel")}
          </label>
          <input className="hm-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />

          {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("goals.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving}>{t("goals.create")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
