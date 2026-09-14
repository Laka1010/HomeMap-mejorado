import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { X, Sparkles, Check, Info } from "lucide-react";
import { getPortalTarget } from "../../utils/portalTarget";
import { useTranslation } from "../../i18n";
import { revenuecatService } from "../../services/revenuecatService";
import { premiumService } from "../../services/premiumService";

// Cuántas veces (cada 1s) se re-consulta subscription_status tras una
// compra antes de rendirse y cerrar igualmente -- el webhook de RevenueCat
// no es instantáneo, pero suele tardar bien poco.
const STATUS_POLL_ATTEMPTS = 6;
const STATUS_POLL_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pantalla de compra real de Haven Premium (Monthly/Yearly). Pantalla
 * propia en React, no el Paywall nativo de RevenueCat -- ese no funciona
 * dentro del WebView de Capacitor tal como lo expone el SDK. El SDK aquí
 * solo inicia la compra; quien de verdad marca al usuario como Premium es
 * el webhook de RevenueCat escribiendo en Supabase (revenuecat-webhook),
 * así que tras una compra esta pantalla espera un poco a que
 * subscription_status se actualice en vez de fiarse de lo que devuelve el
 * propio SDK.
 */
export function PremiumPaywall({ onClose, onActivateInternalTrial, onSubscriptionUpdated, showNotice }) {
  const { t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  const [offering, setOffering] = useState(null);
  const [loadingOfferings, setLoadingOfferings] = useState(isNative);
  const [purchasingId, setPurchasingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    revenuecatService.getOfferings()
      .then((current) => { if (!cancelled) setOffering(current); })
      .catch((err) => { if (!cancelled) setError(err?.message || t("paywall.loadError")); })
      .finally(() => { if (!cancelled) setLoadingOfferings(false); });
    return () => { cancelled = true; };
  }, [isNative, t]);

  const waitForRealStatus = async () => {
    for (let i = 0; i < STATUS_POLL_ATTEMPTS; i++) {
      await sleep(STATUS_POLL_DELAY_MS);
      try {
        const status = await premiumService.getMySubscriptionStatus();
        if (status === "premium") {
          onSubscriptionUpdated(status);
          return true;
        }
      } catch {
        // Se sigue intentando hasta agotar los intentos.
      }
    }
    return false;
  };

  const handlePurchase = async (pkg) => {
    if (!consentChecked) return;
    setError("");
    setPurchasingId(pkg.identifier);
    try {
      await revenuecatService.purchasePackage(pkg);
      showNotice(t("paywall.purchaseProcessing"));
      const confirmed = await waitForRealStatus();
      showNotice(t(confirmed ? "paywall.purchaseSuccess" : "paywall.purchaseDelayed"));
      onClose();
    } catch (err) {
      if (err?.userCancelled) return;
      console.error("Error comprando en RevenueCat:", err);
      setError(err?.message || t("paywall.purchaseError"));
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    setError("");
    setRestoring(true);
    try {
      await revenuecatService.restorePurchases();
      const confirmed = await waitForRealStatus();
      showNotice(t(confirmed ? "paywall.restoreSuccess" : "paywall.restoreNothingFound"));
      if (confirmed) onClose();
    } catch (err) {
      console.error("Error restaurando compras:", err);
      setError(err?.message || t("paywall.restoreError"));
    } finally {
      setRestoring(false);
    }
  };

  const packages = offering?.availablePackages || [];

  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("paywall.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} style={{ color: "var(--accent)" }} /> {t("paywall.title")}
          </div>
        </div>
      </div>

      <div className="hm-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--ink-soft)", textAlign: "center" }}>{t("paywall.subtitle")}</p>

        <div className="hm-card hm-card--p20" style={{ maxWidth: 440, margin: "0 auto 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            <Info size={14} style={{ color: "var(--accent)" }} /> {t("paywall.infoTitle")}
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>{t("paywall.infoLimitsLine")}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>{t("paywall.infoRenewalLine")}</p>
        </div>

        {!isNative && (
          <div className="hm-card hm-card--p20" style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{t("paywall.webOnlyNotice")}</p>
          </div>
        )}

        {isNative && loadingOfferings && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--ink-soft)", fontSize: 13.5 }}>{t("paywall.loading")}</div>
        )}

        {isNative && !loadingOfferings && packages.length === 0 && (
          <div className="hm-card hm-card--p20" style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{t("paywall.noOfferings")}</p>
          </div>
        )}

        {error ? <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div> : null}

        {isNative && !loadingOfferings && packages.length > 0 && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: 440, margin: "0 auto 16px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span>
              {t("paywall.consentPart1")}
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{t("ajustes.terms")}</a>
              {t("paywall.consentPart2")}
              <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{t("ajustes.privacyPolicy")}</a>
              {t("paywall.consentPart3")}
            </span>
          </label>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 440, margin: "0 auto" }}>
          {packages.map((pkg) => (
            <div key={pkg.identifier} className="hm-card hm-card--p20" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{pkg.product.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{pkg.product.priceString}</div>
              </div>
              <button
                className="hm-btn hm-btn-primary hm-btn--compact"
                onClick={() => handlePurchase(pkg)}
                disabled={purchasingId != null || restoring || !consentChecked}
              >
                {purchasingId === pkg.identifier ? t("paywall.purchasing") : t("paywall.purchaseButton")}
              </button>
            </div>
          ))}
        </div>

        {isNative && (
          <button
            className="hm-btn hm-btn-ghost hm-btn--compact"
            style={{ display: "flex", margin: "16px auto 0" }}
            onClick={handleRestore}
            disabled={purchasingId != null || restoring}
          >
            <Check size={13} /> {restoring ? t("paywall.restoring") : t("paywall.restorePurchases")}
          </button>
        )}

        <button
          className="hm-btn hm-btn-ghost hm-btn--compact"
          style={{ display: "flex", margin: "24px auto 0", fontSize: 12.5, color: "var(--ink-soft)" }}
          onClick={onActivateInternalTrial}
        >
          {t("paywall.tryInternalTrial")}
        </button>
      </div>
    </div>,
    getPortalTarget()
  );
}
