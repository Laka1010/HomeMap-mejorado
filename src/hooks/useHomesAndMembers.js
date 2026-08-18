import { useEffect, useState } from "react";
import { houseService } from "../services/houseService";

/**
 * Estado "puro" de casas/miembros: la lista de casas, la casa activa
 * derivada, los miembros de la casa activa, y la selección automática de
 * `currentHomeId`. Deliberadamente NO incluye `refreshHomes`,
 * `refreshHouseMembers` ni los handlers de mutación (renombrar, cambiar
 * rol, transferir propiedad, borrar casa...): esos llaman a `showNotice`,
 * que en HomeMapAppInner se define más abajo en el componente que este
 * hook (por eso se quedan allí, usando los setters que este hook expone).
 */
export function useHomesAndMembers(userId) {
  const [homes, setHomes] = useState([]);
  const [homesLoaded, setHomesLoaded] = useState(false);
  const [homesLoadError, setHomesLoadError] = useState(false);
  const [houseMembers, setHouseMembers] = useState([]);
  const [currentHomeId, setCurrentHomeId] = useState("");

  const activeHome = homes.find((h) => h.id === currentHomeId) || null;

  useEffect(() => {
    if (!activeHome?.id) {
      setHouseMembers([]);
      return;
    }
    let cancelled = false;
    houseService.getHouseMembers(activeHome.id)
      .then((members) => { if (!cancelled) setHouseMembers(members); })
      .catch((error) => {
        console.error("Error loading house members:", error);
      });
    return () => { cancelled = true; };
  }, [activeHome?.id]);

  useEffect(() => {
    if (userId && (!homes || homes.length === 0)) {
      setCurrentHomeId("");
    }
  }, [homes, userId]);

  useEffect(() => {
    if (homes.length > 0 && !currentHomeId) {
      setCurrentHomeId(homes[0].id);
    }
  }, [homes, currentHomeId]);

  return {
    homes, setHomes,
    homesLoaded, setHomesLoaded,
    homesLoadError, setHomesLoadError,
    houseMembers, setHouseMembers,
    currentHomeId, setCurrentHomeId,
    activeHome,
  };
}
