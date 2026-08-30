import { useEffect, useState } from "react";
import { houseService } from "../services/houseService";
import { profileService } from "../services/profileService";

/**
 * Última casa visitada. La fuente de verdad es el perfil del usuario en el
 * servidor (profiles.last_home_id, sigue al usuario entre dispositivos);
 * localStorage es solo una caché local rápida / respaldo sin conexión para
 * no esperar a la red en el arranque.
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
  // Última casa según el servidor + si esa consulta ya terminó (para no
  // elegir una casa por defecto antes de saber cuál prefería el usuario).
  const [serverLastHomeId, setServerLastHomeId] = useState(null);
  const [lastHomeResolved, setLastHomeResolved] = useState(false);

  const activeHome = homes.find((h) => h.id === currentHomeId) || null;

  useEffect(() => {
    if (!userId) {
      setServerLastHomeId(null);
      setLastHomeResolved(false);
      return;
    }
    let cancelled = false;
    setLastHomeResolved(false);
    profileService.getLastHomeId(userId)
      .then((id) => { if (!cancelled) setServerLastHomeId(id); })
      .catch((error) => { console.error("Error loading last home:", error); })
      .finally(() => { if (!cancelled) setLastHomeResolved(true); });
    return () => { cancelled = true; };
  }, [userId]);

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

  // Recuerda la casa activa para la próxima vez que se abra la app: caché
  // local inmediata + perfil en el servidor. Solo escribe en el servidor si
  // el valor ha cambiado de verdad (evita un PUT redundante en cada arranque
  // cuando la selección ya coincide con el perfil).
  useEffect(() => {
    if (!userId || !currentHomeId) return;
    writeLastHomeId(userId, currentHomeId);
    if (currentHomeId === serverLastHomeId) return;
    setServerLastHomeId(currentHomeId);
    profileService.setLastHome(currentHomeId)
      .catch((error) => { console.error("Error saving last home:", error); });
  }, [userId, currentHomeId, serverLastHomeId]);

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
   * Al elegir por defecto se prioriza la última casa visitada: primero la
   * del perfil del servidor, luego la caché de localStorage, y si ninguna
   * sigue en la lista, la primera. Espera a que la consulta al servidor
   * termine (`lastHomeResolved`) para no elegir la primera y luego saltar.
   */
  useEffect(() => {
    if (homes.length === 0 || !lastHomeResolved) return;
    if (!currentHomeId || !homes.some((h) => h.id === currentHomeId)) {
      const next = [serverLastHomeId, readLastHomeId(userId)]
        .find((id) => id && homes.some((h) => h.id === id)) || homes[0].id;
      setCurrentHomeId(next);
    }
  }, [homes, currentHomeId, userId, serverLastHomeId, lastHomeResolved]);

  return {
    homes, setHomes,
    homesLoaded, setHomesLoaded,
    homesLoadError, setHomesLoadError,
    houseMembers, setHouseMembers,
    currentHomeId, setCurrentHomeId,
    activeHome,
  };
}
