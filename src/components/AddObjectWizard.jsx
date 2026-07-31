import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

// Importación de pasos
import { StepName } from "./wizard/StepName";
import { StepPhoto } from "./wizard/StepPhoto";
import { StepAnalyze } from "./wizard/StepAnalyze";
import { StepCategory } from "./wizard/StepCategory";
import { StepLocation } from "./wizard/StepLocation";
import { StepDetails } from "./wizard/StepDetails";
import { StepSummary } from "./wizard/StepSummary";
import { useTranslation } from "../i18n";

export function AddObjectWizard({ state, onClose, onSave, defaults = {} }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("next"); // 'next' or 'back'
  const [data, setData] = useState({
    name: "",
    category: state.categories[0] || "Otros",
    photo: null,
    roomId: defaults.roomId || "",
    zoneId: defaults.zoneId || "",
    containerId: defaults.containerId || "",
    price: "",
    purchaseDate: "",
    notes: "",
  });

  const TOTAL_STEPS = 6;

  // El paso de análisis (2.5) es especial y condicional
  const isAIStep = step === 2.5;
  const currentProgress = isAIStep ? 2 : step;

  const updateData = (updates) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (step === 1 && !data.name.trim()) return;

    setDirection("next");
    if (step === 2 && data.photo) {
      setStep(2.5);
    } else if (step === 2.5) {
      setStep(3);
    } else if (step < TOTAL_STEPS) {
      setStep(Math.floor(step + 1));
    }
  };

  const prevStep = () => {
    setDirection("back");
    if (step === 2.5) {
      setStep(2);
    } else if (step > 1) {
      setStep(Math.floor(step - 1));
    }
  };

  const handleSave = () => {
    const newObject = {
      id: "o-" + Math.random().toString(36).slice(2, 10),
      ...data,
      createdAt: new Date().toISOString().slice(0, 10),
      locationHistory: [],
    };
    onSave(newObject);
    onClose();
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-handle" />
        {/* Barra de progreso superior */}
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${(currentProgress / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="wizard-header">
          <div className="wizard-step-counter">
            {isAIStep ? t("wizard.analyzingStep") : t("wizard.stepCounter", { step, total: TOTAL_STEPS })}
          </div>
          <button className="wizard-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={`wizard-body transition-${direction}`}>
          <div className="wizard-content-wrapper" key={step}>
            {step === 1 && <StepName data={data} onChange={updateData} onNext={nextStep} />}
            {step === 2 && <StepPhoto data={data} onChange={updateData} onNext={nextStep} />}
            {step === 2.5 && <StepAnalyze data={data} onChange={updateData} onNext={nextStep} />}
            {step === 3 && <StepCategory data={data} onChange={updateData} categories={state.categories} onNext={nextStep} />}
            {step === 4 && <StepLocation data={data} onChange={updateData} state={state} onNext={nextStep} />}
            {step === 5 && <StepDetails data={data} onChange={updateData} />}
            {step === 6 && <StepSummary data={data} state={state} />}
          </div>
        </div>

        <div className="wizard-footer">
          {step > 1 && (
            <button className="hm-btn hm-btn-soft" onClick={prevStep}>
              <ChevronLeft size={18} /> {t("wizard.back")}
            </button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>
              {t("wizard.cancel")}
            </button>

            {step === TOTAL_STEPS ? (
              <button className="hm-btn hm-btn-primary" onClick={handleSave}>
                <Check size={18} /> {t("wizard.saveObjectButton")}
              </button>
            ) : step === 5 ? (
              <button className="hm-btn hm-btn-primary" onClick={nextStep}>
                {t("wizard.reviewSummaryButton")} <ChevronRight size={18} />
              </button>
            ) : !isAIStep && step !== 2 && (
              <button
                className="hm-btn hm-btn-primary"
                onClick={nextStep}
                disabled={step === 1 && !data.name.trim()}
              >
                {t("wizard.next")} <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .wizard-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
          padding: 0;
        }
        .wizard-modal {
          background: var(--surface);
          width: 100%;
          max-width: 600px;
          max-height: 92vh;
          border-radius: 28px 28px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 -12px 40px rgba(0,0,0,0.18);
          position: relative;
          animation: wizardSheetIn .32s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes wizardSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .wizard-modal { animation: none !important; } }
        .wizard-handle { width: 42px; height: 5px; border-radius: 999px; background: var(--border); margin: 12px auto 0; flex-shrink: 0; }
        .wizard-progress-bar {
          height: 6px;
          background: var(--surface-alt);
          width: 100%;
          margin-top: 10px;
        }
        .wizard-progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .wizard-header {
          padding: 24px 32px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .wizard-step-counter {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .wizard-close-btn {
          background: var(--surface-alt);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--ink-soft);
          transition: all 0.2s ease;
        }
        .wizard-close-btn:hover {
          background: var(--danger-soft);
          color: var(--danger);
        }
        .wizard-body {
          padding: 20px 32px 40px;
          min-height: 420px;
          display: flex;
          flex-direction: column;
        }
        .wizard-content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .wizard-footer {
          padding: 20px 32px 32px;
          background: var(--surface-alt);
          display: flex;
          align-items: center;
        }
        /* Animaciones de transición */
        .transition-next .wizard-content-wrapper {
          animation: slideNext 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .transition-back .wizard-content-wrapper {
          animation: slideBack 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        @keyframes slideNext {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideBack {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 600px) {
          .wizard-body {
            padding: 20px 20px 30px;
          }
        }
      `}</style>
    </div>
  );
}
