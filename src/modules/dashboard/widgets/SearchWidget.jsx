import { Search } from "lucide-react";
import { useTranslation } from "../../../i18n";

/**
 * Atajo a la búsqueda global en Inicio, con el mismo tratamiento visual que
 * el resto de widgets (mismo padding/radio/cabecera que WidgetCard) pero
 * como tarjeta pulsable entera: tocar en cualquier punto abre el mismo
 * buscador que el icono de lupa de la cabecera (mismo modal, misma búsqueda).
 */
export function SearchWidget({ openModal }) {
  const { t } = useTranslation();
  if (!openModal) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openModal("globalSearch")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal("globalSearch"); } }}
      className="hm-card hm-fade-in hm-tap"
      style={{ padding: 20, display: "grid", gap: 14, cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Search size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t("search.title")}</div>
      </div>
      <div
        className="hm-input"
        style={{ display: "flex", alignItems: "center", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {t("search.placeholder")}
      </div>
    </div>
  );
}
