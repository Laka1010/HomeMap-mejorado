import { describe, it, expect } from "vitest";
import {
  getCurrencySymbol,
  formatCurrencyValue,
  formatCurrencyRounded,
  getCurrencyDecimals,
  isValidCurrencyCode,
  getCurrenciesList,
} from "../utils/currencyUtils";

// Intl inserts non-breaking / narrow-no-break spaces between number and symbol;
// collapse them so assertions stay readable and engine-independent.
const norm = (s) => s.replace(/[\u00a0\u202f\u2009\u2007]/g, " ");

describe("getCurrencySymbol", () => {
  it("returns the glyph for known codes", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("falls back to EUR for unknown codes instead of throwing", () => {
    expect(getCurrencySymbol("XYZ")).toBe("€");
    expect(getCurrencySymbol(undefined)).toBe("€");
  });
});

describe("formatCurrencyValue", () => {
  it("places the symbol and separators per locale", () => {
    // Spanish only groups from 5 digits up (Intl useGrouping "min2").
    expect(norm(formatCurrencyValue(1234.56, "EUR", "es"))).toBe("1234,56 €");
    expect(norm(formatCurrencyValue(12345.6, "EUR", "es"))).toBe("12.345,60 €");
    expect(norm(formatCurrencyValue(1234.56, "USD", "en"))).toBe("$1,234.56");
  });

  it("uses the currency's own decimal count (JPY has none)", () => {
    expect(norm(formatCurrencyValue(1234.56, "JPY", "es"))).toBe("1235 ¥");
  });

  it("coerces non-finite input to 0", () => {
    expect(norm(formatCurrencyValue(NaN, "EUR", "es"))).toBe("0,00 €");
    expect(norm(formatCurrencyValue(undefined, "EUR", "es"))).toBe("0,00 €");
  });

  it("unknown code degrades to EUR", () => {
    expect(norm(formatCurrencyValue(10, "XYZ", "es"))).toBe("10,00 €");
  });
});

describe("formatCurrencyRounded", () => {
  it("drops the decimals", () => {
    expect(norm(formatCurrencyRounded(1234.56, "EUR", "es"))).toBe("1235 €");
    expect(norm(formatCurrencyRounded(12345.6, "EUR", "es"))).toBe("12.346 €");
  });
});

describe("getCurrencyDecimals", () => {
  it("is 2 for EUR and 0 for JPY", () => {
    expect(getCurrencyDecimals("EUR")).toBe(2);
    expect(getCurrencyDecimals("JPY")).toBe(0);
  });
});

describe("isValidCurrencyCode", () => {
  it("accepts known 3-letter uppercase codes only", () => {
    expect(isValidCurrencyCode("EUR")).toBe(true);
    expect(isValidCurrencyCode("eur")).toBe(false);
    expect(isValidCurrencyCode("EURO")).toBe(false);
    expect(isValidCurrencyCode("ZZZ")).toBe(false);
    expect(isValidCurrencyCode(null)).toBe(false);
  });
});

describe("getCurrenciesList", () => {
  it("lists EUR/USD/GBP first", () => {
    const codes = getCurrenciesList().map((c) => c.code);
    expect(codes.slice(0, 3)).toEqual(["EUR", "USD", "GBP"]);
    expect(codes).toContain("ARS");
  });
});
