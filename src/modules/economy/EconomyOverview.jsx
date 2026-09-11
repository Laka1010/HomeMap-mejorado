import { useState, useEffect } from "react";
import { ChevronRight, Gift, Sparkles, Tag, Calendar, ArrowLeftRight } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { normalizeText } from "../../utils/textMatch";
import { toLocalDateString } from "../../utils/dates";
import { BudgetSection } from "./BudgetSection";
import { AccountsSection } from "./AccountsSection";
import { accountsService } from "./services/accountsService";
import { transfersService } from "./services/transfersService";
import { categoryLabel } from "./economyCategories";
import { computeInsights } from "./insightsEngine";
import { InsightsBar } from "./InsightsBar";

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
  const [accountsBalance, setAccountsBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEconomicsData();
  }, [spaceId]);

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

      // Las facturas ya no son exclusivas de Household — cualquier Workspace
      // (Personal, Household, o uno compartido) puede tener facturas propias
      // (Netflix, luz, alquiler...), todas con la misma pantalla y consulta.
      const { data: billsData } = await supabase
        .from("economy_bills")
        .select("*")
        .eq("financial_space_id", spaceId)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      const accounts = await accountsService.listAccounts(spaceId);
      const totalBalance = accounts
        .filter((a) => a.status === "active")
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
      setAccountsBalance(totalBalance);

      // Transferencias del mes: cada movimiento entre cuentas cuenta como
      // salida (si sale de una cuenta de este Space) y/o entrada (si llega a
      // una). Una transferencia interna del propio Space suma en ambas y se
      // anula; una aportación a/desde otro Space mueve el neto. Se pliega en
      // ingresos/gastos para que el "Ahorrado este mes" y las cifras de abajo
      // sigan cuadrando. `spaceAccountIds` incluye cuentas archivadas.
      const spaceAccountIds = new Set(accounts.map((a) => a.id));
      const monthStartStr = toLocalDateString(monthStart);
      const monthEndStr = toLocalDateString(monthEnd);
      let transfersIn = 0;
      let transfersOut = 0;
      const transferEntries = [];
      try {
        const transfers = await transfersService.listTransfersForSpace(spaceId);
        (transfers || []).forEach((tr) => {
          const d = (tr.created_at || "").slice(0, 10);
          if (d < monthStartStr || d > monthEndStr) return;
          const amt = parseFloat(tr.amount || 0);
          const fromHere = spaceAccountIds.has(tr.from_account_id);
          const toHere = spaceAccountIds.has(tr.to_account_id);
          if (toHere) transfersIn += amt;
          if (fromHere) transfersOut += amt;
          transferEntries.push({
            kind: "transfer",
            direction: fromHere && toHere ? "internal" : fromHere ? "out" : "in",
            amount: amt,
            date: d,
            name: tr.note || (tr.kind === "contribution" ? t("movements.transferContribution") : t("movements.transferTitle")),
          });
        });
      } catch {
        // Sin transferencias legibles el resumen sigue con ingresos/gastos.
      }

      const totalIngresos = (incomeData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0) + transfersIn;
      const totalGastos = (expensesData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0) + transfersOut;
      const balance = totalIngresos - totalGastos;

      const proximoVencimiento = billsData?.[0] || null;
      const totalPendiente = billsData?.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0) || 0;

      const entries = [
        ...(incomeData || []).map((i) => ({ ...i, kind: "income" })),
        ...(expensesData || []).map((e) => ({ ...e, kind: "expense" })),
        ...transferEntries,
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setEconomics({
        balance,
        ingresos: totalIngresos,
        gastos: totalGastos,
        facturasPendientes: billsData?.length || 0,
        importeTotalPendiente: totalPendiente,
        proximoVencimiento,
        pendingBills: billsData || [],
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

  const { ingresos, gastos, balance, entries = [], upcomingBills = [], pendingBills = [] } = economics;
  const isSaving = balance >= 0;
  const expenseCategoryTotals = {};
  entries.filter((e) => e.kind === "expense").forEach((e) => {
    const cat = normalizeText(e.category || "Otros");
    expenseCategoryTotals[cat] = (expenseCategoryTotals[cat] || 0) + parseFloat(e.amount || 0);
  });
  const maxScale = Math.max(ingresos, gastos, 1);
  const incomeBarPct = Math.min(100, (ingresos / maxScale) * 100);
  const expenseDotPct = Math.min(100, (gastos / maxScale) * 100);
  // El fondo del hero se difumina de verde a rojo de izquierda a derecha
  // según ese mismo % de gasto (expenseDotPct), para que avance en sincronía
  // con el punto de la barra de abajo. Sin gasto, verde sólido; a partir de
  // ahí, la zona de transición se desplaza hacia la derecha según se gasta.
  const heroBackground = gastos <= 0
    ? "var(--success-soft)"
    : `linear-gradient(to right, var(--danger-soft) ${Math.max(0, expenseDotPct - 10)}%, var(--success-soft) ${Math.min(100, expenseDotPct + 10)}%)`;

  const insights = computeInsights({ pendingBills, balance: accountsBalance, t });

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <InsightsBar insights={insights} />

      {/* HERO: balance del mes */}
      <div className="hm-card" style={{ padding: 22, background: heroBackground, textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          {t("economy.savedThisMonth")}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8, color: isSaving ? "var(--success)" : "var(--danger)", fontFamily: "'Fraunces', serif" }}>
          {isSaving ? "+" : "-"}{formatCurrency(Math.abs(balance))}
        </div>
        <div style={{ height: 1, background: "rgba(var(--border-rgb), 0.5)", margin: "18px 0" }} />

        <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("economy.expenses")}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--danger)", marginTop: 2 }}>{formatCurrency(gastos)}</div>
          </div>
          <div style={{ width: 1, background: "rgba(var(--border-rgb), 0.5)" }} />
          <div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("economy.income")}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--success)", marginTop: 2 }}>{formatCurrency(ingresos)}</div>
          </div>
        </div>

        <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(var(--border-rgb), 0.35)", marginTop: 18, overflow: "hidden" }}>
          {/* A la izquierda del punto: ya gastado (rojo). A su derecha, hasta
              donde llega el ingreso: lo que queda ahorrado (verde). */}
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${Math.min(expenseDotPct, incomeBarPct)}%`, background: "var(--danger)" }} />
          <div style={{ position: "absolute", top: 0, left: `${Math.min(expenseDotPct, incomeBarPct)}%`, height: "100%", width: `${Math.max(0, incomeBarPct - expenseDotPct)}%`, background: "var(--success)" }} />
          <div style={{ position: "absolute", top: "50%", left: `${expenseDotPct}%`, width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", transform: "translate(-50%, -50%)", border: "2px solid var(--surface)" }} />
        </div>
      </div>

      <AccountsSection spaceId={spaceId} spaces={spaces} userId={user?.id} />

      {isHousehold && (
        <BudgetSection
          houseId={currentHome?.id}
          userId={user?.id}
          expenseCategoryTotals={expenseCategoryTotals}
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
              const isTransfer = entry.kind === "transfer";
              const isIncome = entry.kind === "income";
              const Icon = isTransfer ? ArrowLeftRight : (ENTRY_ICONS[entry.category] || Tag);
              // Transferencia interna del propio Space: el dinero no entra ni
              // sale, solo cambia de cuenta — sin signo ni color de importe.
              const internal = isTransfer && entry.direction === "internal";
              const amountColor = isTransfer
                ? (internal ? "var(--ink-soft)" : entry.direction === "out" ? "var(--danger)" : "var(--success)")
                : (isIncome ? "var(--success)" : "var(--danger)");
              const sign = isTransfer
                ? (internal ? "" : entry.direction === "out" ? "-" : "+")
                : (isIncome ? "+" : "-");
              const subtitle = isTransfer
                ? `${internal ? t("movements.transferInternal") : entry.direction === "out" ? t("movements.transferOut") : t("movements.transferIn")} · ${entry.date}`
                : `${categoryLabel(entry.category || "Otros", t)} · ${entry.date}`;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                    borderBottom: idx < Math.min(entries.length, 4) - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="hm-row-icon" style={{ background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                    <Icon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{subtitle}</div>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: amountColor, whiteSpace: "nowrap" }}>
                    {sign}{formatCurrency(entry.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPCOMING PAYMENTS — cualquier Workspace puede tener facturas */}
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
                  <div className="hm-row-icon" style={{ background: overdue ? "var(--danger-soft)" : "var(--surface-alt)", color: overdue ? "var(--danger)" : "var(--ink-soft)" }}>
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
    </div>
  );
}
