import { useEffect, useState } from "react";
import { ChevronRight, HeartHandshake, Tag, Plus } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useTranslation } from "../../i18n";
import { formatCurrencyValue } from "../../utils/currencyUtils";
import { financialSpacesService } from "./services/financialSpacesService";
import { accountsService } from "./services/accountsService";
import { economyService } from "./services/economyService";
import { transfersService } from "./services/transfersService";
import { computeInsights } from "./insightsEngine";
import { InsightsBar } from "./InsightsBar";
import { TransferModal } from "./TransferModal";
import { CreateSharedSpaceModal } from "./SpaceSwitcher";

const fetchSavingsGoals = (spaceId) =>
  supabase
    .from("economy_goals")
    .select("id, name, target_amount")
    .eq("financial_space_id", spaceId)
    .eq("type", "savings_target")
    .then(({ data }) => data || []);

const defaultAccount = (accounts) => accounts.find((a) => a.is_default) || accounts[0];
const totalBalance = (accounts) => accounts.filter((a) => a.status === "active").reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

/**
 * Dashboard cruzado de Economía — aterrizaje del módulo. Muestra Personal,
 * cada Shared Space y Household a la vez ("entender todo en <5s"), con
 * insights basados en reglas encima. Un único lote de queries en paralelo
 * al montar; entrar a un Space concreto navega al Overview de siempre
 * (`onEnterSpace`) — este componente no reemplaza esa vista, es la puerta
 * de entrada por encima de ella.
 */
export function EconomyDashboard({ currentHome, spaces, user, onEnterSpace, onSpaceCreated }) {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showContribute, setShowContribute] = useState(false);
  const [showCreateShared, setShowCreateShared] = useState(false);

  const personal = spaces.find((s) => s.type === "personal");
  const household = spaces.find((s) => s.type === "household");
  const sharedSpaces = spaces.filter((s) => s.type === "shared");

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personal?.id, household?.id, sharedSpaces.map((s) => s.id).join(",")]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const allSpaces = spaces;
      const allIds = allSpaces.map((s) => s.id);

      // Un único lote en paralelo — nada se encadena secuencialmente.
      const accountsPromise = Promise.all(allIds.map((id) => accountsService.listAccounts(id)));
      const expensesPromise = Promise.all(allIds.map((id) => economyService.getAllExpensesBySpace(id, 3)));
      const incomePromise = Promise.all(allIds.map((id) => economyService.getAllIncomeBySpace(id, 3)));
      const goalsPromise = Promise.all(allIds.map((id) => fetchSavingsGoals(id)));
      const billsPromise = household ? economyService.getPendingBillsBySpace(household.id) : Promise.resolve([]);
      const householdTransfersPromise = household ? transfersService.listTransfersForSpace(household.id) : Promise.resolve([]);
      const membersPromise = Promise.all(sharedSpaces.map((s) => financialSpacesService.listSpaceMembers(s.id)));
      const personalTransfersPromise = personal ? transfersService.listTransfersForSpace(personal.id) : Promise.resolve([]);

      const [accountsPerSpace, expensesPerSpace, incomePerSpace, goalsPerSpace, householdBills, householdTransfers, membersPerShared, personalTransfers] =
        await Promise.all([accountsPromise, expensesPromise, incomePromise, goalsPromise, billsPromise, householdTransfersPromise, membersPromise, personalTransfersPromise]);

      const bySpace = {};
      allIds.forEach((id, i) => {
        bySpace[id] = { accounts: accountsPerSpace[i], expenses: expensesPerSpace[i], income: incomePerSpace[i], goals: goalsPerSpace[i] };
      });

      return { bySpace, householdBills, householdTransfers, membersPerShared, personalTransfers };
    } catch (error) {
      console.error("Error loading economy dashboard:", error);
      return { bySpace: {}, householdBills: [], householdTransfers: [], membersPerShared: [], personalTransfers: [] };
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div style={{ textAlign: "center", padding: 32, color: "var(--ink-soft)" }}>{t("economyDashboard.loading")}</div>;
  }

  const { bySpace, householdBills, householdTransfers, membersPerShared, personalTransfers } = data;

  const personalData = personal ? bySpace[personal.id] : null;
  const personalAccounts = personalData?.accounts || [];
  const personalBalance = personalData ? totalBalance(personalAccounts) : 0;
  const personalCurrency = personalData ? defaultAccount(personalAccounts)?.currency_code : "EUR";
  const personalEntries = personalData
    ? [
        ...personalData.expenses.map((e) => ({ ...e, kind: "expense" })),
        ...personalData.income.map((i) => ({ ...i, kind: "income" })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3)
    : [];

  const householdData = household ? bySpace[household.id] : null;
  const householdAccounts = householdData?.accounts || [];
  const householdDefaultAccount = householdData ? defaultAccount(householdAccounts) : null;
  const householdBalance = householdDefaultAccount ? parseFloat(householdDefaultAccount.balance || 0) : 0;
  const nextDueBill = householdBills[0] || null;
  const lastExpense = householdData?.expenses?.[0] || null;
  const householdAccountIds = new Set(householdAccounts.map((a) => a.id));
  const lastContribution = householdTransfers.find((tr) => tr.kind === "contribution" && householdAccountIds.has(tr.to_account_id)) || null;

  const sharedSummaries = sharedSpaces.map((s, idx) => {
    const spaceData = bySpace[s.id] || { accounts: [], expenses: [], income: [] };
    const acct = defaultAccount(spaceData.accounts);
    const dates = [...spaceData.expenses, ...spaceData.income].map((e) => e.date).filter(Boolean).sort().reverse();
    return {
      space: s,
      balance: acct ? parseFloat(acct.balance || 0) : 0,
      currencyCode: acct?.currency_code || "EUR",
      lastDate: dates[0] || null,
      members: membersPerShared[idx] || [],
    };
  });

  // Insights: cero queries extra, todo sale de los datos ya cargados arriba.
  const personalAccountIds = new Set(personalAccounts.map((a) => a.id));
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const personalContributedThisMonth = personalTransfers.some(
    (tr) => tr.kind === "contribution" && personalAccountIds.has(tr.from_account_id) && String(tr.created_at).slice(0, 7) === monthKey
  );
  const savingsGoals = spaces.flatMap((s) => {
    const spaceData = bySpace[s.id];
    if (!spaceData) return [];
    const acct = defaultAccount(spaceData.accounts);
    const current = acct ? Math.max(0, parseFloat(acct.balance || 0)) : 0;
    return spaceData.goals.map((g) => ({
      id: g.id,
      name: g.name,
      pct: parseFloat(g.target_amount) > 0 ? (current / parseFloat(g.target_amount)) * 100 : 0,
    }));
  });

  const insights = computeInsights({
    householdPendingBills: householdBills,
    householdBalance,
    personalBalance,
    personalContributedThisMonth,
    savingsGoals,
    t,
  });

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(locale === "en" ? "en-US" : "es-ES") : null);

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <InsightsBar insights={insights} />

      {/* MY MONEY */}
      <div className="hm-card hm-fade-in" style={{ padding: 20, animationDelay: "0ms" }}>
        <BlockHeader
          icon="👤"
          title={t("economyDashboard.myMoneyTitle")}
          action={personal && <EnterButton onClick={() => onEnterSpace(personal.id)} label={t("economyDashboard.enter")} />}
        />

        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12, fontFamily: "'Fraunces', serif" }}>
          {formatCurrencyValue(personalBalance, personalCurrency, locale)}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{t("economyDashboard.balanceLabel")}</div>

        {personalAccounts.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 16, paddingBottom: 2 }}>
            {personalAccounts.filter((a) => a.status === "active").slice(0, 4).map((a) => (
              <MiniAccountChip key={a.id} account={a} locale={locale} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={subEyebrowStyle}>{t("economyDashboard.recentMovementsLabel")}</div>
          {personalEntries.length === 0 ? (
            <EmptyRow text={t("economyDashboard.noMovements")} />
          ) : (
            personalEntries.map((entry, idx) => (
              <MovementRow key={idx} entry={entry} isLast={idx === personalEntries.length - 1} currencyCode={personalCurrency} locale={locale} />
            ))
          )}
        </div>
      </div>

      {/* SHARED SPACES */}
      <div className="hm-card hm-fade-in" style={{ padding: 20, animationDelay: "70ms" }}>
        <BlockHeader icon="❤️" title={t("economyDashboard.sharedSpacesTitle")} />

        {sharedSummaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0 4px" }}>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 12 }}>{t("economyDashboard.noSharedSpaces")}</div>
            <button className="hm-btn hm-btn-soft" onClick={() => setShowCreateShared(true)}>
              <Plus size={15} /> {t("economyDashboard.createSharedSpaceCta")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", marginTop: 16, paddingBottom: 4 }}>
            {sharedSummaries.map((summary) => (
              <div
                key={summary.space.id}
                style={{
                  minWidth: 220,
                  flexShrink: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface-alt)",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{summary.space.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary.space.name}</span>
                </div>

                <AvatarStack members={summary.members} />

                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 10 }}>{formatCurrencyValue(summary.balance, summary.currencyCode, locale)}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
                  {summary.lastDate ? `${t("economyDashboard.lastActivityLabel")} · ${fmtDate(summary.lastDate)}` : t("economyDashboard.noActivity")}
                </div>

                <button className="hm-btn hm-btn-soft hm-btn--full" style={{ marginTop: 12 }} onClick={() => onEnterSpace(summary.space.id)}>
                  {t("economyDashboard.enter")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HOUSEHOLD */}
      {household && (
        <div className="hm-card hm-fade-in" style={{ padding: 20, animationDelay: "140ms" }}>
          <BlockHeader
            icon="🏠"
            title={t("economyDashboard.householdTitle")}
            action={<EnterButton onClick={() => onEnterSpace(household.id)} label={t("economyDashboard.enter")} />}
          />

          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12, fontFamily: "'Fraunces', serif" }}>
            {formatCurrencyValue(householdBalance, householdDefaultAccount?.currency_code, locale)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{t("economyDashboard.balanceLabel")}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            <StatTile label={t("economyDashboard.pendingBillsLabel")} value={String(householdBills.length)} />
            <StatTile
              label={t("economyDashboard.nextDueLabel")}
              value={nextDueBill ? `${nextDueBill.name} · ${fmtDate(nextDueBill.due_date)}` : t("economyDashboard.noDueBills")}
            />
            <StatTile
              label={t("economyDashboard.lastExpenseLabel")}
              value={lastExpense ? `${lastExpense.name} · ${formatCurrencyValue(lastExpense.amount, householdDefaultAccount?.currency_code, locale)}` : "—"}
            />
            <StatTile
              label={t("economyDashboard.lastContributionLabel")}
              value={lastContribution ? formatCurrencyValue(lastContribution.amount, householdDefaultAccount?.currency_code, locale) : t("economyDashboard.noContributionsYet")}
            />
          </div>

          <button className="hm-btn hm-btn-primary hm-btn--full" style={{ marginTop: 16 }} onClick={() => setShowContribute(true)} disabled={!personal}>
            <HeartHandshake size={16} /> {t("economyDashboard.contribute")}
          </button>
        </div>
      )}

      {showContribute && personal && household && (
        <TransferModal
          spaceId={personal.id}
          spaces={spaces}
          accounts={personalAccounts.filter((a) => a.status === "active")}
          initialToSpaceId={household.id}
          onClose={() => setShowContribute(false)}
          onDone={() => { setShowContribute(false); loadDashboard().then(setData); }}
        />
      )}

      {showCreateShared && (
        <CreateSharedSpaceModal
          houseId={currentHome?.id}
          onClose={() => setShowCreateShared(false)}
          onCreated={(space) => {
            setShowCreateShared(false);
            onSpaceCreated?.(space);
          }}
        />
      )}
    </div>
  );
}

const subEyebrowStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: 8 };

function BlockHeader({ icon, title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 15 }}>{icon}</span> {title}
      </div>
      {action}
    </div>
  );
}

function EnterButton({ onClick, label }) {
  return (
    <button className="hm-btn hm-btn-ghost" style={{ padding: "4px 6px", fontSize: 13, color: "var(--accent)", fontWeight: 700 }} onClick={onClick}>
      {label} <ChevronRight size={14} />
    </button>
  );
}

function MiniAccountChip({ account, locale }) {
  return (
    <div style={{ flexShrink: 0, minWidth: 108, borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "8px 10px" }}>
      <div style={{ fontSize: 15 }}>{account.icon}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{formatCurrencyValue(account.balance, account.currency_code, locale)}</div>
    </div>
  );
}

function MovementRow({ entry, isLast, currencyCode, locale }) {
  const isIncome = entry.kind === "income";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-alt)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--ink-soft)" }}>
        <Tag size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: isIncome ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>
        {isIncome ? "+" : "-"}{formatCurrencyValue(entry.amount, currencyCode, locale)}
      </div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div style={{ padding: "10px 0", color: "var(--ink-soft)", fontSize: 13 }}>{text}</div>;
}

function StatTile({ label, value }) {
  // minWidth: 0 es imprescindible en un hijo de grid `1fr` — sin él, el
  // texto empuja la columna más allá de su ancho en vez de recortarse/hacer
  // wrap dentro de ella (el mismo problema que ya se documentó en
  // EconomyModule.jsx para el grid de tabs, aquí con texto en vez de botones).
  return (
    <div style={{ minWidth: 0, borderRadius: "var(--radius)", background: "var(--surface-alt)", padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", color: "var(--ink-soft)", textTransform: "uppercase", overflowWrap: "break-word" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function AvatarStack({ members }) {
  if (!members || members.length === 0) return null;
  const shown = members.slice(0, 3);
  const overflow = members.length - shown.length;
  const avatarStyle = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "var(--surface)",
    border: "2px solid var(--surface-alt)",
    display: "grid",
    placeItems: "center",
    fontSize: 9.5,
    fontWeight: 700,
    color: "var(--ink-soft)",
  };
  return (
    <div style={{ display: "flex", marginTop: 10 }}>
      {shown.map((m, i) => (
        <div key={m.user_id} style={{ ...avatarStyle, marginLeft: i > 0 ? -8 : 0 }}>
          {(m.profiles?.display_name || "?")[0].toUpperCase()}
        </div>
      ))}
      {overflow > 0 && <div style={{ ...avatarStyle, marginLeft: -8 }}>+{overflow}</div>}
    </div>
  );
}
