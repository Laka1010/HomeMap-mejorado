const SEVERITY_META = {
  info: { label: "INFO", color: "var(--ink-soft)", bg: "var(--surface-alt)" },
  warning: { label: "HIGH", color: "var(--chart-warning, #b7791f)", bg: "var(--danger-soft)" },
  critical: { label: "CRITICAL", color: "var(--danger)", bg: "var(--danger-soft)" },
};

/** "HIGH" es la etiqueta de UI para severity='warning' (ver nota de diseño
 * en 20260808_050_security_center.sql: la tabla mantiene 3 niveles). */
export function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] || { label: severity, color: "var(--ink-soft)", bg: "var(--surface-alt)" };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
        color: meta.color, background: meta.bg,
      }}
    >
      {meta.label}
    </span>
  );
}

const STATUS_META = {
  active: { label: "Active", color: "var(--success, #2f9e5c)", bg: "var(--success-soft, #e6f4ea)" },
  restricted: { label: "Restricted", color: "var(--chart-warning, #b7791f)", bg: "var(--danger-soft)" },
  suspended: { label: "Suspended", color: "var(--danger)", bg: "var(--danger-soft)" },
  banned: { label: "Banned", color: "#fff", bg: "var(--danger)" },
};

export function AccountStatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em",
        color: meta.color, background: meta.bg,
      }}
    >
      {meta.label}
    </span>
  );
}
