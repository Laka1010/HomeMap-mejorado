import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../../../utils/portalTarget";
import { Camera, Image as ImageIcon, X, Check, Plus, Trash2, Calendar, Store as StoreIcon, Receipt } from "lucide-react";
import { getPhotoError } from "../../../services/photoUtils.jsx";
import {
  extractReceipt, matchKnownProduct, normalizeStoreName,
  RECEIPT_SCAN_STEPS, KNOWN_STORES,
} from "../../../services/ai/receiptService";
import { CategoryField } from "../../economy/CategoryField";
import { useEconomyCategories } from "../../economy/EconomyCategoriesContext";
import { DEFAULT_CATEGORY } from "../../economy/economyCategories";
import { useTranslation } from "../../../i18n";
import { useCurrency } from "../../../currency";
import { toLocalDateString } from "../../../utils/dates";
import { premiumService } from "../../../services/premiumService";

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// El IVA en un ticket español ya va incluido en el precio de cada línea (no
// se añade aparte como un sales tax americano) -- taxAmount es solo la cuota
// informativa que el ticket desglosa, así que NUNCA se suma al total. Sumarlo
// duplicaba el impuesto (ver bug: ticket de 14,11 € calculado como 15,56 €).
function computeTotal(items, discountAmount) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  return round2(subtotal - (Number(discountAmount) || 0));
}

/**
 * Escáner de tickets STANDALONE de Haven IA (secciones 4/5 del pedido):
 * mismo esqueleto capturar -> analizar -> revisar que ReceiptScanModal.jsx,
 * pero sin depender de una compra de lista de la compra en curso -- se
 * puede abrir desde el hub de Haven IA en cualquier momento. Añade un
 * selector de categoría (ReceiptScanModal no lo tiene, porque allí la
 * categoría viene de la lista) y dos acciones explícitas de guardado en vez
 * de una sola: "Guardar como gasto" registra el ticket en Economía además
 * de guardarlo; "Solo guardar como ticket" no toca Economía. onSave recibe
 * `saveAsExpense` para que el padre (App.jsx) decida cuál de las dos rutas
 * seguir -- este componente no toca Supabase.
 */
export function TicketScanModal({ onClose, onSave, knownProductNames = [], isPremium, onRequirePremium }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const { expense: expenseCategories } = useEconomyCategories();
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
  const [usage, setUsage] = useState(null);
  const cancelledRef = useRef(false);

  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [taxAmount, setTaxAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [totalOverride, setTotalOverride] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const total = totalOverride ?? computeTotal(items, discountAmount);

  // Defensa en profundidad, mismo motivo que ConsumableScanModal: el hub ya
  // filtra antes de abrir, pero el gate real vive aquí.
  useEffect(() => {
    if (!isPremium) onRequirePremium();
  }, [isPremium, onRequirePremium]);

  // Solo para avisar con antelación del límite mensual -- el bloqueo real lo
  // hace siempre vision-proxy en el servidor antes de llamar al proveedor.
  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;
    premiumService.getPremiumUsage("receipt_scanner").then((data) => { if (!cancelled) setUsage(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isPremium]);

  const limitReached = usage != null && !usage.allowed;

  const startAnalysis = async (file) => {
    if (limitReached) return;
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
      premiumService.getPremiumUsage("receipt_scanner").then(setUsage).catch(() => {});
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Error analizando el ticket:", err);
      setError(err?.message ? `${t("receiptScan.analyzeError")} (${err.message})` : t("receiptScan.analyzeError"));
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

  const handleSave = async (saveAsExpense) => {
    setSaving(true);
    try {
      await onSave({
        store: store.trim() || "Ticket",
        date,
        items: items
          .filter((item) => item.name.trim())
          .map(({ id, ...rest }) => ({ ...rest, totalPrice: round2((Number(rest.quantity) || 0) * (Number(rest.unitPrice) || 0)) })),
        category,
        taxAmount: taxAmount === "" ? null : Number(taxAmount),
        discountAmount: discountAmount === "" ? null : Number(discountAmount),
        total,
        imageFile,
        saveAsExpense,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isPremium) return null;

  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("receiptScan.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={18} style={{ color: "var(--accent)" }} /> {t("ticketScanner.title")}
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
            {limitReached ? (
              <div style={{ color: "var(--danger)", fontSize: 13 }}>{t("havenIA.usage.limitReached")}</div>
            ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="hm-btn hm-btn-primary" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={16} /> {t("receiptScan.takePhoto")}
              </button>
              <button className="hm-btn hm-btn-soft" onClick={() => galleryInputRef.current?.click()}>
                <ImageIcon size={16} /> {t("receiptScan.chooseFromGallery")}
              </button>
            </div>
            )}
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
                <input className="hm-input" list="known-stores-ticket" value={store} onChange={(e) => setStore(e.target.value)} placeholder={t("receiptScan.storePlaceholder")} />
                <datalist id="known-stores-ticket">
                  {KNOWN_STORES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label className="hm-label"><Calendar size={12} style={{ verticalAlign: -1 }} /> {t("receiptScan.dateLabel")}</label>
                <input className="hm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="hm-label">{t("ticketScanner.categoryLabel")}</label>
              <CategoryField categories={expenseCategories} value={category} onChange={setCategory} title={t("ticketScanner.categoryLabel")} />
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
                <label className="hm-label">{t("receiptScan.totalLabel")}</label>
                <input className="hm-input" type="number" step="0.01" value={total} onChange={(e) => setTotalOverride(e.target.value === "" ? 0 : Number(e.target.value))} style={{ fontWeight: 700 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {stage === "review" && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="hm-btn hm-btn-primary hm-btn--full" onClick={() => handleSave(true)} disabled={saving || !store.trim()}>
            {saving ? t("receiptScan.saving") : t("ticketScanner.saveAsExpense")}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="hm-btn hm-btn-soft hm-btn--full" style={{ flex: 1 }} onClick={onClose} disabled={saving}>{t("receiptScan.cancel")}</button>
            <button className="hm-btn hm-btn-soft hm-btn--full" style={{ flex: 1 }} onClick={() => handleSave(false)} disabled={saving || !store.trim()}>
              {t("ticketScanner.saveAsTicketOnly")}
            </button>
          </div>
        </div>
      )}
    </div>,
    getPortalTarget()
  );
}
