/**
 * Reconstruye el patrimonio neto (suma de saldos de las cuentas activas del
 * Space) a lo largo del tiempo a partir del ledger de movimientos.
 *
 * No existe una tabla de snapshots de saldo — solo el saldo ACTUAL de cada
 * cuenta (financial_accounts.balance) y el ledger que lo fue moviendo
 * (economy_income, economy_expenses, financial_transfers). Así que para
 * cada fecha de muestra se parte del saldo actual y se DESHACEN los
 * movimientos posteriores a esa fecha, cuenta por cuenta — en vez de sumar
 * hacia delante desde un saldo inicial que en la práctica casi siempre es 0.
 */

export const NET_WORTH_RANGES = ["week", "month", "quarter", "half", "year", "all"];

const RANGE_DAYS = { week: 7, month: 30, quarter: 90, half: 182, year: 365 };
const DEFAULT_POINTS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function endOfDay(dateLike) {
  const d = new Date(dateLike);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfToday() {
  return endOfDay(new Date());
}

/**
 * `points` fechas de muestra, ascendentes, repartidas a partes iguales en
 * los últimos N días hasta hoy. Para "all" (sin días fijos), N es la
 * distancia hasta `earliestDate` (mínimo 7 días, para que un hogar recién
 * creado no colapse el gráfico a un solo punto).
 */
export function sampleDatesForRange(rangeKey, { earliestDate, points = DEFAULT_POINTS } = {}) {
  const today = endOfToday();
  let days = RANGE_DAYS[rangeKey];
  if (!days) {
    const earliestMs = earliestDate ? endOfDay(earliestDate).getTime() : today.getTime();
    days = Math.max(7, Math.ceil((today.getTime() - earliestMs) / DAY_MS));
  }
  const stepMs = (days * DAY_MS) / (points - 1);
  const dates = [];
  for (let i = 0; i < points; i++) {
    dates.push(new Date(today.getTime() - (points - 1 - i) * stepMs));
  }
  return dates;
}

/** Movimientos de UNA cuenta, cada uno con su fecha y su efecto en el saldo (+/-), orden descendente. */
function accountLedger(accountId, income, expenses, transfers) {
  const events = [];
  (income || []).forEach((i) => {
    if (i.account_id === accountId && i.date) events.push({ date: endOfDay(i.date), delta: parseFloat(i.amount) || 0 });
  });
  (expenses || []).forEach((e) => {
    if (e.account_id === accountId && e.date) events.push({ date: endOfDay(e.date), delta: -(parseFloat(e.amount) || 0) });
  });
  (transfers || []).forEach((tr) => {
    if (!tr.created_at) return;
    const amount = parseFloat(tr.amount) || 0;
    const date = new Date(tr.created_at);
    if (tr.from_account_id === accountId) events.push({ date, delta: -amount });
    if (tr.to_account_id === accountId) events.push({ date, delta: amount });
  });
  return events.sort((a, b) => b.date - a.date);
}

/**
 * @param {Array<{id:string, balance:number|string, created_at?:string}>} accounts - cuentas activas
 * @param {Array<{account_id:string, amount:number|string, date:string}>} income
 * @param {Array<{account_id:string, amount:number|string, date:string}>} expenses
 * @param {Array<{from_account_id:string, to_account_id:string, amount:number|string, created_at:string}>} transfers
 * @param {Date[]} sampleDates - ascendente
 * @returns {{date:Date, value:number}[]}
 */
export function computeNetWorthSeries(accounts, income, expenses, transfers, sampleDates) {
  if (!sampleDates || sampleDates.length === 0) return [];
  const datesDesc = [...sampleDates].sort((a, b) => b - a);
  const totals = new Map(datesDesc.map((d) => [d.getTime(), 0]));

  (accounts || []).forEach((acc) => {
    const ledger = accountLedger(acc.id, income, expenses, transfers);
    const createdAt = acc.created_at ? new Date(acc.created_at) : null;
    let running = parseFloat(acc.balance) || 0;
    let idx = 0;
    for (const d of datesDesc) {
      // Deshace todo lo que pasó DESPUÉS de esta fecha de muestra.
      while (idx < ledger.length && ledger[idx].date > d) {
        running -= ledger[idx].delta;
        idx++;
      }
      // Si la cuenta todavía no existía en esta fecha, no aporta nada
      // (su initial_balance, al no venir de un movimiento del ledger, ya
      // queda reflejado sin más al llegar `running` al momento de creación).
      const existed = !createdAt || createdAt <= d;
      if (existed) totals.set(d.getTime(), totals.get(d.getTime()) + running);
    }
  });

  return sampleDates.map((d) => ({ date: d, value: totals.get(d.getTime()) || 0 }));
}

/** Fecha más antigua entre cuentas y movimientos (para el rango "Todo"), o null si no hay nada. */
export function earliestLedgerDate(accounts, income, expenses, transfers) {
  const dates = [
    ...(accounts || []).map((a) => a.created_at),
    ...(income || []).map((i) => i.date),
    ...(expenses || []).map((e) => e.date),
    ...(transfers || []).map((t) => t.created_at),
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((ms) => !Number.isNaN(ms));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates));
}
