import { useEffect, useState } from "react";

/**
 * Estado de navegación (pestaña activa, sub-vistas de Hogar/Cajas,
 * pestaña de Organización) y los helpers para moverse entre pantallas.
 * El listener del botón físico "atrás" de Android se queda en
 * HomeMapAppInner: necesita `modal`/`confirmDialog`/`state` de otros
 * hooks, así que usa los setters que este hook expone en vez de vivir
 * aquí dentro.
 */
export function useHomeNavigation(canSeeEconomy) {
  const [route, setRoute] = useState({ tab: "inicio" });
  const [prevTab, setPrevTab] = useState(null); /* UX: store previous tab to enable sensible back navigation */
  const [micasaView, setMicasaView] = useState({});
  const [cajasView, setCajasView] = useState({});
  const [organizationTab, setOrganizationTab] = useState("compras");

  useEffect(() => {
    if (route.tab === "economia" && !canSeeEconomy) {
      setRoute({ tab: "inicio" });
    }
  }, [route.tab, canSeeEconomy]);

  // Mapeo de rutas antiguas a nuevas (backwards compatibility)
  const mapTabToNewPillar = (key) => {
    const mappings = {
      // Hogar
      "micasa": "hogar",
      "cajas": "hogar",
      // Organización
      "compras": "organizacion",
      "tareas": "organizacion",
      // Economía
      "facturas": "economia",
      // Mantener como está
      "inicio": "inicio",
      "hogar": "hogar",
      "organizacion": "organizacion",
      "economia": "economia",
    };
    return mappings[key] || key;
  };

  const goTo = (r) => {
    // Normaliza claves de ruta heredadas (micasa/cajas/tareas/compras/...) al
    // pilar nuevo correspondiente, igual que ya hace `selectTab` — si no, el
    // contenido se renderiza igual (hay bloques de compatibilidad), pero ni
    // el bottom-nav ni el selector de Organización quedan resaltados porque
    // comparan contra la clave nueva.
    const newTab = mapTabToNewPillar(r.tab);
    /* Preserve previous tab when navigating to detail-like screens */
    if (route?.tab && route.tab !== "objectDetail" && route.tab !== newTab) setPrevTab(route.tab);
    // `cajasView` se limpia al navegar a una habitación/zona porque el pilar
    // Hogar decide qué pintar mirando `cajasView.containerId` (caja abierta)
    // antes que `micasaView`: sin esto, volver a una habitación desde una
    // caja seguiría mostrando la caja.
    if (r.tab === "micasa") {
      setMicasaView({ roomId: r.roomId, zoneId: r.zoneId });
      setCajasView({});
    }
    if (r.tab === "cajas") setCajasView({ containerId: r.containerId });
    if (["compras", "tareas", "notas", "calendario"].includes(r.tab)) setOrganizationTab(r.tab);
    setRoute({ ...r, tab: newTab });
  };

  const selectTab = (key) => {
    const newKey = mapTabToNewPillar(key);
    if (route?.tab && route.tab !== newKey) setPrevTab(route.tab);
    // Reset view state when switching pillars
    if (newKey === "hogar") {
      if (key === "micasa") setMicasaView({});
      if (key === "cajas") setCajasView({});
    }
    setRoute({ tab: newKey });
    window.scrollTo(0, 0);
  };

  return {
    route, setRoute,
    prevTab, setPrevTab,
    micasaView, setMicasaView,
    cajasView, setCajasView,
    organizationTab, setOrganizationTab,
    mapTabToNewPillar, goTo, selectTab,
  };
}
