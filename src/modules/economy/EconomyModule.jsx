import { useState } from "react";
import { EconomyOverview } from "./EconomyOverview";
import BillsSection from "./BillsSection";
import MovementsSection from "./MovementsSection";
import StatisticsSection from "./StatisticsSection";
import { useTranslation } from "../../i18n";

export function EconomyModule({ state, dispatch, openModal, currentHome, user }) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState("overview");
  const [movementsType, setMovementsType] = useState("expenses");

  const goToPage = (page, opts) => {
    if (opts?.movementsType) setMovementsType(opts.movementsType);
    setCurrentPage(page);
  };

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

        {/* Tabs de navegación — grid fijo de 2 columnas (nunca auto-fit):
            con minmax(100px,1fr) el número de columnas que caben a ancho de
            móvil está justo en el límite entre 2 y 3, así que una variación
            mínima del ancho del contenedor (p. ej. la lista de abajo cambiando
            de alto) hacía que el grid "saltara" de 2x2 a 3+1 y todo se
            desplazara. Con 2 columnas fijas siempre son 4 botones en 2x2. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {[
            { key: "overview", label: t("economy.tabOverview") },
            { key: "bills", label: t("economy.tabBills") },
            { key: "movements", label: t("economy.tabMovements") },
            { key: "statistics", label: t("economy.tabStatistics") },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => goToPage(tab.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: currentPage === tab.key ? "var(--accent)" : "var(--surface-alt)",
                color: currentPage === tab.key ? "var(--accent-ink)" : "var(--ink)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido por página */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 0" }}>
        <div key={currentPage} className="hm-fade-in">
          {currentPage === "overview" && (
            <EconomyOverview currentHome={currentHome} openModal={openModal} goToPage={goToPage} activity={state?.activity} user={user} />
          )}

          {currentPage === "bills" && (
            <BillsSection currentHome={currentHome} openModal={openModal} state={state} dispatch={dispatch} user={user} />
          )}

          {currentPage === "movements" && (
            <MovementsSection currentHome={currentHome} openModal={openModal} initialType={movementsType} />
          )}

          {currentPage === "statistics" && (
            <StatisticsSection currentHome={currentHome} />
          )}
        </div>
      </div>
    </div>
  );
}
