import { AlertTriangle, Clock, AlertCircle, HeartHandshake, Target, TrendingDown } from "lucide-react";

const ICONS = { AlertTriangle, Clock, AlertCircle, HeartHandshake, Target, TrendingDown };

// Reutiliza los tokens semánticos ya existentes en vez de inventar una
// paleta de "warning" nueva — "urgent" en BillsSection/EconomyOverview ya
// usa --pin/--pin-soft, así que warning hace lo mismo aquí por consistencia.
const TONE_COLORS = {
  danger: { fg: "var(--danger)", bg: "var(--danger-soft)" },
  warning: { fg: "var(--pin)", bg: "var(--pin-soft)" },
  info: { fg: "var(--accent)", bg: "var(--accent-soft)" },
  success: { fg: "var(--success)", bg: "var(--success-soft)" },
};

/**
 * Fila de chips con los insights (máx. 3, ya priorizados por
 * `insightsEngine.computeInsights`). Es lo primero que se lee en el
 * Dashboard — de ahí que vaya justo debajo del título, antes de los 3 bloques.
 */
export function InsightsBar({ insights }) {
  if (!insights || insights.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {insights.map((insight, idx) => {
        const Icon = ICONS[insight.icon] || AlertCircle;
        const colors = TONE_COLORS[insight.tone] || TONE_COLORS.info;
        return (
          <div
            key={insight.id}
            className="hm-fade-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius)",
              background: colors.bg,
              animationDelay: `${idx * 60}ms`,
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(var(--surface-rgb), 0.55)", display: "grid", placeItems: "center", flexShrink: 0, color: colors.fg }}>
              <Icon size={15} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.fg, lineHeight: 1.35 }}>{insight.text}</div>
          </div>
        );
      })}
    </div>
  );
}
