import { supabase } from "../supabaseClient";

/**
 * Tipos de cambio contra EUR (public.exchange_rates), actualizados por un
 * cron diario en Supabase — ver 20260916_108_exchange_rates.sql. El cliente
 * nunca escribe esta tabla, solo la lee para convertir importes entre
 * divisas al mostrar totales combinados (ver `convert` en src/currency.jsx).
 */
export const exchangeRatesService = {
  /** @returns {Promise<Record<string, number>>} { [currencyCode]: rate_to_eur } */
  async getExchangeRates() {
    const { data, error } = await supabase.from("exchange_rates").select("currency_code, rate_to_eur");
    if (error) {
      console.error("Error fetching exchange rates:", error);
      return {};
    }
    return Object.fromEntries((data || []).map((row) => [row.currency_code, Number(row.rate_to_eur)]));
  },
};
