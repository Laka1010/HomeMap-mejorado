import { createContext, useContext, useMemo } from "react";
import { useTranslation } from "./i18n";
import {
  DEFAULT_CURRENCY,
  formatCurrencyRounded,
  formatCurrencyValue,
  getCurrencyDecimals,
  getCurrencySymbol,
  isValidCurrencyCode,
} from "./utils/currencyUtils";

/**
 * Moneda activa del hogar, accesible desde cualquier módulo sin pasar props.
 *
 * El código vive en houses.currency_code (una sola moneda por hogar) y entra
 * aquí desde App a través de la casa activa. Los importes se guardan siempre
 * como números: esto solo decide cómo se pintan.
 */
const CurrencyContext = createContext({
  code: DEFAULT_CURRENCY,
  symbol: getCurrencySymbol(DEFAULT_CURRENCY),
  decimals: 2,
  format: (value) => formatCurrencyValue(value, DEFAULT_CURRENCY),
  formatRounded: (value) => formatCurrencyRounded(value, DEFAULT_CURRENCY),
});

export function CurrencyProvider({ code, children }) {
  const { locale } = useTranslation();
  const safeCode = isValidCurrencyCode(code) ? code : DEFAULT_CURRENCY;

  const value = useMemo(
    () => ({
      code: safeCode,
      symbol: getCurrencySymbol(safeCode),
      decimals: getCurrencyDecimals(safeCode, locale),
      /** Importe numérico -> texto con símbolo, ya formateado para el idioma activo. */
      format: (amount) => formatCurrencyValue(amount, safeCode, locale),
      /** Igual pero sin decimales — para gráficas y tarjetas de estadísticas. */
      formatRounded: (amount) => formatCurrencyRounded(amount, safeCode, locale),
    }),
    [safeCode, locale],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
