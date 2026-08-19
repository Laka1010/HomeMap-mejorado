import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../../utils/portalTarget";
import { Camera, Image as ImageIcon, X, Check, Plus, Trash2, Calendar, Store as StoreIcon, Receipt } from "lucide-react";
import { getPhotoError } from "../../services/photoUtils.jsx";
import {
  extractReceipt, matchKnownProduct, normalizeStoreName,
  RECEIPT_SCAN_STEPS, KNOWN_STORES,
} from "../../services/receiptService";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeTotal(items, taxAmount, discountAmount) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  return round2(subtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0));
}

/**
 * Escaneo de ticket con IA: capturar -> analizar (con checklist animado y
 * cancelación) -> revisar/editar -> guardar. Nunca guarda nada sin que el
 * usuario confirme la pantalla de revisión. onSave recibe los datos ya
 * corregidos por el usuario; el padre (ShoppingModule/App.jsx) se encarga
 * de subir la imagen y persistir — este componente no toca Supabase.
 */
export function ReceiptScanModal({ onClose, onSave, knownProductNames = [] }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const STEP_LABELS = {
    store: t("receiptScan.stepStore"),
    items: t("receiptScan.stepItems"),
    amount: t("receiptScan.stepAmount"),
    summary: t("receiptScan.stepSummary"),
  };
  const [stage, setStage] = useState("capture"); // capture | analyzing | review
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelledRef = useRef(false);

  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState([]);
  const [taxAmount, setTaxAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [totalOverride, setTotalOverride] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const total = totalOverride ?? computeTotal(items, taxAmount, discountAmount);

  const startAnalysis = async (file) => {
    const photoError = getPhotoError(file);
    if (photoError) {
      setError(t(photoError));
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setCompletedSteps([]);
    setStage("analyzing");
    cancelledRef.current = false;

    try {
      const result = await extractReceipt(file, {
        onProgress: (step) => setCompletedSteps((prev) => [...prev, step]),
        isCancelled: () => cancelledRef.current,
      });
      if (cancelledRef.current || !result) return;

      setStore(normalizeStoreName(result.store));
      setDate(result.date || toLocalDateString(new Date()));
      setItems(result.items.map((it) => ({ ...it, id: Math.random().toString(36).slice(2, 9) })));
      setTaxAmount(result.taxAmount ?? "");
      setDiscountAmount(result.discountAmount ?? "");
      setTotalOverride(null);
      setStage("review");
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Error analizando el ticket:", err);
      setError(t("receiptScan.analyzeError"));
      setStage("capture");
    }
  };

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) startAnalysis(file);
  };

  const cancelAnalysis = () => {
    cancelledRef.current = true;
    onClose();
  };

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setTotalOverride(null);
  };
  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotalOverride(null);
  };
  const addItem = () => {
    setItems((prev) => [...prev, { id: Math.random().toString(36).slice(2, 9), name: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        store: store.trim() || "Ticket",
        date,
        items: items
          .filter((item) => item.name.trim())
          .map(({ id, ...rest }) => ({ ...rest, totalPrice: round2((Number(rest.quantity) || 0) * (Number(rest.unitPrice) || 0)) })),
        taxAmount: taxAmount === "" ? null : Number(taxAmount),
        discountAmount: discountAmount === "" ? null : Number(discountAmount),
        total,
        imageFile,
      });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("receiptScan.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={18} style={{ color: "var(--accent)" }} /> {t("receiptScan.title")}
          </div>
        </div>
      </div>

      <div className="hm-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column" }}>
        {stage === "capture" && (
          <div style={{ flex: 1, minHeight: 320, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <Receipt size={40} style={{ color: "var(--accent)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t("receiptScan.captureTitle")}</div>
              <div style={{ color: "var(--ink-soft)", fontSize: 13, maxWidth: 320 }}>{t("receiptScan.captureSubtitle")}</div>
            </div>
            {error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="hm-btn hm-btn-primary" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={16} /> {t("receiptScan.takePhoto")}
              </button>
              <button className="hm-btn hm-btn-soft" onClick={() => galleryInputRef.current?.click()}>
                <ImageIcon size={16} /> {t("receiptScan.chooseFromGallery")}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              {RECEIPT_SCAN_STEPS.map((step) => {
                const done = completedSteps.includes(step);
                const isNext = !done && completedSteps.length === RECEIPT_SCAN_STEPS.indexOf(step);
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, opacity: done || isNext ? 1 : 0.4 }}>
                    {done ? (
                      <Check size={16} style={{ color: "var(--success)" }} />
                    ) : (
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: isNext ? "var(--accent)" : "var(--border)", animation: isNext ? "hmSpin 0.9s linear infinite" : "none" }} />
                    )}
                    <span style={{ fontSize: 14, fontWeight: done ? 600 : 500 }}>{STEP_LABELS[step]}</span>
                  </div>
                );
              })}
            </div>
            <button className="hm-btn hm-btn-ghost" onClick={cancelAnalysis}>{t("receiptScan.cancel")}</button>
          </div>
        )}

        {stage === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640, margin: "0 auto" }}>
            {imagePreviewUrl && (
              <div style={{ width: "100%", maxHeight: 160, borderRadius: 16, overflow: "hidden", background: "var(--surface-alt)" }}>
                <img src={imagePreviewUrl} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label className="hm-label"><StoreIcon size={12} style={{ verticalAlign: -1 }} /> {t("receiptScan.storeLabel")}</label>
                <input className="hm-input" list="known-stores" value={store} onChange={(e) => setStore(e.target.value)} placeholder={t("receiptScan.storePlaceholder")} />
                <datalist id="known-stores">
                  {KNOWN_STORES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label className="hm-label"><Calendar size={12} style={{ verticalAlign: -1 }} /> {t("receiptScan.dateLabel")}</label>
                <input className="hm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="hm-label" style={{ margin: 0 }}>{t("receiptScan.productsLabel")}</label>
                <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={addItem}><Plus size={13} /> {t("receiptScan.addProduct")}</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => {
                  const known = matchKnownProduct(item.name, knownProductNames);
                  return (
                    <div key={item.id} className="hm-card-flat" style={{ padding: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ flex: "2 1 140px", minWidth: 120 }}>
                        <input
                          className="hm-input"
                          style={{ height: 38 }}
                          value={item.name}
                          onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          placeholder={t("receiptScan.productNamePlaceholder")}
                        />
                        {known ? <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>✓ {t("receiptScan.knownProduct")}</div> : null}
                      </div>
                      <input
                        className="hm-input" type="number" min="1" style={{ width: 64, height: 38 }}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                        title={t("receiptScan.quantityTitle")}
                      />
                      <input
                        className="hm-input" type="number" step="0.01" style={{ width: 84, height: 38 }}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })}
                        title={t("receiptScan.unitPriceTitle")}
                      />
                      <div className="hm-mono" style={{ width: 64, textAlign: "right", fontSize: 13, fontWeight: 700 }}>
                        {formatCurrency(round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)))}
                      </div>
                      <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => removeItem(item.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
                {items.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", padding: 10 }}>{t("receiptScan.noProductsDetected")}</div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="hm-label">{t("receiptScan.taxLabel")}</label>
                <input className="hm-input" type="number" step="0.01" value={taxAmount} onChange={(e) => { setTaxAmount(e.target.value); setTotalOverride(null); }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="hm-label">{t("receiptScan.discountLabel")}</label>
                <input className="hm-input" type="number" step="0.01" value={discountAmount} onChange={(e) => { setDiscountAmount(e.target.value); setTotalOverride(null); }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="hm-label">{t("receiptScan.totalLabel")}</label>
                <input className="hm-input" type="number" step="0.01" value={total} onChange={(e) => setTotalOverride(e.target.value === "" ? 0 : Number(e.target.value))} style={{ fontWeight: 700 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {stage === "review" && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button className="hm-btn hm-btn-soft hm-btn--full" style={{ flex: 1 }} onClick={onClose} disabled={saving}>{t("receiptScan.cancel")}</button>
          <button className="hm-btn hm-btn-primary hm-btn--full" style={{ flex: 2 }} onClick={handleSave} disabled={saving || !store.trim()}>
            {saving ? t("receiptScan.saving") : t("receiptScan.save")}
          </button>
        </div>
      )}
    </div>,
    getPortalTarget()
  );
}
