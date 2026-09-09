import { describe, it, expect } from "vitest";
import { toLocalDateString } from "../utils/dates";
import {
  computeHomeStatus,
  computeTodayItems,
  computeUpcomingBills,
  computeHomeInsight,
} from "../modules/dashboard/dashboardRules";

const dayKey = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateString(d);
};
const TODAY = dayKey(0);
const YESTERDAY = dayKey(-1);
const TOMORROW = dayKey(1);

describe("computeHomeStatus", () => {
  it("is ok with nothing wrong", () => {
    const s = computeHomeStatus({ tasks: [], bills: [], shoppingItems: [] });
    expect(s.ok).toBe(true);
    expect(s.problems).toEqual([]);
  });

  it("flags overdue bills, overdue tasks and due-today bills", () => {
    const s = computeHomeStatus({
      tasks: [{ id: 1, status: "pending", date: YESTERDAY }],
      bills: [
        { id: "b1", status: "pending", due_date: YESTERDAY, name: "Luz" },
        { id: "b2", status: "pending", due_date: TODAY, name: "Agua" },
      ],
      shoppingItems: [],
    });
    expect(s.ok).toBe(false);
    const keys = s.problems.map((p) => p.key);
    expect(keys).toContain("overdueBills");
    expect(keys).toContain("billsDueToday");
    expect(keys).toContain("overdueTasks");
  });

  it("hides economy problems when canSeeEconomy is false", () => {
    const s = computeHomeStatus({
      tasks: [],
      bills: [{ id: "b1", status: "pending", due_date: YESTERDAY, name: "Luz" }],
      shoppingItems: [],
      canSeeEconomy: false,
    });
    expect(s.ok).toBe(true);
    expect(s.checks.billsOk).toBeNull();
  });

  it("only flags urgent shopping at the threshold of 3", () => {
    const two = computeHomeStatus({
      shoppingItems: [
        { id: 1, priority: "urgent" },
        { id: 2, priority: "urgent" },
      ],
    });
    expect(two.problems.map((p) => p.key)).not.toContain("urgentShopping");

    const three = computeHomeStatus({
      shoppingItems: [
        { id: 1, priority: "urgent" },
        { id: 2, priority: "urgent" },
        { id: 3, priority: "urgent" },
      ],
    });
    expect(three.problems.map((p) => p.key)).toContain("urgentShopping");
  });
});

describe("computeTodayItems", () => {
  it("returns only today's pending tasks and bills, capped at 5", () => {
    const items = computeTodayItems({
      tasks: [
        { id: 1, title: "Hoy", date: TODAY, status: "pending" },
        { id: 2, title: "Hecha", date: TODAY, status: "done" },
        { id: 3, title: "Ayer", date: YESTERDAY, status: "pending" },
      ],
      bills: [{ id: "b1", name: "Agua", due_date: TODAY, status: "pending" }],
    });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kind)).toEqual(["task", "bill"]);
  });
});

describe("computeUpcomingBills", () => {
  it("excludes today and past, includes the next 14 days, sorted", () => {
    const bills = [
      { id: "past", status: "pending", due_date: YESTERDAY },
      { id: "today", status: "pending", due_date: TODAY },
      { id: "soon", status: "pending", due_date: dayKey(3) },
      { id: "later", status: "pending", due_date: dayKey(10) },
      { id: "far", status: "pending", due_date: dayKey(30) },
      { id: "paid", status: "paid", due_date: dayKey(2) },
    ];
    const result = computeUpcomingBills({ bills }).map((b) => b.id);
    expect(result).toEqual(["soon", "later"]);
  });
});

describe("computeHomeInsight", () => {
  it("returns null when there is nothing honest to say", () => {
    expect(computeHomeInsight({})).toBeNull();
  });

  it("surfaces the most urgent unread notification first", () => {
    const insight = computeHomeInsight({
      notifications: [
        { id: 1, status: "unread", priority: "info", category: "tasks" },
        { id: 2, status: "unread", priority: "critical", category: "finanzas" },
      ],
    });
    expect(insight.kind).toBe("notification");
    expect(insight.notification.id).toBe(2);
  });

  it("warns about a bill due tomorrow when no notifications", () => {
    const insight = computeHomeInsight({
      bills: [{ id: "b1", name: "Internet", status: "pending", due_date: TOMORROW }],
    });
    expect(insight).toEqual({ kind: "billDueTomorrow", name: "Internet" });
  });

  it("celebrates all of today's tasks done", () => {
    const insight = computeHomeInsight({
      tasks: [
        { id: 1, date: TODAY, status: "done" },
        { id: 2, date: TODAY, status: "done" },
      ],
    });
    expect(insight).toEqual({ kind: "allTasksDone" });
  });
});
