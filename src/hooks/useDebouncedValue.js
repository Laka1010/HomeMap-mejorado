import { useEffect, useState } from "react";

/**
 * Retrasa la propagación de un valor que cambia rápido (p. ej. el texto de
 * un buscador mientras se escribe), para no recalcular resultados en cada
 * pulsación de tecla y mantener la UI fluida con listas grandes.
 */
export function useDebouncedValue(value, delayMs = 150) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
