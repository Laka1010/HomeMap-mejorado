import { describe, it, expect } from "vitest";
import { toLocalDateString, intlLocale, formatShortDate, timeAgoShort } from "../utils/dates";

describe("toLocalDateString", () => {
  it("uses local components, not UTC (no end-of-day rollover)", () => {
    // 23:30 local on the 31st must still be '...-31', which toISOString() would
    // roll to the 1st of next month in a UTC+ timezone.
    const d = new Date(2026, 6, 31, 23, 30, 0);
    expect(toLocalDateString(d)).toBe("2026-07-31");
  });

  it("zero-pads month and day", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("intlLocale", () => {
  it("maps app language to a BCP-47 tag", () => {
    expect(intlLocale("en")).toBe("en-GB");
    expect(intlLocale("ca")).toBe("ca-ES");
    expect(intlLocale("es")).toBe("es-ES");
    expect(intlLocale(undefined)).toBe("es-ES");
  });
});

describe("formatShortDate", () => {
  it("returns '' for empty or invalid input", () => {
    expect(formatShortDate("")).toBe("");
    expect(formatShortDate("not-a-date")).toBe("");
  });

  it("formats a real date", () => {
    expect(formatShortDate("2026-08-28", "es")).toMatch(/28/);
  });
});

describe("timeAgoShort", () => {
  const t = (key, vars) => (vars?.count != null ? `${key}:${vars.count}` : key);

  it("buckets by minute / hour / day", () => {
    expect(timeAgoShort(new Date().toISOString(), t)).toBe("timeAgo.now");
    expect(timeAgoShort(new Date(Date.now() - 5 * 60000).toISOString(), t)).toBe("timeAgo.minutes:5");
    expect(timeAgoShort(new Date(Date.now() - 3 * 3600000).toISOString(), t)).toBe("timeAgo.hours:3");
    expect(timeAgoShort(new Date(Date.now() - 26 * 3600000).toISOString(), t)).toBe("timeAgo.yesterday");
  });
});
