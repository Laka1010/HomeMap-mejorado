import { useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { useTranslation } from "../../i18n";
import { financialSpacesService } from "./services/financialSpacesService";

/**
 * Selector de Workspace: un botón único (icono + nombre + chevron) que abre
 * una hoja con la lista de Workspaces accesibles, mismo patrón que ya usa
 * la app para cambiar de casa (`HomeSelector.jsx` / el switcher de la
 * cabecera) — reutilizamos esa idea en vez de una fila de pills, que deja
 * de caber bien en cuanto alguien tiene varios Workspaces. Personal /
 * Household / cualquier Workspace compartido son la misma fila de lista,
 * sin distinción visual por tipo.
 */
export function SpaceSwitcher({ spaces, houseId, activeSpaceId, onChange, onSpaceCreated }) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  return (
    <>
      <button
        className="hm-tap"
        onClick={() => setShowPicker(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface-alt)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)", display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }}>
          {activeSpace?.icon || "💰"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeSpace?.name || t("spaces.workspaceLabel")}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{t("spaces.switchWorkspace")}</div>
        </div>
        <ChevronDown size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
      </button>

      {showPicker && (
        <div className="hm-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="hm-modal hm-scroll" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="hm-modal-handle" />
            <div className="hm-modal-header">
              <button className="hm-modal-close" onClick={() => setShowPicker(false)} aria-label={t("spaces.cancel")}>✕</button>
              <h3 className="hm-display hm-modal-title">{t("spaces.workspaceLabel")}</h3>
            </div>
            <div className="hm-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {spaces.map((space) => {
                  const active = space.id === activeSpaceId;
                  return (
                    <button
                      key={space.id}
                      onClick={() => { onChange(space.id); setShowPicker(false); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: 14,
                        borderRadius: "var(--radius)",
                        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                        background: active ? "var(--accent-soft)" : "var(--surface)",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: active ? "var(--surface)" : "var(--surface-alt)", display: "grid", placeItems: "center", fontSize: 19, flexShrink: 0 }}>
                        {space.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{space.name}</div>
                      </div>
                      {active && (
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                className="hm-btn hm-btn-soft hm-btn--full"
                style={{ marginTop: 14 }}
                onClick={() => { setShowPicker(false); setShowCreate(true); }}
              >
                <Plus size={16} /> {t("spaces.addSharedSpace")}
              </button>
            </div>
          </div>
        </div>
      )}

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
