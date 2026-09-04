import { useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { useTranslation } from "../../i18n";
import { CategoryPickerModal } from "../../components/CategoryPickerModal";
import { categoryLabel, categoryEmoji } from "./economyCategories";

/**
 * Disparador + sheet para elegir una categoría de Economía. Sustituye a los
 * `<select className="hm-input">` y a los `FieldRow` con `options`: al tocar
 * abre `CategoryPickerModal` (cuadrícula con emoji + nombre).
 *
 * `variant`:
 *  - "input" -> botón con el aspecto de `.hm-input` (formularios de edición).
 *  - "row"   -> fila estilo `.hm-field-row` (formularios "+" nuevos).
 */
export function CategoryField({ categories, value, onChange, variant = "input", title }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const options = categories.map((c) => ({
    value: c,
    label: categoryLabel(c, t),
    emoji: categoryEmoji(c),
  }));

  const current = value || (categories.includes("Otros") ? "Otros" : categories[0]);
  const faceText = `${categoryEmoji(current)}  ${categoryLabel(current, t)}`;
  const sheetTitle = title || t("addMovement.categoryLabel");

  return (
    <>
      {variant === "row" ? (
        <button type="button" className="hm-field-row" onClick={() => setOpen(true)}>
          <span className="hm-field-icon"><Tag size={18} /></span>
          <span className="hm-field-main">
            <span className="hm-field-title">{faceText}</span>
          </span>
          <ChevronDown size={18} className="hm-field-chevron" />
        </button>
      ) : (
        <button
          type="button"
          className="hm-input"
          onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", cursor: "pointer" }}
        >
          <span>{faceText}</span>
          <ChevronDown size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
        </button>
      )}

      {open && (
        <CategoryPickerModal
          title={sheetTitle}
          value={current}
          options={options}
          onSelect={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
