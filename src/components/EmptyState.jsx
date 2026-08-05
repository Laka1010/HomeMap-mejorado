/**
 * Estado vacío reutilizable. La app tenía dos presentaciones idénticas en
 * intención pero reimplementadas por separado en cada módulo: una "desnuda"
 * (icono en cuadro + título + subtítulo, usada dentro de secciones de
 * MiCasa/Cajas) y otra dentro de una `.hm-card` con borde (usada en listas
 * de Tareas/Notas/Compras/Notificaciones/Búsqueda). Se conservan ambas
 * variantes tal cual (mismo marcado y clases que ya tenían) para no cambiar
 * ningún aspecto visual existente — solo se centraliza el componente.
 */
export function EmptyState({ icon: Icon, title, subtitle, action, card = false }) {
  if (card) {
    return (
      <div className="hm-card hm-card--p24 hm-card--center">
        <Icon size={26} style={{ color: "var(--accent)", marginBottom: 10 }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
        {subtitle && <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: action ? 14 : 0 }}>{subtitle}</div>}
        {action}
      </div>
    );
  }
  return (
    <div className="hm-fade-in hm-empty">
      <div className="hm-empty-icon"><Icon size={26} /></div>
      <p className="hm-empty-title">{title}</p>
      <p className="hm-empty-subtitle">{subtitle}</p>
      {action}
    </div>
  );
}
