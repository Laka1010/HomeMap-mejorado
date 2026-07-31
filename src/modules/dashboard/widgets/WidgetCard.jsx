/**
 * Cáscara compartida por los 6 widgets de Inicio: mismo padding/radio/header,
 * contenido libre por widget. Cada widget decide su propio "sin datos → null"
 * ANTES de llegar aquí, así que este componente asume que siempre hay algo
 * que mostrar.
 */
export function WidgetCard({ icon: Icon, title, action, children }) {
  return (
    <div className="hm-card hm-fade-in" style={{ padding: 20, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {Icon ? <Icon size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} /> : null}
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
