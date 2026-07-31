/**
 * Currency utilities — ISO 4217 codes, symbols, and formatting.
 * Extensible for future: automatic conversion, regional formatting, exchange rates.
 */

export const CURRENCIES = {
  EUR: { name: "Euro", symbol: "€", flag: "🇪🇺", region: "es-ES" },
  USD: { name: "US Dollar", symbol: "$", flag: "🇺🇸", region: "en-US" },
  GBP: { name: "British Pound", symbol: "£", flag: "🇬🇧", region: "en-GB" },
  CHF: { name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭", region: "fr-CH" },
  CAD: { name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦", region: "en-CA" },
  AUD: { name: "Australian Dollar", symbol: "A$", flag: "🇦🇺", region: "en-AU" },
  JPY: { name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", region: "ja-JP" },
  CNY: { name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", region: "zh-CN" },
  MXN: { name: "Mexican Peso", symbol: "$", flag: "🇲🇽", region: "es-MX" },
  BRL: { name: "Brazilian Real", symbol: "R$", flag: "🇧🇷", region: "pt-BR" },
  ARS: { name: "Argentine Peso", symbol: "AR$", flag: "🇦🇷", region: "es-AR" },
};

export const DEFAULT_CURRENCY = "EUR";

/**
 * Get currency details. Throws if code is invalid.
 */
export function getCurrency(code) {
  const currency = CURRENCIES[code];
  if (!currency) {
    throw new Error(`Unknown currency code: ${code}`);
  }
  return { code, ...currency };
}

/**
 * Same as getCurrency but never throws — falls back to the default currency.
 * Used by the formatters, which run inside renders: an unknown code coming from
 * the database must degrade to EUR, not blank the screen.
 */
function resolveCurrency(code) {
  const currency = CURRENCIES[code];
  if (currency) return { code, ...currency };
  return { code: DEFAULT_CURRENCY, ...CURRENCIES[DEFAULT_CURRENCY] };
}

/** Just the symbol (€, $, …). Safe for unknown codes. */
export function getCurrencySymbol(code) {
  return resolveCurrency(code).symbol;
}

/**
 * Intl.NumberFormat instances are expensive to build and these formatters run
 * inside list renders, so cache one per locale+currency pair.
 */
const formatterCache = new Map();

function getFormatter(locale, code, decimals) {
  const key = `${locale}|${code}|${decimals ?? "auto"}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const options = { style: "currency", currency: code };
  if (decimals != null) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }

  let formatter;
  try {
    // narrowSymbol keeps "$" instead of "US$"/"MX$" so the amounts match the
    // symbols shown in the currency picker.
    formatter = new Intl.NumberFormat(locale, { ...options, currencyDisplay: "narrowSymbol" });
  } catch {
    // Older engines reject currencyDisplay: "narrowSymbol".
    formatter = new Intl.NumberFormat(locale, options);
  }
  formatterCache.set(key, formatter);
  return formatter;
}

/**
 * Format a numeric value with its currency symbol. Does not convert anything —
 * only changes how the number is rendered.
 *
 * Placement, grouping, spacing and decimal count all come from Intl, so each
 * locale/currency pair reads the way its speakers expect:
 *   formatCurrencyValue(1234.56, "EUR", "es") -> "1.234,56 €"
 *   formatCurrencyValue(1234.56, "USD", "en") -> "$1,234.56"
 *   formatCurrencyValue(1234.56, "JPY", "es") -> "1.235 ¥"   (yen has no decimals)
 *
 * The symbol glyph itself is taken from CURRENCIES so it always matches the
 * currency picker.
 *
 * @param value — numeric value
 * @param currencyCode — ISO 4217 code (e.g. 'EUR'); unknown codes fall back to EUR
 * @param locale — display locale ('es', 'en', …), not the currency's home region
 * @param options.decimals — force a decimal count (0 for compact chart labels);
 *                           omit to use whatever the currency normally uses
 */
export function formatCurrencyValue(value, currencyCode = DEFAULT_CURRENCY, locale = "es", options = {}) {
  const currency = resolveCurrency(currencyCode);
  const num = Number(value);
  const safeNum = Number.isFinite(num) ? num : 0;

  return getFormatter(locale, currency.code, options.decimals)
    .formatToParts(safeNum)
    .map((part) => (part.type === "currency" ? currency.symbol : part.value))
    .join("");
}

/**
 * Number of decimals a currency uses (0 for JPY, 2 for most others).
 * Useful for amount inputs so the step/precision matches the currency.
 */
export function getCurrencyDecimals(currencyCode = DEFAULT_CURRENCY, locale = "es") {
  const currency = resolveCurrency(currencyCode);
  return getFormatter(locale, currency.code).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Same as formatCurrencyValue but without decimals — for chart labels and stat tiles. */
export function formatCurrencyRounded(value, currencyCode = DEFAULT_CURRENCY, locale = "es") {
  return formatCurrencyValue(value, currencyCode, locale, { decimals: 0 });
}

/**
 * Get all currencies as sorted array for UI lists.
 * Sorted by: primary use regions first (EUR, USD, GBP), then alphabetically.
 */
export function getCurrenciesList() {
  const order = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "MXN", "BRL", "ARS"];
  return order.map((code) => ({ code, ...CURRENCIES[code] }));
}

/**
 * Validate currency code format (ISO 4217: 3 uppercase letters).
 */
export function isValidCurrencyCode(code) {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code) && code in CURRENCIES;
}
