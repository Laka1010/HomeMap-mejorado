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
 */
export function useDashboardEconomy(houseId, enabled) {
  const [data, setData] = useState({ bills: [], monthIncome: 0, monthExpenses: 0, prevMonthExpenses: 0, loaded: false });

  useEffect(() => {
    if (!houseId || !enabled) {
      setData({ bills: [], monthIncome: 0, monthExpenses: 0, prevMonthExpenses: 0, loaded: true });
      return;
    }
    let cancelled = false;
    Promise.all([
      economyService.getPendingBills(houseId).catch(() => []),
      economyService.getMonthIncome(houseId).catch(() => 0),
      economyService.getMonthExpenses(houseId).catch(() => 0),
      economyService.getMonthExpenses(houseId, -1).catch(() => 0),
    ]).then(([bills, monthIncome, monthExpenses, prevMonthExpenses]) => {
      if (cancelled) return;
      setData({ bills, monthIncome, monthExpenses, prevMonthExpenses, loaded: true });
    });
    return () => { cancelled = true; };
  }, [houseId, enabled]);

  return data;
}
