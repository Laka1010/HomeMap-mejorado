import { describe, it, expect } from "vitest";
import { toDateKey, getWeekDates, addDays, getDaysUntil } from "../modules/calendar/calendarUtils";

describe("toDateKey", () => {
  it("passes plain YYYY-MM-DD strings straight through", () => {
    expect(toDateKey("2026-07-28")).toBe("2026-07-28");
    expect(toDateKey("2026-07-28T15:00:00Z")).toBe("2026-07-28");
  });

  it("uses local components for full timestamps", () => {
    const d = new Date(2026, 6, 28, 23, 30);
    expect(toDateKey(d)).toBe("2026-07-28");
  });

  it("returns null for empty or invalid input", () => {
    expect(toDateKey(null)).toBeNull();
    expect(toDateKey("garbage")).toBeNull();
  });
});

describe("getWeekDates", () => {
  it("returns Monday..Sunday for a mid-week date", () => {
    // 2026-07-29 is a Wednesday
    const week = getWeekDates(new Date(2026, 6, 29));
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(1); // Monday
    expect(week[6].getDay()).toBe(0); // Sunday
    expect(toDateKey(week[0])).toBe("2026-07-27");
    expect(toDateKey(week[6])).toBe("2026-08-02");
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    const week = getWeekDates(new Date(2026, 7, 2)); // Sunday
    expect(toDateKey(week[0])).toBe("2026-07-27");
    expect(toDateKey(week[6])).toBe("2026-08-02");
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(toDateKey(addDays(new Date(2026, 6, 30), 3))).toBe("2026-08-02");
    expect(toDateKey(addDays(new Date(2026, 6, 2), -5))).toBe("2026-06-27");
  });
});

describe("getDaysUntil", () => {
  it("counts forward and backward from today", () => {
    expect(getDaysUntil(new Date(Date.now() + 2 * 86400000))).toBe(2);
    expect(getDaysUntil(new Date(Date.now() - 3 * 86400000))).toBeLessThan(0);
  });
});
