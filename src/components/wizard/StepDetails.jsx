import { useState } from "react";
import { Euro, Calendar, FileText } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";

export function StepDetails({ data, onChange }) {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [priceError, setPriceError] = useState("");

  const handlePriceChange = (e) => {
    const val = e.target.value;
    // Allow comma or dot decimals; normalize to dot
    const normalized = val.replace(/,/g, '.');
    // Basic validation: must be a number or empty
    if (normalized === "" || /^\d*(?:\.\d{0,2})?$/.test(normalized)) {
      setPriceError("");
      onChange({ price: normalized });
    } else {
      setPriceError(t("wizard.stepDetailsPriceError"));
    }
  };

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepDetailsTitle")}</h2>
      <p className="wizard-subtitle">{t("wizard.stepDetailsSubtitle")}</p>

      <div className="details-form">
        <div className="detail-field">
          <label className="hm-label"><Euro size={12} /> {t("wizard.stepDetailsPriceLabel")}</label>
          <div className="detail-input-wrapper">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="hm-input"
              placeholder="0.00"
              value={data.price}
              onChange={handlePriceChange}
              aria-invalid={!!priceError}
            />
            <span className="input-suffix">{currencySymbol}</span>
          </div>
          {priceError && <div role="alert" style={{ color: 'var(--danger)', marginTop: 6 }}>{priceError}</div>}
        </div>

        <div className="detail-field">
          <label className="hm-label"><Calendar size={12} /> {t("wizard.stepDetailsPurchaseDateLabel")}</label>
          <input
            type="date"
            className="hm-input"
            value={data.purchaseDate}
            onChange={(e) => onChange({ purchaseDate: e.target.value })}
          />
        </div>

        <div className="detail-field">
          <label className="hm-label"><FileText size={12} /> {t("wizard.stepDetailsNotesLabel")}</label>
          <textarea
            className="hm-input detail-textarea"
            placeholder={t("wizard.stepDetailsNotesPlaceholder")}
            value={data.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      <style>{`
        .details-form {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
        }
        .detail-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .detail-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-suffix {
          position: absolute;
          right: 14px;
          color: var(--ink-soft);
          font-weight: 600;
        }
        .detail-textarea {
          resize: none;
        }
      `}</style>
    </div>
  );
}
