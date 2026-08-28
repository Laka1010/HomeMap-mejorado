import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { economyService } from "../economy/services/economyService";
import { buildSearchIndex, searchGrouped } from "./searchEngine";

/**
 * Estado del buscador global. Las facturas no viven en `state` (se cargan
 * por casa bajo demanda, como en el resto de la app), así que se piden una
 * vez al montar el buscador (es decir, al abrirlo) en vez de mantenerlas
 * cargadas siempre — quien nunca abre la búsqueda no genera ese fetch.
 */
export function useGlobalSearch({ state, houseId, canSeeEconomy, members = [], getPath, t }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 150);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    if (!canSeeEconomy || !houseId) {
      setBills([]);
      return;
    }
    let cancelled = false;
    economyService.getAllBills(houseId)
      .then((data) => { if (!cancelled) setBills(data || []); })
      .catch(() => { if (!cancelled) setBills([]); });
    return () => { cancelled = true; };
  }, [houseId, canSeeEconomy]);

  const index = useMemo(
    () => buildSearchIndex(state, { bills, members, canSeeEconomy, getPath, t }),
    [state, bills, members, canSeeEconomy, getPath, t]
  );

  const groups = useMemo(() => searchGrouped(index, debouncedQuery), [index, debouncedQuery]);

  return { query, setQuery, groups };
}
