/**
 * Marca de Haven: silueta de casa (con chimenea) cuyas dos paredes forman
 * una "H". Recreada como SVG vectorial a partir de la referencia visual del
 * logo (no hay archivo fuente disponible) — mismo trazo verde de marca
 * (#5E8C61 por defecto) en todos los tamaños en los que se usa el logo.
 */
export function BrandMark({ size = 32, color = "#5E8C61", strokeWidth = 7.5, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 46 L50 16 L85 46" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 32 L68 22 L79 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 46 L32 85" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M68 46 L68 85" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M32 66 L68 66" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
