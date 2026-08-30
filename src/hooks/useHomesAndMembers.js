import { useEffect, useState } from "react";
import { houseService } from "../services/houseService";

/**
 * Última casa visitada, por usuario. Se guarda en localStorage para que al
 * cerrar/reabrir o recargar la app se entre directamente en esa casa en vez
 * de en la primera de la lista.
 */
const LAST_HOME_KEY = "homemap-last-home";

export function readLastHomeId(userId) {
  if (!userId) return "";
  try {
    return localStorage.getItem(`${LAST_HOME_KEY}:${userId}`) || "";
  } catch {
    return "";
  }
}

function writeLastHomeId(userId, homeId) {
  if (!userId || !homeId) return;
  try {
    localStorage.setItem(`${LAST_HOME_KEY}:${userId}`, homeId);
  } catch {
    // localStorage no disponible (modo privado, etc.): la preferencia
    // simplemente no persiste, no es un error.
  }
}

export function clearLastHomeId(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(`${LAST_HOME_KEY}:${userId}`);
  } catch {
    // ignorar
  }
}

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

  // Recuerda la casa activa para la próxima vez que se abra la app.
  useEffect(() => {
    if (userId && currentHomeId) writeLastHomeId(userId, currentHomeId);
  }, [userId, currentHomeId]);

  /**
   * Selecciona una casa cuando no hay ninguna elegida Y ADEMÁS descarta un
   * `currentHomeId` que ya no está en la lista (te han expulsado de la casa,
   * o el owner la ha borrado desde otro dispositivo). Sin esta segunda
   * comprobación el id obsoleto sobrevivía a `refreshHomes`: `activeHome`
   * pasaba a null (miembros/notificaciones/retención vacíos) mientras
   * `currentHome` en App.jsx caía a `homes[0]`, así que la app enseñaba el
   * contenido cacheado de la casa vieja y escribía las altas nuevas en otra
   * casa distinta.
   *
   * Al elegir por defecto se prioriza la última casa visitada (localStorage)
   * si sigue en la lista; si no, la primera.
   */
  useEffect(() => {
    if (homes.length === 0) return;
    if (!currentHomeId || !homes.some((h) => h.id === currentHomeId)) {
      const lastId = readLastHomeId(userId);
      const next = homes.some((h) => h.id === lastId) ? lastId : homes[0].id;
      setCurrentHomeId(next);
    }
  }, [homes, currentHomeId, userId]);

  return {
    homes, setHomes,
    homesLoaded, setHomesLoaded,
    homesLoadError, setHomesLoadError,
    houseMembers, setHouseMembers,
    currentHomeId, setCurrentHomeId,
    activeHome,
  };
}
