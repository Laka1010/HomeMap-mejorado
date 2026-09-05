import { useEffect, useState } from "react";
import { ChevronDown, Plus, Check, Lock, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { financialSpacesService } from "./services/financialSpacesService";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

/**
 * Selector de Workspace: un botón único (icono + nombre + chevron) que abre
 * una hoja con la lista de Workspaces accesibles, mismo patrón que ya usa
 * la app para cambiar de casa (`HomeSelector.jsx` / el switcher de la
 * cabecera) — reutilizamos esa idea en vez de una fila de pills, que deja
 * de caber bien en cuanto alguien tiene varios Workspaces. Personal /
 * Household / cualquier Workspace compartido son la misma fila de lista,
 * sin distinción visual por tipo.
 */
export function SpaceSwitcher({ spaces, houseId, activeSpaceId, onChange, onSpaceCreated, canCreate = true, showLocked = true }) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [lockedSpaces, setLockedSpaces] = useState([]);
  const closePicker = () => setShowPicker(false);
  const { handleRef: pickerHandleRef, handleMouseDown: pickerHandleMouseDown, isSuppressingClick: isPickerSuppressingClick, sheetStyle: pickerSheetStyle } = useDragToDismiss(closePicker);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  // Espacios Personales de compañeros de casa que NO nos han concedido
  // acceso (ver economy_access_requests): se ven (nombre + icono) como
  // tarjeta bloqueada, pero no se pueden abrir — desde el perfil del
  // miembro en Configuración de la casa se puede solicitar acceso. Los que
  // SÍ tienen una solicitud aceptada ya llegan en `spaces` (vía
  // my_financial_spaces) y se excluyen aquí para no duplicarlos.
  useEffect(() => {
    let cancelled = false;
    if (!houseId || !showLocked) { setLockedSpaces([]); return; }
    financialSpacesService.listHousematesPersonalSpaces(houseId).then((list) => {
      if (cancelled) return;
      setLockedSpaces(list.filter((s) => !spaces.some((accessible) => accessible.id === s.id)));
    }).catch(() => { if (!cancelled) setLockedSpaces([]); });
    return () => { cancelled = true; };
  }, [houseId, spaces, showLocked]);

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
        <div className="hm-modal-overlay" onClick={(e) => { if (isPickerSuppressingClick()) return; closePicker(e); }}>
          <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...pickerSheetStyle }} onClick={(e) => e.stopPropagation()}>
            <div ref={pickerHandleRef} className="hm-modal-handle-wrap" onMouseDown={pickerHandleMouseDown}>
              <div className="hm-modal-handle" />
            </div>
            <div className="hm-modal-header">
              <button className="hm-modal-close" onClick={closePicker} aria-label={t("spaces.cancel")}><X size={20} /></button>
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

              {lockedSpaces.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
                    {t("spaces.lockedSectionTitle")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {lockedSpaces.map((space) => (
                      <div
                        key={space.id}
                        title={t("spaces.lockedHint", { name: space.ownerName })}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: "var(--radius)",
                          border: "1px dashed var(--border)",
                          background: "var(--surface-alt)",
                          opacity: 0.65,
                          cursor: "not-allowed",
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 19, flexShrink: 0 }}>
                          {space.icon || "👤"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{space.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{space.ownerName}</div>
                        </div>
                        <Lock size={15} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canCreate && (
                <button
                  className="hm-btn hm-btn-soft hm-btn--full"
                  style={{ marginTop: 14 }}
                  onClick={() => { setShowPicker(false); setShowCreate(true); }}
                >
                  <Plus size={16} /> {t("spaces.addSharedSpace")}
                </button>
              )}
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
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
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
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("spaces.cancel")}><X size={20} /></button>
          <h3 className="hm-display hm-modal-title">{t("spaces.newSharedSpaceTitle")}</h3>
        </div>
        <div className="hm-modal-body">
          <label className="hm-label">{t("spaces.nameLabel")}</label>
          <input
            className="hm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("spaces.namePlaceholder")}
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
