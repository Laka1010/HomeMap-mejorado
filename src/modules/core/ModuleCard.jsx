
export function ModuleCard({ icon: Icon, title, subtitle, badge, children, onClick, accent = false, compact = false }) {
  return (
    <div
      className="hm-card hm-tap"
      style={{
        padding: compact ? 12 : 16,
        cursor: onClick ? "pointer" : "default",
        borderLeft: accent ? "3px solid var(--accent)" : "1px solid var(--border)",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: compact ? 6 : 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {Icon ? <Icon size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} /> : null}
          <div style={{ fontWeight: 700, fontSize: compact ? 14 : 15 }}>{title}</div>
        </div>
        {badge ? (
          <span className="hm-mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {badge}
          </span>
        ) : null}
      </div>
      {subtitle ? <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{subtitle}</div> : null}
      {children ? <div style={{ marginTop: compact ? 8 : 14 }}>{children}</div> : null}
    </div>
  );
}
