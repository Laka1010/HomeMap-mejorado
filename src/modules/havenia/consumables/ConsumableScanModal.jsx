import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../../../utils/portalTarget";
import { Camera, Image as ImageIcon, X, Trash2, Package, Plus } from "lucide-react";
import { getPhotoError } from "../../../services/photoUtils.jsx";
import { analyzeConsumablePhoto } from "../../../services/ai/visionService";
import { buildConsumableCandidatesFromVisionResult, validateConsumableCandidate } from "../../../services/ai/consumablesAiService";
import { useTranslation } from "../../../i18n";

/**
 * Escaneo de consumibles con IA: capturar (una o varias fotos) -> analizar
 * -> revisar/editar/eliminar -> guardar. Mismo esqueleto que
 * ReceiptScanModal.jsx (capture/analyzing/review) pero acumulando
 * candidatos entre fotos en vez de sustituirlos, porque aquí sí tiene
 * sentido escanear varios productos en tandas sucesivas. Nunca llama a
 * Supabase directamente -- onSave recibe solo los candidatos seleccionados
 * y ya editados por el usuario; el padre decide cómo persistirlos
 * (consumablesService.createConsumable, reutilizado tal cual).
 */
export function ConsumableScanModal({ onClose, onSave, isPremium, onRequirePremium, defaults = {}, initialCandidates = null }) {
  const { t } = useTranslation();
  // initialCandidates viene del escaneo de tickets (Fase 4: "¿quieres
  // actualizar tu inventario con estos productos?") -- en ese caso se salta
  // la captura de foto y se entra directo a revisar/editar/confirmar.
  const [stage, setStage] = useState(initialCandidates ? "review" : "capture"); // capture | analyzing | review
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [candidates, setCandidates] = useState(initialCandidates || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Defensa en profundidad: aunque el hub de Haven IA ya filtra antes de
  // abrir este modal, la entrada alternativa desde el botón manual de
  // MiCasa no repite ese chequeo -- así que el gate real vive aquí, el
  // único sitio por el que pasan todas las vías de entrada. Los hooks van
  // TODOS antes de este return condicional (regla de los hooks).
  useEffect(() => {
    if (!isPremium) onRequirePremium();
  }, [isPremium, onRequirePremium]);
  if (!isPremium) return null;

  const startAnalysis = async (file) => {
    const photoError = getPhotoError(file);
    if (photoError) {
      setError(t(photoError));
      return;
    }
    setError("");
    setImagePreviewUrl(URL.createObjectURL(file));
    setStage("analyzing");

    try {
      const rawResult = await analyzeConsumablePhoto(file);
      const newCandidates = buildConsumableCandidatesFromVisionResult(rawResult);
      setCandidates((prev) => [...prev, ...newCandidates]);
      setStage("review");
    } catch (err) {
      console.error("Error analizando la foto de consumibles:", err);
      // err.message ya viene desglosado por aiService.callVisionProxy (clave
      // no configurada, cuota, proveedor caído...) -- mostrarlo en vez del
      // genérico ayuda a diagnosticar sin tener que abrir la consola.
      setError(err?.message ? `${t("consumableScan.analyzeError")} (${err.message})` : t("consumableScan.analyzeError"));
      setStage(candidates.length > 0 ? "review" : "capture");
    }
  };

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) startAnalysis(file);
  };

  const updateCandidate = (id, patch) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeCandidate = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const selectedCandidates = candidates.filter((c) => c.selected);
  const hasInvalidSelection = selectedCandidates.some((c) => validateConsumableCandidate(c) !== null);

  const handleSaveAll = async () => {
    if (selectedCandidates.length === 0 || hasInvalidSelection) return;
    setSaving(true);
    try {
      await onSave(selectedCandidates.map((c) => ({
        ...c,
        roomId: defaults.roomId ?? null,
        zoneId: defaults.zoneId ?? null,
        containerId: defaults.containerId ?? null,
      })));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("consumableScan.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Package size={18} style={{ color: "var(--accent)" }} /> {t("consumableScan.title")}
          </div>
        </div>
      </div>

      <div className="hm-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column" }}>
        {stage === "capture" && (
          <div style={{ flex: 1, minHeight: 320, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <Package size={40} style={{ color: "var(--accent)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t("consumableScan.captureTitle")}</div>
              <div style={{ color: "var(--ink-soft)", fontSize: 13, maxWidth: 320 }}>{t("consumableScan.captureSubtitle")}</div>
            </div>
            {error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="hm-btn hm-btn-primary" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={16} /> {t("consumableScan.takePhoto")}
              </button>
              <button className="hm-btn hm-btn-soft" onClick={() => galleryInputRef.current?.click()}>
                <ImageIcon size={16} /> {t("consumableScan.chooseFromGallery")}
              </button>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChosen} />
            <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChosen} />
          </div>
        )}

        {stage === "analyzing" && (
          <div style={{ flex: 1, minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, textAlign: "center" }}>
            {imagePreviewUrl && (
              <div style={{ width: 140, height: 140, borderRadius: 16, overflow: "hidden", background: "var(--surface-alt)" }}>
                <img src={imagePreviewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
              </div>
            )}
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--accent-soft)", borderTopColor: "var(--accent)", animation: "hmSpin 0.9s linear infinite" }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("consumableScan.analyzing")}</div>
          </div>
        )}

        {stage === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640, margin: "0 auto", width: "100%" }}>
            {error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div> : null}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="hm-label" style={{ margin: 0 }}>{t("consumableScan.reviewTitle")}</label>
              <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setStage("capture")}>
                <Plus size={13} /> {t("consumableScan.addAnotherPhoto")}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {candidates.map((c) => (
                <div key={c.id} className="hm-card-flat" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={(e) => updateCandidate(c.id, { selected: e.target.checked })}
                    />
                    <input
                      className="hm-input"
                      style={{ height: 38, flex: "2 1 140px" }}
                      value={c.name}
                      onChange={(e) => updateCandidate(c.id, { name: e.target.value })}
                      placeholder={t("consumableScan.nameLabel")}
                    />
                    <input
                      className="hm-input"
                      style={{ height: 38, flex: "1 1 100px" }}
                      value={c.brand || ""}
                      onChange={(e) => updateCandidate(c.id, { brand: e.target.value })}
                      placeholder={t("consumableScan.brandLabel")}
                    />
                    <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => removeCandidate(c.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      className="hm-input"
                      style={{ height: 34, flex: "1 1 120px" }}
                      value={c.category || ""}
                      onChange={(e) => updateCandidate(c.id, { category: e.target.value })}
                      placeholder={t("consumableScan.categoryLabel")}
                    />
                    <input
                      className="hm-input"
                      type="number"
                      style={{ height: 34, width: 90 }}
                      value={c.currentQuantity ?? ""}
                      onChange={(e) => updateCandidate(c.id, { currentQuantity: e.target.value === "" ? null : Number(e.target.value) })}
                      title={t("consumableScan.quantityLabel")}
                    />
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                      {c.unit === "units" ? t("consumableScan.unitUnits") : t("consumableScan.unitPercent")}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-soft)" }}>
                      <input
                        type="checkbox"
                        checked={c.isConsumable}
                        onChange={(e) => updateCandidate(c.id, { isConsumable: e.target.checked })}
                      />
                      {t("consumableScan.isConsumableLabel")}
                    </label>
                    {c.nearlyEmpty && <span className="hm-badge hm-badge--danger" style={{ fontSize: 10 }}>{t("consumableScan.nearlyEmptyBadge")}</span>}
                    {c.shouldRestock && <span className="hm-badge hm-badge--accent" style={{ fontSize: 10 }}>{t("consumableScan.shouldRestockBadge")}</span>}
                  </div>
                </div>
              ))}
              {candidates.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", padding: 10 }}>{t("consumableScan.noProductsDetected")}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {stage === "review" && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedCandidates.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>{t("consumableScan.noneSelected")}</div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="hm-btn hm-btn-soft hm-btn--full" style={{ flex: 1 }} onClick={onClose} disabled={saving}>{t("consumableScan.cancel")}</button>
            <button
              className="hm-btn hm-btn-primary hm-btn--full"
              style={{ flex: 2 }}
              onClick={handleSaveAll}
              disabled={saving || selectedCandidates.length === 0 || hasInvalidSelection}
            >
              {saving ? t("consumableScan.saving") : t("consumableScan.saveSelected", { count: selectedCandidates.length })}
            </button>
          </div>
        </div>
      )}
    </div>,
    getPortalTarget()
  );
}
