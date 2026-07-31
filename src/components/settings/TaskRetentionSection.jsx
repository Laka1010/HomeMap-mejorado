import { Timer } from "lucide-react";
import { useTranslation } from "../../i18n";

/**
 * Antes vivía como un input suelto en la cabecera de Tareas; se mueve aquí
 * porque es un ajuste del hogar (se aplica a las tareas de todos los
 * miembros), no una preferencia personal — el resto de ajustes compartidos
 * (moneda, categorías) ya vive en esta pantalla.
 */
export function TaskRetentionSection({ days, onChange, isAdmin }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 16 }}>
          <Timer size={16} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("tasksModule.autoDeleteLabel")}</div>
      </div>

      <div className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("houseSettings.taskRetentionHint")}</div>
        <input
          className="hm-input"
          type="number"
          min={1}
          disabled={!isAdmin}
          style={{ width: 64, padding: "6px 8px", textAlign: "center" }}
          value={days}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
