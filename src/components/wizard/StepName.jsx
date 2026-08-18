import { useState } from "react";
import { useTranslation } from "../../i18n";

export function StepName({ data, onChange, onNext }) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      setTouched(true);
      if (data.name && data.name.trim()) onNext();
    }
  };

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepNameTitle")}</h2>
      <div className="wizard-input-wrapper">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          aria-required="true"
          aria-invalid={touched && !data.name.trim()}
          className="hm-input wizard-big-input"
          placeholder={t("wizard.stepNamePlaceholder")}
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={() => setTouched(true)}
          onKeyDown={handleKeyDown}
        />
        {touched && !data.name.trim() ? (
          <div style={{ marginTop: 10, color: "var(--danger)", fontSize: 13 }} role="alert">{t("wizard.stepNameError")}</div>
        ) : (
          <p className="wizard-hint">{t("wizard.pressEnterHint")}</p>
        )}
      </div>

      <style>{`
        .wizard-step-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: slideIn 0.4s ease-out;
        }
        .wizard-title {
          font-size: 32px;
          margin-bottom: 40px;
          font-weight: 700;
        }
        .wizard-input-wrapper {
          width: 100%;
          max-width: 440px;
        }
        .wizard-big-input {
          font-size: 20px !important;
          padding: 16px 20px !important;
          border-radius: 16px !important;
          text-align: center;
          border: 2px solid var(--border) !important;
          transition: border-color 0.2s ease;
        }
        .wizard-big-input:focus {
          border-color: var(--accent) !important;
        }
        .wizard-hint {
          margin-top: 16px;
          font-size: 13px;
          color: var(--ink-soft);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
