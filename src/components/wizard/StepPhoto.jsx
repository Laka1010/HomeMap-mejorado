import { useRef, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { fileToBase64, getPhotoError } from "../../services/photoUtils.jsx";
import { useTranslation } from "../../i18n";

export function StepPhoto({ data, onChange, onNext }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileErr = getPhotoError(file);
    if (fileErr) {
      setError(t(fileErr));
      return;
    }

    try {
      setError("");
      setLoading(true);
      const base64 = await fileToBase64(file);
      onChange({ photo: base64 });
      onNext(); // Avanzar automáticamente al análisis
    } catch (err) {
      setError(t("wizard.stepPhotoError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepPhotoTitle")}</h2>

      <div className="wizard-options-grid">
        <button
          className="wizard-option-card hm-tap"
          onClick={() => cameraInputRef.current?.click()}
          disabled={loading}
        >
          <div className="wizard-option-icon">
            <Camera size={32} />
          </div>
          <span className="wizard-option-label">{t("wizard.stepPhotoTakePhoto")}</span>
        </button>

        <button
          className="wizard-option-card hm-tap"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          <div className="wizard-option-icon">
            <ImageIcon size={32} />
          </div>
          <span className="wizard-option-label">{t("wizard.stepPhotoChooseImage")}</span>
        </button>

        <button
          className="wizard-option-card wizard-option-skip hm-tap"
          onClick={() => {
            onChange({ photo: null });
            onNext();
          }}
          disabled={loading}
        >
          <span className="wizard-option-label">{t("wizard.stepPhotoSkip")}</span>
          <span className="wizard-option-sublabel">{t("wizard.stepPhotoSkipHint")}</span>
        </button>
      </div>

      {loading && <div style={{ marginTop: 18, color: "var(--ink-soft)" }}>{t("wizard.stepPhotoProcessing")}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: "var(--danger)", fontWeight: 600 }}>{error}</div>}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
      />

      <style>{`
        .wizard-options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
          max-width: 480px;
        }
        .wizard-option-card {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: 20px;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--ink);
        }
        .wizard-option-card[disabled] { opacity: 0.6; cursor: not-allowed; }
        .wizard-option-card:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .wizard-option-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }
        .wizard-option-label {
          font-weight: 700;
          font-size: 16px;
        }
        .wizard-option-skip {
          grid-column: span 2;
          padding: 20px;
          border-style: dashed;
        }
        .wizard-option-sublabel {
          font-size: 13px;
          color: var(--ink-soft);
          font-weight: 400;
        }
      `}</style>
    </div>
  );
}
