import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

// Importación de pasos
import { StepName } from "./wizard/StepName";
import { StepCategory } from "./wizard/StepCategory";
import { StepLocation } from "./wizard/StepLocation";
import { StepDetails } from "./wizard/StepDetails";
import { StepSummary } from "./wizard/StepSummary";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { toLocalDateString } from "../utils/dates";

export function AddObjectWizard({ state, onClose, onSave, defaults = {} }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  // Si ya estamos dentro de una habitación/zona/caja, no hace falta preguntar dónde está.
  const hasLocationContext = Boolean(defaults.roomId);
  const [STEPS] = useState(() => {
    const s = ["name", "category"];
    if (!hasLocationContext) s.push("location");
    s.push("details", "summary");
    return s;
  });
  const [stepIndex, setStepIndex] = useState(0);
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

  const TOTAL_STEPS = STEPS.length;
  const currentStep = STEPS[stepIndex];

  const updateData = (updates) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep === "name" && !data.name.trim()) return;

    setDirection("next");
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const prevStep = () => {
    setDirection("back");
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSave = () => {
    const newObject = {
      id: "o-" + Math.random().toString(36).slice(2, 10),
      ...data,
      createdAt: toLocalDateString(new Date()),
      locationHistory: [],
    };
    onSave(newObject);
    onClose();
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        {/* Barra de progreso superior */}
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${((stepIndex + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <X size={20} />
          </button>
          <div className="wizard-step-counter">
            {t("wizard.stepCounter", { step: stepIndex + 1, total: TOTAL_STEPS })}
          </div>
        </div>

        <div className={`wizard-body transition-${direction}`}>
          <div className="wizard-content-wrapper" key={stepIndex}>
            {currentStep === "name" && <StepName data={data} onChange={updateData} onNext={nextStep} />}
            {currentStep === "category" && <StepCategory data={data} onChange={updateData} categories={state.categories} onNext={nextStep} />}
            {currentStep === "location" && <StepLocation data={data} onChange={updateData} state={state} onNext={nextStep} />}
            {currentStep === "details" && <StepDetails data={data} onChange={updateData} />}
            {currentStep === "summary" && <StepSummary data={data} state={state} />}
          </div>
        </div>

        <div className="wizard-footer">
          {stepIndex > 0 && (
            <button className="hm-btn hm-btn-soft" onClick={prevStep}>
              <ChevronLeft size={18} /> {t("wizard.back")}
            </button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>
              {t("wizard.cancel")}
            </button>

            {currentStep === "summary" ? (
              <button className="hm-btn hm-btn-primary" onClick={handleSave}>
                <Check size={18} /> {t("wizard.saveObjectButton")}
              </button>
            ) : currentStep === "details" ? (
              <button className="hm-btn hm-btn-primary" onClick={nextStep}>
                {t("wizard.reviewSummaryButton")} <ChevronRight size={18} />
              </button>
            ) : (
              <button
                className="hm-btn hm-btn-primary"
                onClick={nextStep}
                disabled={currentStep === "name" && !data.name.trim()}
              >
                {t("wizard.next")} <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
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
          animation: hmSheetIn .32s cubic-bezier(.22,1,.36,1) backwards;
        }
        @media (prefers-reduced-motion: reduce) { .wizard-modal { animation: none !important; } }
        .wizard-progress-bar {
          height: 6px;
          background: var(--surface-alt);
          width: 100%;
          flex-shrink: 0;
        }
        .wizard-progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .wizard-step-counter {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* La barra de progreso va entre el asa y la cabecera, así que bajamos la
           cruz para que no quede pisándola. */
        .wizard-modal .hm-modal-header { padding-top: 16px; }
        .wizard-modal .hm-modal-close { top: 14px; }
        .wizard-body {
          padding: 20px 32px 40px;
          flex: 1;
          overflow-y: auto;
          overscroll-behavior-y: contain;
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
