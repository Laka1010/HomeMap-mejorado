import { createContext, useContext, useMemo } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./economyCategories";

/**
 * Listas de categorías de Economía (gastos e ingresos) del hogar activo,
 * accesibles desde cualquier módulo sin pasar props — mismo patrón que
 * `useCurrency`.
 *
 * Antes eran las constantes EXPENSE_CATEGORIES / INCOME_CATEGORIES; ahora se
 * editan en Configuración del hogar y se guardan en `economy_categories`
 * (una fila por categoría y hogar). App las mete aquí desde `state`. Si un
 * hogar todavía no tiene lista propia se usan los defaults del catálogo.
 */
const EconomyCategoriesContext = createContext({
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
});

export function EconomyCategoriesProvider({ value, children }) {
  const resolved = useMemo(() => ({
    expense: value?.expense?.length ? value.expense : EXPENSE_CATEGORIES,
    income: value?.income?.length ? value.income : INCOME_CATEGORIES,
  }), [value]);

  return (
    <EconomyCategoriesContext.Provider value={resolved}>
      {children}
    </EconomyCategoriesContext.Provider>
  );
}

export function useEconomyCategories() {
  return useContext(EconomyCategoriesContext);
}
