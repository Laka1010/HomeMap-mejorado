import { Construction } from "lucide-react";

/**
 * Placeholder de Fase 1 para toda sección que todavía no tiene página
 * funcional (Overview/Users/Houses/Workspaces/Finance/Support/Analytics/
 * System/Settings). No hay RPCs ni datos detrás — es intencional, ver
 * informe de Fase 1.
 */
export function PlaceholderPage({ section }) {
  return (
    <div className="hm-empty">
      <div className="hm-empty-icon">
        <Construction size={26} />
      </div>
      <p className="hm-empty-title">{section?.label || "Sección"}</p>
      <p className="hm-empty-subtitle">
        Esta sección se implementará en una fase posterior. La infraestructura
        de Admin Console ya está lista para alojarla.
      </p>
    </div>
  );
}
