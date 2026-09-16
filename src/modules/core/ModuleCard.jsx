
/**
 * `pop` (por defecto true) reproduce la animación de entrada `hm-pop` al
 * montar la tarjeta. Por defecto asume que cada montaje es una tarjeta
 * nueva de verdad — cierto en Tareas (lista plana, se reordena in-place).
 * Compras, en cambio, separa los artículos en secciones distintas (hoy/
 * más tarde/comprados) que son subárboles de React diferentes: marcar un
 * artículo como comprado lo mueve de una sección a otra, lo que remonta
 * su tarjeta aunque no sea nueva. Ahí hay que pasar `pop={false}` (o solo
 * true para ids realmente nuevos) para no repetir el "pop" en cada toggle.
 */
export function ModuleCard({ icon: Icon, title, subtitle, badge, children, onClick, accent = false, pop = true }) {
  return (
    <div
      className={"hm-card hm-tap" + (pop ? " hm-pop" : "")}
      style={{
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        borderLeft: accent ? "3px solid var(--accent)" : "1px solid var(--border)",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {Icon ? <Icon size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} /> : null}
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        </div>
        {badge ? (
          <span className="hm-mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {badge}
          </span>
        ) : null}
      </div>
      {subtitle ? <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{subtitle}</div> : null}
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </div>
  );
}
