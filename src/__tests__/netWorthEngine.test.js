import { describe, it, expect } from "vitest";
import { toLocalDateString } from "../utils/dates";
import { sampleDatesForRange, computeNetWorthSeries, earliestLedgerDate } from "../modules/economy/netWorthEngine";

const dayKey = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateString(d);
};

const endOfDay = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(23, 59, 59, 999);
  return d;
};

describe("sampleDatesForRange", () => {
  it("returns 7 ascending points spanning the requested range, ending today", () => {
    const dates = sampleDatesForRange("week");
    expect(dates.length).toBe(7);
    expect(dates[dates.length - 1].toDateString()).toBe(new Date().toDateString());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
    }
  });

  it("'all' falls back to a minimum span so a brand-new house doesn't collapse to one point", () => {
    const dates = sampleDatesForRange("all", { earliestDate: new Date() });
    expect(dates.length).toBe(7);
    const spanDays = (dates[6].getTime() - dates[0].getTime()) / 86400000;
    expect(spanDays).toBeGreaterThanOrEqual(6.9);
  });

  it("'all' spans back to the earliest date given", () => {
    const dates = sampleDatesForRange("all", { earliestDate: dayKey(-40) });
    const spanDays = (dates[6].getTime() - dates[0].getTime()) / 86400000;
    expect(spanDays).toBeGreaterThanOrEqual(39);
  });
});

describe("computeNetWorthSeries", () => {
  it("is flat at the current balance when there is no ledger activity", () => {
    const accounts = [{ id: "a1", balance: 1000 }];
    const dates = [endOfDay(-2), endOfDay(-1), endOfDay(0)];
    const series = computeNetWorthSeries(accounts, [], [], [], dates);
    expect(series.map((p) => p.value)).toEqual([1000, 1000, 1000]);
  });

  it("undoes an expense to reconstruct the balance before it happened", () => {
    const accounts = [{ id: "a1", balance: 1000 }]; // ya refleja el gasto de ayer
    const expenses = [{ account_id: "a1", amount: 200, date: dayKey(-1) }];
    const dates = [endOfDay(-2), endOfDay(-1), endOfDay(0)];
    const series = computeNetWorthSeries(accounts, [], expenses, [], dates);
    expect(series[2].value).toBe(1000); // hoy: ya con el gasto aplicado
    expect(series[1].value).toBe(1000); // el propio día del gasto: ya se cuenta como ocurrido
    expect(series[0].value).toBe(1200); // antes del gasto: se deshace (+200)
  });

  it("undoes income the same way, in the opposite direction", () => {
    const accounts = [{ id: "a1", balance: 500 }];
    const income = [{ account_id: "a1", amount: 300, date: dayKey(-1) }];
    const dates = [endOfDay(-2), endOfDay(0)];
    const series = computeNetWorthSeries(accounts, income, [], [], dates);
    expect(series[1].value).toBe(500);
    expect(series[0].value).toBe(200); // antes del ingreso
  });

  it("moves value between two accounts without changing the total", () => {
    const accounts = [
      { id: "a1", balance: 300 },
      { id: "a2", balance: 700 },
    ];
    const transfers = [{ from_account_id: "a1", to_account_id: "a2", amount: 200, created_at: endOfDay(-1).toISOString() }];
    const dates = [endOfDay(-2), endOfDay(0)];
    const series = computeNetWorthSeries(accounts, [], [], transfers, dates);
    expect(series[1].value).toBe(1000); // hoy: 300 + 700
    expect(series[0].value).toBe(1000); // antes de la transferencia: 500 + 500, mismo total
  });

  it("excludes an account from dates before it existed", () => {
    const accounts = [{ id: "a1", balance: 500, created_at: endOfDay(-1).toISOString() }];
    const dates = [endOfDay(-3), endOfDay(0)];
    const series = computeNetWorthSeries(accounts, [], [], [], dates);
    expect(series[0].value).toBe(0); // antes de crearse, no existía
    expect(series[1].value).toBe(500);
  });
});

describe("earliestLedgerDate", () => {
  it("returns null with nothing to look at", () => {
    expect(earliestLedgerDate([], [], [], [])).toBeNull();
  });

  it("picks the oldest date across accounts, income, expenses and transfers", () => {
    const result = earliestLedgerDate(
      [{ created_at: dayKey(-10) }],
      [{ date: dayKey(-5) }],
      [{ date: dayKey(-30) }],
      [{ created_at: dayKey(-2) }],
    );
    expect(toLocalDateString(result)).toBe(dayKey(-30));
  });
});
