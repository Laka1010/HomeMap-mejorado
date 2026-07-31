import { Star } from "lucide-react";
import { useTranslation } from "../i18n";

/**
 * Estrella de favorito reutilizada por objetos, compras, tareas y facturas
 * (las 4 áreas con favoritos). `onToggle` no recibe argumentos: cada
 * llamador ya sabe qué entidad está marcando, esto solo dibuja el icono y
 * evita que el click se propague a la tarjeta que lo contiene.
 */
export function FavoriteStar({ active, onToggle, size = 16 }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="hm-tap"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={t(active ? "common.removeFavorite" : "common.addFavorite")}
      title={t(active ? "common.removeFavorite" : "common.addFavorite")}
      aria-pressed={!!active}
      style={{
        background: "none",
        border: "none",
        padding: 4,
        margin: -4,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--pin)" : "var(--ink-soft)",
        flexShrink: 0,
      }}
    >
      <Star size={size} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
