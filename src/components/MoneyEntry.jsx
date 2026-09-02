import { ChevronDown } from "lucide-react";
import { useCurrency } from "../currency";

/**
 * Primitivas visuales compartidas para las pantallas de "registrar dinero"
 * (gasto, ingreso, factura, movimiento). Antes cada modal apilaba
 * `<label className="hm-label">` + `<input className="hm-input">`; ahora todas
 * hablan el mismo idioma: el importe como protagonista arriba y, debajo,
 * secciones con icono + valor + chevron (estilo app de finanzas).
 *
 * Solo presentación: el estado, el submit y la validación se quedan en cada
 * modal — estas piezas no guardan nada.
 */

/** Importe protagonista, editable, con el símbolo de la moneda al lado. */
export function AmountHero({ value, onChange, autoFocus = true }) {
  const { symbol } = useCurrency();
  // `ch` hace que el ancho del input siga al contenido para que el símbolo
  // quede justo al lado del número y el conjunto se vea centrado.
  const width = `${Math.min(Math.max((value || "").length, 1), 7)}ch`;
  return (
    <div className="hm-money-hero">
      <input
        className="hm-money-hero-input"
        inputMode="decimal"
        placeholder="0"
        value={value}
        autoFocus={autoFocus}
        style={{ width }}
        aria-label="Importe"
        onChange={(e) => onChange(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
      />
      <span className="hm-money-hero-cur">{symbol}</span>
    </div>
  );
}

/** Sección: etiqueta en mayúsculas + tarjeta que agrupa una o varias filas. */
export function FieldGroup({ label, children }) {
  return (
    <div className="hm-field-group">
      {label ? <div className="hm-field-label">{label}</div> : null}
      <div className="hm-field-card">{children}</div>
    </div>
  );
}

/**
 * Fila con icono + contenido y chevron a la derecha.
 * - `options` -> se comporta como un selector nativo (un <select> transparente
 *   cubre toda la fila, así el toque abre el picker del sistema).
 * - `onClick` -> se comporta como botón.
 * - si no se pasa ninguno de los dos, es una fila informativa.
 */
export function FieldRow({
  icon: Icon,
  title,
  hint,
  options,
  value,
  onValueChange,
  onClick,
  chevron = true,
}) {
  const body = (
    <>
      {Icon ? (
        <span className="hm-field-icon">
          <Icon size={18} />
        </span>
      ) : null}
      <span className="hm-field-main">
        <span className="hm-field-title">{title}</span>
        {hint ? <span className="hm-field-hint">{hint}</span> : null}
      </span>
      {chevron ? <ChevronDown size={18} className="hm-field-chevron" /> : null}
    </>
  );

  if (options) {
    return (
      <label className="hm-field-row">
        {body}
        <select
          className="hm-field-select"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="hm-field-row" onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className="hm-field-row">{body}</div>;
}

/**
 * Fila de campo con un input de texto libre (descripción / nombre / fecha).
 * Con `multiline` usa un <textarea> (notas). `onEnter` permite enviar el
 * formulario con la tecla Enter en los campos de una sola línea.
 */
export function FieldTextRow({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
  inputMode,
  multiline = false,
  autoFocus = false,
  onEnter,
}) {
  return (
    <div className={`hm-field-row hm-field-row--text${multiline ? " hm-field-row--multiline" : ""}`}>
      {Icon ? (
        <span className="hm-field-icon">
          <Icon size={18} />
        </span>
      ) : null}
      {multiline ? (
        <textarea
          className="hm-field-text-input hm-field-text-area"
          rows={3}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="hm-field-text-input"
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onEnter ? (e) => { if (e.key === "Enter") onEnter(); } : undefined}
        />
      )}
    </div>
  );
}

/** Conmutador tipo "segmented control" (Gasto / Ingreso). */
export function SegmentedTabs({ value, onChange, options }) {
  return (
    <div className="hm-seg" role="tablist">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            className="hm-seg-btn"
            data-active={value === o.value}
            data-tone={o.tone || "neutral"}
            onClick={() => onChange(o.value)}
          >
            {Icon ? <Icon size={15} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta con conmutador (p. ej. "Marcar como recurrente"). */
export function ToggleCard({ icon: Icon, title, subtitle, checked, onChange }) {
  return (
    <label className="hm-toggle-card">
      {Icon ? (
        <span className="hm-toggle-card-icon">
          <Icon size={18} />
        </span>
      ) : null}
      <span className="hm-toggle-card-text">
        <span className="hm-toggle-card-title">{title}</span>
        {subtitle ? <span className="hm-toggle-card-sub">{subtitle}</span> : null}
      </span>
      <span className="hm-switch" data-on={checked}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="hm-switch-knob" />
      </span>
    </label>
  );
}
