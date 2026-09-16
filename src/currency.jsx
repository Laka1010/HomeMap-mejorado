import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "./i18n";
import { exchangeRatesService } from "./services/exchangeRatesService";
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
 *
 * Cada cuenta puede tener su propia divisa (financial_accounts.currency_code)
 * distinta de esta — `code` aquí es solo la "divisa principal" para totales
 * combinados (patrimonio, estadísticas...), nunca sustituye la divisa propia
 * de una cuenta o de sus movimientos.
 */
const CurrencyContext = createContext({
  code: DEFAULT_CURRENCY,
  symbol: getCurrencySymbol(DEFAULT_CURRENCY),
  decimals: 2,
  format: (value) => formatCurrencyValue(value, DEFAULT_CURRENCY),
  formatRounded: (value) => formatCurrencyRounded(value, DEFAULT_CURRENCY),
  convert: (amount) => Number(amount) || 0,
});

export function CurrencyProvider({ code, children }) {
  const { locale } = useTranslation();
  const safeCode = isValidCurrencyCode(code) ? code : DEFAULT_CURRENCY;

  // Tipos de cambio contra EUR (public.exchange_rates), cargados una vez por
  // sesión — se actualizan por un cron diario en el servidor, no hace falta
  // refrescarlos en cada render. Objeto vacío mientras carga: `convert`
  // degrada a "sin convertir" hasta que llegan.
  const [rates, setRates] = useState({});
  useEffect(() => {
    let cancelled = false;
    exchangeRatesService.getExchangeRates().then((r) => {
      if (!cancelled) setRates(r);
    });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(
    () => ({
      code: safeCode,
      symbol: getCurrencySymbol(safeCode),
      decimals: getCurrencyDecimals(safeCode, locale),
      /** Importe numérico -> texto con símbolo, ya formateado para el idioma activo. */
      format: (amount) => formatCurrencyValue(amount, safeCode, locale),
      /** Igual pero sin decimales — para gráficas y tarjetas de estadísticas. */
      formatRounded: (amount) => formatCurrencyRounded(amount, safeCode, locale),
      /**
       * Convierte `amount` (en `fromCode`) a la divisa principal, vía EUR.
       * Solo para TOTALES COMBINADOS entre cuentas de distinta divisa — el
       * saldo/movimientos de una cuenta individual se siguen mostrando en su
       * propia divisa (formatCurrencyValue directo), nunca con esto.
       * Si falta el tipo de cambio de alguna divisa, degrada a devolver el
       * importe sin convertir en vez de romper el total.
       */
      convert: (amount, fromCode) => {
        const num = Number(amount) || 0;
        if (!fromCode || fromCode === safeCode) return num;
        const fromRate = rates[fromCode];
        const toRate = rates[safeCode];
        if (!fromRate || !toRate) return num;
        return (num / fromRate) * toRate;
      },
    }),
    [safeCode, locale, rates],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
