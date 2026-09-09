import { describe, it, expect } from "vitest";
import { normalizeText, fuzzyMatch, fuzzyMatchAny } from "../utils/textMatch";

describe("normalizeText", () => {
  it("lowercases, strips accents and trims", () => {
    expect(normalizeText("  CÁRGADOR  ")).toBe("cargador");
    expect(normalizeText("Niño")).toBe("nino");
  });

  it("tolerates null/undefined/numbers", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(42)).toBe("42");
  });
});

describe("fuzzyMatch", () => {
  it("is accent- and case-insensitive substring match", () => {
    expect(fuzzyMatch("Cárgador del móvil", "cargador")).toBe(true);
    expect(fuzzyMatch("Cargador", "MÓ")).toBe(false);
  });

  it("empty query always matches", () => {
    expect(fuzzyMatch("whatever", "")).toBe(true);
    expect(fuzzyMatch(null, "")).toBe(true);
  });
});

describe("fuzzyMatchAny", () => {
  it("matches when any field matches", () => {
    expect(fuzzyMatchAny(["Taladro", "Herramientas", null], "herr")).toBe(true);
    expect(fuzzyMatchAny(["Taladro", "Herramientas"], "cocina")).toBe(false);
  });
});
