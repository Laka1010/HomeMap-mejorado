import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "../../i18n";
import { financialSpacesService } from "./services/financialSpacesService";

/**
 * Pill row Personal / Shared... / Household, mismo patrón inline que los
 * filtros de Bills/Movements (no existe un <PillTabs> compartido en la app,
 * ver economía de las demás secciones). `spaces` ya viene filtrada por
 * EconomyModule a los espacios de esta casa (+ el Personal, que no tiene
 * casa). El "+" crea un espacio compartido nuevo (solo pide nombre).
 */
export function SpaceSwitcher({ spaces, houseId, activeSpaceId, onChange, onSpaceCreated }) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {spaces.map((space) => {
          const active = space.id === activeSpaceId;
          return (
            <button
              key={space.id}
              onClick={() => onChange(space.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 999,
                border: "none",
                background: active ? "var(--accent)" : "var(--surface-alt)",
                color: active ? "var(--accent-ink)" : "var(--ink)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>{space.icon}</span>
              <span>{space.name}</span>
            </button>
          );
        })}

        <button
          onClick={() => setShowCreate(true)}
          aria-label={t("spaces.addSharedSpace")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px dashed var(--border)",
            background: "transparent",
            color: "var(--ink-soft)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {showCreate && (
        <CreateSharedSpaceModal
          houseId={houseId}
          onClose={() => setShowCreate(false)}
          onCreated={(space) => {
            setShowCreate(false);
            onSpaceCreated(space);
          }}
        />
      )}
    </>
  );
}

export function CreateSharedSpaceModal({ houseId, onClose, onCreated }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const space = await financialSpacesService.createSharedSpace(name.trim(), houseId);
      onCreated(space);
    } catch (err) {
      setError(t("spaces.createError"));
      setSaving(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="hm-modal-handle" />
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("spaces.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("spaces.newSharedSpaceTitle")}</h3>
        </div>
        <div className="hm-modal-body">
          <label className="hm-label">{t("spaces.nameLabel")}</label>
          <input
            className="hm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("spaces.namePlaceholder")}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />

          {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("spaces.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
              {t("spaces.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
