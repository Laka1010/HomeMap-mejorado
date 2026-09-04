import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { OptionSheet } from "./OptionSheet";

/**
 * Reemplazo directo del `<select className="hm-input">` nativo: un botón con el
 * mismo aspecto que abre un `OptionSheet` propio en vez del desplegable del
 * sistema operativo.
 *
 * @param {string} value
 * @param {Array<{value:string,label:string,hint?:string,emoji?:string}>} options
 * @param {(value:string)=>void} onChange
 * @param {string} [title]        Título del sheet.
 * @param {string} [placeholder]  Texto cuando no hay valor.
 */
export function SelectField({
  value,
  options = [],
  onChange,
  title,
  placeholder = "",
  disabled = false,
  className = "hm-input",
  style,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  const faceLabel = current
    ? `${current.emoji != null ? current.emoji + " " : ""}${current.label}`
    : placeholder;

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", ...style }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: current ? "var(--ink)" : "var(--ink-soft)" }}>
          {faceLabel}
        </span>
        <ChevronDown size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
      </button>

      {open && (
        <OptionSheet
          title={title}
          value={value}
          options={options}
          onSelect={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
