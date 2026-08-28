import { useEffect, useMemo, useState } from "react";
import { PiggyBank, TrendingDown, Receipt, CheckCircle2, Clock, AlertTriangle, OctagonAlert, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { economyService } from "./services/economyService";
import { accountsService } from "./services/accountsService";
import { transfersService } from "./services/transfersService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { intlLocale } from "../../utils/dates";
import { categoryLabel } from "./economyCategories";

function monthKeyOf(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : null;
}

function lastNMonths(n, locale) {
  const now = new Date();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(intlLocale(locale), { month: "short" }).replace(".", ""),
    });
  }
  return months;
}

export default function StatisticsSection({ spaceId }) {
  const { t, locale } = useTranslation();
  const { formatRounded: formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [bills, setBills] = useState([]);
  const [contributions, setContributions] = useState({ received: 0, sent: 0 });

  // Siempre filtrado por el Space activo (nunca por house_id directamente)
  // — así Personal/Shared/Household nunca mezclan cifras entre sí. Las
  // facturas solo existen en Household; para Personal/Shared esta consulta
  // simplemente vuelve vacía.
  useEffect(() => {
    let cancelled = false;
    if (!spaceId) return;
    setLoading(true);
    Promise.all([
      economyService.getAllExpensesBySpace(spaceId, 500),
      economyService.getAllIncomeBySpace(spaceId, 500),
      economyService.getAllBillsBySpace(spaceId),
      accountsService.listAccounts(spaceId),
      transfersService.listTransfersForSpace(spaceId),
    ])
      .then(([exp, inc, bl, accounts, transfers]) => {
        if (cancelled) return;
        setExpenses(exp || []);
        setIncome(inc || []);
        setBills(bl || []);

        // Las contribuciones nunca se suman a ingresos/gastos (evita
        // contarlas dos veces: ya viven en su propio ledger) — se muestran
        // como una cifra aparte, separando lo que este Space ha recibido de
        // otros Spaces de lo que ha aportado a otros.
        const ownAccountIds = new Set((accounts || []).map((a) => a.id));
        const contributionRows = (transfers || []).filter((tr) => tr.kind === "contribution");
        setContributions({
          received: contributionRows.filter((tr) => ownAccountIds.has(tr.to_account_id)).reduce((sum, tr) => sum + parseFloat(tr.amount || 0), 0),
          sent: contributionRows.filter((tr) => ownAccountIds.has(tr.from_account_id)).reduce((sum, tr) => sum + parseFloat(tr.amount || 0), 0),
        });
      })
      .catch((err) => console.error("Error loading statistics:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spaceId]);

  const months = useMemo(() => lastNMonths(6, locale), [locale]);
  const currentMonthKey = months[months.length - 1]?.key;

  const monthly = useMemo(() => months.map((m) => {
    const inc = income.filter((i) => monthKeyOf(i.date) === m.key).reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const exp = expenses.filter((e) => monthKeyOf(e.date) === m.key).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    return { ...m, income: inc, expenses: exp };
  }), [months, income, expenses]);

  const maxMonthly = Math.max(1, ...monthly.flatMap((m) => [m.income, m.expenses]));

  const topCategories = useMemo(() => {
    const map = {};
    expenses.filter((e) => monthKeyOf(e.date) === currentMonthKey).forEach((e) => {
      const cat = e.category || "Otros";
      map[cat] = (map[cat] || 0) + parseFloat(e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenses, currentMonthKey]);

  const maxCategory = Math.max(1, ...topCategories.map((c) => c.amount));

  const thisMonth = monthly[monthly.length - 1];
  const savingsRate = thisMonth && thisMonth.income > 0 ? ((thisMonth.income - thisMonth.expenses) / thisMonth.income) * 100 : null;
  const avgMonthlyExpense = monthly.reduce((sum, m) => sum + m.expenses, 0) / (monthly.length || 1);

  const biggestExpense = useMemo(() => {
    const thisMonthExpenses = expenses.filter((e) => monthKeyOf(e.date) === currentMonthKey);
    return thisMonthExpenses.sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0))[0] || null;
  }, [expenses, currentMonthKey]);

  const billStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let onTime = 0, late = 0, overdue = 0, upcoming = 0;
    bills.forEach((b) => {
      if (b.status === "paid") {
        if (b.paid_date && b.due_date && new Date(b.paid_date) > new Date(b.due_date)) late++;
        else onTime++;
      } else {
        const due = b.due_date ? new Date(b.due_date) : null;
        if (due && due < today) overdue++;
        else upcoming++;
      }
    });
    return { onTime, late, overdue, upcoming, total: bills.length };
  }, [bills]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 32, color: "var(--ink-soft)" }}>{t("statistics.loading")}</div>;
  }

  const hasAnyData = expenses.length > 0 || income.length > 0 || bills.length > 0 || contributions.received > 0 || contributions.sent > 0;
  if (!hasAnyData) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "var(--ink-soft)" }}>
        {t("statistics.noData")}
      </div>
    );
  }

  const billSegments = [
    { key: "onTime", label: t("statistics.billsOnTime"), count: billStats.onTime, color: "var(--chart-good)", Icon: CheckCircle2 },
    { key: "upcoming", label: t("statistics.billsUpcoming"), count: billStats.upcoming, color: "var(--chart-warning)", Icon: Clock },
    { key: "late", label: t("statistics.billsLate"), count: billStats.late, color: "var(--chart-serious)", Icon: AlertTriangle },
    { key: "overdue", label: t("statistics.billsOverdue"), count: billStats.overdue, color: "var(--chart-critical)", Icon: OctagonAlert },
  ].filter((s) => s.count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <div className="hm-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 12, fontWeight: 700 }}>
            <PiggyBank size={15} /> {t("statistics.savingsRateLabel")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
            {savingsRate === null ? "—" : `${savingsRate >= 0 ? "" : "-"}${Math.abs(Math.round(savingsRate))}%`}
          </div>
        </div>
        <div className="hm-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 12, fontWeight: 700 }}>
            <TrendingDown size={15} /> {t("statistics.avgExpenseLabel")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{formatCurrency(avgMonthlyExpense)}</div>
        </div>
        <div className="hm-card" style={{ padding: 14, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 12, fontWeight: 700 }}>
            <Receipt size={15} /> {t("statistics.biggestExpenseLabel")}
          </div>
          {biggestExpense ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(biggestExpense.amount)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{biggestExpense.name}</div>
            </div>
          ) : (
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>—</div>
          )}
        </div>
      </div>

      {/* Ingresos vs Gastos - últimos 6 meses */}
      <div className="hm-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t("statistics.incomeVsExpenseTitle", { months: 6 })}</div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-soft)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--chart-income)", display: "inline-block" }} /> {t("statistics.income")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--chart-expense)", display: "inline-block" }} /> {t("statistics.expenses")}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 110 }}>
          {monthly.map((m) => (
            <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 84 }} title={`${m.label}: ${formatCurrency(m.income)} ingresos, ${formatCurrency(m.expenses)} gastos`}>
                <div style={{ width: 10, borderRadius: 4, background: "var(--chart-income)", height: `${Math.max(3, (m.income / maxMonthly) * 84)}px` }} />
                <div style={{ width: 10, borderRadius: 4, background: "var(--chart-expense)", height: `${Math.max(3, (m.expenses / maxMonthly) * 84)}px` }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "capitalize" }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top categorías de gasto */}
      <div className="hm-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("statistics.topCategoriesTitle")}</div>
        {topCategories.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("statistics.noExpensesThisMonth")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topCategories.map((cat) => (
              <div key={cat.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{categoryLabel(cat.name, t)}</span>
                  <span style={{ color: "var(--ink-soft)" }}>{formatCurrency(cat.amount)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: "var(--chart-category)", width: `${Math.max(4, (cat.amount / maxCategory) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estado de las facturas */}
      <div className="hm-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("statistics.billsStatusTitle", { count: billStats.total })}</div>
        {billStats.total === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("statistics.noBillsRegistered")}</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 2, height: 10, borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
              {billSegments.map((s) => (
                <div key={s.key} style={{ width: `${(s.count / billStats.total) * 100}%`, background: s.color }} title={`${s.label}: ${s.count}`} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {billSegments.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <s.Icon size={15} style={{ color: s.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--ink-soft)" }}>{s.label}</span>
                  <span style={{ fontWeight: 700, marginLeft: "auto" }}>{s.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Contribuciones — ledger aparte, nunca sumado a ingresos/gastos */}
      {(contributions.received > 0 || contributions.sent > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {contributions.received > 0 && (
            <div className="hm-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 12, fontWeight: 700 }}>
                <ArrowDownCircle size={15} style={{ color: "var(--success)" }} /> {t("statistics.contributionsReceivedLabel")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, color: "var(--success)" }}>{formatCurrency(contributions.received)}</div>
            </div>
          )}
          {contributions.sent > 0 && (
            <div className="hm-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 12, fontWeight: 700 }}>
                <ArrowUpCircle size={15} style={{ color: "var(--accent)" }} /> {t("statistics.contributionsSentLabel")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{formatCurrency(contributions.sent)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
