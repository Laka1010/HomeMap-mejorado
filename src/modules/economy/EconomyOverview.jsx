import { useState, useEffect } from "react";
import { ChevronRight, Gift, Sparkles, Tag, Calendar } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { normalizeText } from "../../utils/textMatch";
import { toLocalDateString } from "../../utils/dates";
import { GoalsSection } from "./GoalsSection";
import { AccountsSection } from "./AccountsSection";

const ENTRY_ICONS = {
  "Regalos recibidos": Gift,
  "Suscripciones": Sparkles,
};

export function EconomyOverview({ currentHome, spaceId, spaces, openModal, goToPage, activity, user }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const isHousehold = spaces?.find((s) => s.id === spaceId)?.type === "household";
  const [economics, setEconomics] = useState({
    balance: 0,
    ingresos: 0,
    gastos: 0,
    facturasPendientes: 0,
    importeTotalPendiente: 0,
    proximoVencimiento: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEconomicsData();
  }, [spaceId, isHousehold]);

  const loadEconomicsData = async () => {
    setLoading(true);
    try {
      if (!spaceId) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const { data: incomeData } = await supabase
        .from("economy_income")
        .select("amount, name, category, date")
        .eq("financial_space_id", spaceId)
        .gte("date", toLocalDateString(monthStart))
        .lte("date", toLocalDateString(monthEnd));

      const { data: expensesData } = await supabase
        .from("economy_expenses")
        .select("amount, name, category, date")
        .eq("financial_space_id", spaceId)
        .gte("date", toLocalDateString(monthStart))
        .lte("date", toLocalDateString(monthEnd));

      // Las facturas solo existen en Household — nunca se mezclan con las
      // estadísticas de Personal/Shared.
      const { data: billsData } = isHousehold
        ? await supabase
            .from("economy_bills")
            .select("*")
            .eq("financial_space_id", spaceId)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
        : { data: [] };

      const totalIngresos = incomeData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
      const totalGastos = expensesData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
      const balance = totalIngresos - totalGastos;

      const proximoVencimiento = billsData?.[0] || null;
      const totalPendiente = billsData?.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0) || 0;

      const entries = [
        ...(incomeData || []).map((i) => ({ ...i, kind: "income" })),
        ...(expensesData || []).map((e) => ({ ...e, kind: "expense" })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setEconomics({
        balance,
        ingresos: totalIngresos,
        gastos: totalGastos,
        facturasPendientes: billsData?.length || 0,
        importeTotalPendiente: totalPendiente,
        proximoVencimiento,
        upcomingBills: (billsData || []).slice(0, 2),
        entries,
      });
    } catch (error) {
      console.error("Error cargando datos de economía:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--ink-soft)" }}>{t("economy.loading")}</div>
    );
  }

  const { ingresos, gastos, balance, entries = [], upcomingBills = [] } = economics;
  const isSaving = balance >= 0;
  const expenseCategoryTotals = {};
  entries.filter((e) => e.kind === "expense").forEach((e) => {
    const cat = normalizeText(e.category || "Otros");
    expenseCategoryTotals[cat] = (expenseCategoryTotals[cat] || 0) + parseFloat(e.amount || 0);
  });
  const maxScale = Math.max(ingresos, gastos, 1);
  const incomeBarPct = Math.min(100, (ingresos / maxScale) * 100);
  const expenseDotPct = Math.min(100, (gastos / maxScale) * 100);

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* HERO: balance del mes */}
      <div className="hm-card" style={{ padding: 22, background: isSaving ? "var(--success-soft)" : "var(--danger-soft)", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          {t("economy.savedThisMonth")}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8, color: isSaving ? "var(--success)" : "var(--danger)", fontFamily: "'Fraunces', serif" }}>
          {isSaving ? "+" : "-"}{formatCurrency(Math.abs(balance))}
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={{
            display: "inline-block", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: isSaving ? "rgba(var(--surface-rgb), 0.6)" : "rgba(var(--surface-rgb), 0.6)",
            color: isSaving ? "var(--success)" : "var(--danger)",
          }}>
            {isSaving ? t("economy.savingStatus") : t("economy.overspendingStatus")}
          </span>
        </div>

        <div style={{ height: 1, background: "rgba(var(--border-rgb), 0.5)", margin: "18px 0" }} />

        <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("economy.income")}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--success)", marginTop: 2 }}>{formatCurrency(ingresos)}</div>
          </div>
          <div style={{ width: 1, background: "rgba(var(--border-rgb), 0.5)" }} />
          <div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("economy.expenses")}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--danger)", marginTop: 2 }}>{formatCurrency(gastos)}</div>
          </div>
        </div>

        <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(var(--border-rgb), 0.35)", marginTop: 18 }}>
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${incomeBarPct}%`, borderRadius: 999, background: isSaving ? "var(--success)" : "var(--danger)" }} />
          <div style={{ position: "absolute", top: "50%", left: `${expenseDotPct}%`, width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", transform: "translate(-50%, -50%)", border: "2px solid var(--surface)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10, fontSize: 12.5, color: "var(--ink-soft)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--success)", display: "inline-block" }} /> {t("economy.income")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--danger)", display: "inline-block" }} /> {t("economy.expenses")}</span>
        </div>
      </div>

      <AccountsSection spaceId={spaceId} spaces={spaces} userId={user?.id} />

      {isHousehold && (
        <GoalsSection
          houseId={currentHome?.id}
          userId={user?.id}
          expenseCategoryTotals={expenseCategoryTotals}
          balance={balance}
        />
      )}

      {/* RECENT ENTRIES */}
      <div className="hm-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" }}>{t("economy.recentMovements")}</div>
          <button className="hm-btn hm-btn-ghost" style={{ padding: "4px 6px", fontSize: 13, color: "var(--accent)", fontWeight: 700 }} onClick={() => goToPage && goToPage("movements", { movementsType: "expenses" })}>
            {t("economy.viewAll")} <ChevronRight size={14} />
          </button>
        </div>

        {entries.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("economy.noMovementsThisMonth")}</div>
        ) : (
          <div>
            {entries.slice(0, 4).map((entry, idx) => {
              const Icon = ENTRY_ICONS[entry.category] || Tag;
              const isIncome = entry.kind === "income";
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                    borderBottom: idx < Math.min(entries.length, 4) - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface-alt)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--ink-soft)" }}>
                    <Icon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{entry.category || "Otros"} · {entry.date}</div>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: isIncome ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>
                    {isIncome ? "+" : "-"}{formatCurrency(entry.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPCOMING PAYMENTS — solo existen en Household */}
      {isHousehold && (
        <div className="hm-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" }}>{t("economy.upcomingPayments")}</div>
            <button className="hm-btn hm-btn-ghost" style={{ padding: "4px 6px", fontSize: 13, color: "var(--accent)", fontWeight: 700 }} onClick={() => goToPage && goToPage("bills")}>
              {t("economy.viewAll")} <ChevronRight size={14} />
            </button>
          </div>

          {upcomingBills.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("economy.noPendingBills")}</div>
          ) : (
            <div>
              {upcomingBills.map((bill, idx) => {
                const daysUntil = getDaysUntilDue(bill.due_date);
                const overdue = daysUntil < 0;
                return (
                  <div key={bill.id || idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < upcomingBills.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: overdue ? "var(--danger-soft)" : "var(--surface-alt)", display: "grid", placeItems: "center", flexShrink: 0, color: overdue ? "var(--danger)" : "var(--ink-soft)" }}>
                      <Calendar size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{bill.name}</div>
                      <div style={{ fontSize: 12, color: overdue ? "var(--danger)" : "var(--ink-soft)", marginTop: 1 }}>
                        {overdue ? t("economy.overdueDays", { days: Math.abs(daysUntil) }) : t("economy.dueInDays", { days: daysUntil })}
                      </div>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{formatCurrency(bill.amount)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
