import { useEffect, useState } from "react";
import { economyService } from "../economy/services/economyService";

/**
 * Datos de economía para el dashboard de Inicio: facturas pendientes (para
 * Home Status y Today) + ingresos/gastos del mes (para Economy Summary), en
 * una sola carga compartida por los tres widgets en vez de que cada uno
 * repita la misma consulta.
 *
 * `enabled` es `canSeeEconomy` — si un niño no puede ver economía, ni
 * siquiera se pide el dato (no es solo un ocultado visual).
 *
 * `convert` (de useCurrency()) convierte cada movimiento a la divisa
 * principal antes de sumarlo — este resumen es house-wide, potencialmente
 * con cuentas de varias divisas distintas.
 */
export function useDashboardEconomy(houseId, enabled, convert) {
  const [data, setData] = useState({ bills: [], monthIncome: 0, monthExpenses: 0, prevMonthExpenses: 0, loaded: false });

  useEffect(() => {
    if (!houseId || !enabled) {
      setData({ bills: [], monthIncome: 0, monthExpenses: 0, prevMonthExpenses: 0, loaded: true });
      return;
    }
    let cancelled = false;
    Promise.all([
      economyService.getPendingBills(houseId).catch(() => []),
      economyService.getMonthIncome(houseId, convert).catch(() => 0),
      economyService.getMonthExpenses(houseId, 0, convert).catch(() => 0),
      economyService.getMonthExpenses(houseId, -1, convert).catch(() => 0),
    ]).then(([bills, monthIncome, monthExpenses, prevMonthExpenses]) => {
      if (cancelled) return;
      setData({ bills, monthIncome, monthExpenses, prevMonthExpenses, loaded: true });
    });
    return () => { cancelled = true; };
    // `convert` cambia de identidad cuando terminan de cargar los tipos de
    // cambio (ver CurrencyProvider) — hace falta releer con los datos ya
    // convertidos correctamente.
  }, [houseId, enabled, convert]);

  return data;
}
