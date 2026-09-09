import { describe, it, expect } from "vitest";
import { computeInsights } from "../modules/economy/insightsEngine";

const TONE_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };
const toneRanks = (list) => list.map((i) => TONE_ORDER[i.tone]);
const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const daysFromNow = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("computeInsights", () => {
  it("returns nothing for a healthy workspace", () => {
    expect(computeInsights({ pendingBills: [], balance: 500, t })).toEqual([]);
  });

  it("flags an overdue bill as danger", () => {
    const [insight] = computeInsights({
      pendingBills: [{ id: "b1", name: "Luz", amount: 40, due_date: daysFromNow(-2) }],
      balance: 500,
      t,
    });
    expect(insight.tone).toBe("danger");
    expect(insight.id).toBe("bill-overdue-b1");
  });

  it("flags a bill due within 3 days as warning", () => {
    const result = computeInsights({
      pendingBills: [{ id: "b2", name: "Agua", amount: 20, due_date: daysFromNow(2) }],
      balance: 500,
      t,
    });
    expect(result.some((i) => i.id === "bill-due-soon-b2" && i.tone === "warning")).toBe(true);
  });

  it("warns when the balance cannot cover pending bills", () => {
    const result = computeInsights({
      pendingBills: [{ id: "b3", name: "Alquiler", amount: 900, due_date: daysFromNow(10) }],
      balance: 100,
      t,
    });
    expect(result.some((i) => i.id === "balance-cant-cover-bills")).toBe(true);
  });

  it("flags a negative balance as danger", () => {
    const result = computeInsights({ pendingBills: [], balance: -50, t });
    expect(result.some((i) => i.id === "balance-negative" && i.tone === "danger")).toBe(true);
  });

  it("orders by severity and caps at 3", () => {
    const result = computeInsights({
      pendingBills: [
        { id: "o", name: "Vieja", amount: 10, due_date: daysFromNow(-5) },
        { id: "s", name: "Pronto", amount: 10, due_date: daysFromNow(1) },
      ],
      balance: -5,
      t,
    });
    expect(result).toHaveLength(3);
    expect(result[0].tone).toBe("danger");
    expect(toneRanks(result)).toEqual([...toneRanks(result)].sort((a, b) => a - b));
  });
});
