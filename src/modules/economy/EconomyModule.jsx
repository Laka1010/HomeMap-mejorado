import { useEffect, useState } from "react";
import { EconomyOverview } from "./EconomyOverview";
import BillsSection from "./BillsSection";
import MovementsSection from "./MovementsSection";
import StatisticsSection from "./StatisticsSection";
import { SpaceSwitcher } from "./SpaceSwitcher";
import { financialSpacesService } from "./services/financialSpacesService";
import { useTranslation } from "../../i18n";

/**
 * Un único conjunto de pantallas (Resumen/Cuentas/Movimientos/Facturas/
 * Estadísticas) para cualquier Workspace — Personal, Household o uno
 * compartido (Lucas & Emma, Viaje...). El selector de arriba (SpaceSwitcher)
 * decide QUÉ Workspace se ve; nunca cuáles pantallas existen — eso ya no
 * depende de `type` (ver revisión de arquitectura: antes "Facturas" se
 * ocultaba fuera de Household, lo cual no tenía sentido — Netflix, Spotify o
 * el gimnasio son facturas personales tan legítimas como la luz del hogar).
 */
export function EconomyModule({ state, dispatch, openModal, currentHome, user, refreshToken }) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState("overview");
  const [movementsType, setMovementsType] = useState("expenses");
  const [spaces, setSpaces] = useState([]);
  const [currentSpaceId, setCurrentSpaceId] = useState(null);

  // Espacios de esta casa (Household + Shared atados a ella) más el Personal
  // del usuario (que no tiene casa). Se recarga si cambia la casa activa o
  // si `refreshToken` sube (mismo mecanismo que ya fuerza el remount de
  // abajo cuando el "añadir rápido" global crea algo).
  useEffect(() => {
    let cancelled = false;
    financialSpacesService.listMySpaces().then((list) => {
      if (cancelled) return;
      const scoped = list.filter((s) => s.type === "personal" || s.house_id === currentHome?.id);
      setSpaces(scoped);
      setCurrentSpaceId((prev) => {
        if (prev && scoped.some((s) => s.id === prev)) return prev;
        return scoped.find((s) => s.type === "household")?.id || scoped[0]?.id || null;
      });
    });
    return () => { cancelled = true; };
  }, [currentHome?.id, refreshToken]);

  const goToPage = (page, opts) => {
    if (opts?.movementsType) setMovementsType(opts.movementsType);
    setCurrentPage(page);
  };

  const handleSpaceCreated = (space) => {
    setSpaces((prev) => [...prev, space]);
    setCurrentSpaceId(space.id);
  };

  const tabs = [
    { key: "overview", label: t("economy.tabOverview") },
    { key: "bills", label: t("economy.tabBills") },
    { key: "movements", label: t("economy.tabMovements") },
    { key: "statistics", label: t("economy.tabStatistics") },
  ];

  return (
    // minWidth: 0 es necesario porque este div es un item de un grid (.hm-fade-in
    // del wrapper de ruta en App.jsx). Sin él, un nombre largo sin espacios en un
    // movimiento (p. ej. "Nómina Fase3 Editada") empuja el min-content de todo
    // este módulo por encima del ancho disponible, ensanchando el módulo entero
    // (incluida la fila de pestañas de arriba) en vez de truncarse con "…" como
    // ya está preparado para hacer — eso era el "salto" de estructura en móvil.
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, minWidth: 0 }}>
      {/* Header con navegación. Padding solo vertical: el horizontal ahora lo
          da el wrapper de ruta compartido en App.jsx (para que todas las
          pestañas tengan el mismo margen lateral que esta). */}
      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
        <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: "0 0 16px 0" }}>
          {t("nav.economia")}
        </h1>

        <div style={{ marginBottom: 16 }}>
          <SpaceSwitcher
            spaces={spaces}
            houseId={currentHome?.id}
            activeSpaceId={currentSpaceId}
            onChange={setCurrentSpaceId}
            onSpaceCreated={handleSpaceCreated}
          />
        </div>

        {/* Tabs de navegación — grid fijo de 2 columnas (nunca auto-fit):
            con minmax(100px,1fr) el número de columnas que caben a ancho de
            móvil está justo en el límite entre 2 y 3, así que una variación
            mínima del ancho del contenedor (p. ej. la lista de abajo cambiando
            de alto) hacía que el grid "saltara" de 2x2 a 3+1 y todo se
            desplazara. Con 2 columnas fijas siempre, sean 4 o 5 pestañas. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {tabs.map((tab) => {
            const isActive = currentPage === tab.key;
            // Solo "movements" lleva el aro de seleccionado (prueba aislada);
            // el resto de pestañas quedan exactamente como estaban. El
            // feedback al pulsar ya es global (button:active en App.jsx).
            const isMovements = tab.key === "movements";
            return (
              <button
                key={tab.key}
                onClick={() => goToPage(tab.key)}
                className={isMovements && isActive ? "hm-tab-movements--active" : undefined}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "var(--accent)" : "var(--surface-alt)",
                  color: isActive ? "var(--accent-ink)" : "var(--ink)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido por página */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 0" }}>
        <div key={`${currentPage}:${currentSpaceId}:${refreshToken}`} className="hm-fade-in">
          {currentPage === "overview" && (
            <EconomyOverview
              currentHome={currentHome}
              spaceId={currentSpaceId}
              spaces={spaces}
              openModal={openModal}
              goToPage={goToPage}
              activity={state?.activity}
              user={user}
            />
          )}

          {currentPage === "bills" && (
            <BillsSection currentHome={currentHome} spaceId={currentSpaceId} spaces={spaces} state={state} dispatch={dispatch} user={user} />
          )}

          {currentPage === "movements" && (
            <MovementsSection currentHome={currentHome} spaceId={currentSpaceId} user={user} initialType={movementsType} />
          )}

          {currentPage === "statistics" && (
            <StatisticsSection currentHome={currentHome} spaceId={currentSpaceId} />
          )}
        </div>
      </div>
    </div>
  );
}
