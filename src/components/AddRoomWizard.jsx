import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Home, UtensilsCrossed, BedDouble, Bath, Archive, Car, Briefcase } from "lucide-react";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";

const ROOM_ICON_OPTIONS_BASE = [
  { key: "salon", emoji: "🏠", icon: Home },
  { key: "cocina", emoji: "🍳", icon: UtensilsCrossed },
  { key: "habitacion", emoji: "🛏️", icon: BedDouble },
  { key: "bano", emoji: "🚿", icon: Bath },
  { key: "trastero", emoji: "📦", icon: Archive },
  { key: "garaje", emoji: "🚗", icon: Car },
  { key: "oficina", emoji: "💼", icon: Briefcase },
];

export function AddRoomWizard({ onClose, onSave }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const ROOM_ICON_OPTIONS = ROOM_ICON_OPTIONS_BASE.map((opt) => ({ ...opt, label: t(`roomIcons.${opt.key}`) }));
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("next");
  const [data, setData] = useState({
    name: "",
    icon: "salon",
  });

  const TOTAL_STEPS = 3;

  const nextStep = () => {
    if (step === 1 && !data.name.trim()) return;
    setDirection("next");
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const prevStep = () => {
    setDirection("back");
    if (step > 1) setStep(step - 1);
  };

  const handleSave = () => {
    const newRoom = {
      id: "r-" + Math.random().toString(36).slice(2, 10),
      name: data.name.trim(),
      icon: data.icon,
      photo: null,
    };
    // onSave (addRoom en App.jsx) ya decide si cierra el modal o reabre el
    // wizard original que lo pidió (flujo __continueTo del dependencyGuard)
    // — cerrar aquí también pisaría esa reapertura.
    onSave(newRoom);
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button>
          <div className="wizard-step-counter">{t("wizard.stepCounter", { step, total: TOTAL_STEPS })}</div>
        </div>

        <div className={`wizard-body transition-${direction}`}>
          <div className="wizard-content-wrapper" key={step}>
            {step === 1 && (
              <div className="wizard-step-container">
                <h2 className="hm-display wizard-title">{t("wizard.addRoomNameTitle")}</h2>
                <div className="wizard-input-wrapper">
                  <input
                    type="text"
                    className="hm-input wizard-big-input"
                    placeholder={t("wizard.addRoomNamePlaceholder")}
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && data.name.trim() && nextStep()}
                  />
                  <p className="wizard-hint">{t("wizard.pressEnterHint")}</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-step-container">
                <h2 className="hm-display wizard-title">{t("wizard.addRoomIconTitle")}</h2>
                <div className="icon-grid">
                  {ROOM_ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      className={`icon-card hm-tap ${data.icon === opt.key ? "selected" : ""}`}
                      onClick={() => { setData({ ...data, icon: opt.key }); nextStep(); }}
                    >
                      <span className="icon-emoji">{opt.emoji}</span>
                      <span className="icon-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="wizard-step-container">
                <h2 className="hm-display wizard-title">{t("wizard.addRoomSummaryTitle")}</h2>
                <div className="summary-card">
                  <div className="summary-room-icon">
                    <span style={{ fontSize: 48 }}>
                      {ROOM_ICON_OPTIONS.find(o => o.key === data.icon)?.emoji}
                    </span>
                  </div>
                  <h3 className="summary-room-name">{data.name}</h3>
                  <p className="summary-room-sub">{t("wizard.addRoomSummaryHint")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="wizard-footer">
          {step > 1 && (
            <button className="hm-btn hm-btn-soft" onClick={prevStep}>
              <ChevronLeft size={18} /> {t("wizard.back")}
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("wizard.cancel")}</button>
            {step === TOTAL_STEPS ? (
              <button className="hm-btn hm-btn-primary" onClick={handleSave}>
                <Check size={18} /> {t("wizard.createRoomButton")}
              </button>
            ) : step !== 2 && (
              <button className="hm-btn hm-btn-primary" onClick={nextStep} disabled={step === 1 && !data.name.trim()}>
                {t("wizard.next")} <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .wizard-modal { background: var(--surface); width: 100%; max-width: 540px; max-height: 92vh; border-radius: 28px 28px 0 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 -12px 40px rgba(0,0,0,0.18); position: relative; animation: hmSheetIn .32s cubic-bezier(.22,1,.36,1) backwards; }
        @media (prefers-reduced-motion: reduce) { .wizard-modal { animation: none !important; } }
        .wizard-progress-bar { height: 6px; background: var(--surface-alt); width: 100%; flex-shrink: 0; }
        .wizard-progress-fill { height: 100%; background: var(--accent); transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .wizard-step-counter { font-size: 13px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; }
        /* La barra de progreso va entre el asa y la cabecera, así que bajamos la
           cruz para que no quede pisándola. */
        .wizard-modal .hm-modal-header { padding-top: 16px; }
        .wizard-modal .hm-modal-close { top: 14px; }
        .wizard-body { padding: 20px 32px 40px; flex: 1; overflow-y: auto; overscroll-behavior-y: contain; display: flex; flex-direction: column; }
        .wizard-content-wrapper { flex: 1; display: flex; flex-direction: column; }
        .wizard-step-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .wizard-title { font-size: 28px; margin-bottom: 32px; font-weight: 700; }
        .wizard-big-input { font-size: 20px !important; padding: 16px 20px !important; border-radius: 16px !important; text-align: center; border: 2px solid var(--border) !important; width: 100%; max-width: 400px; }
        .wizard-footer { padding: 20px 32px 32px; background: var(--surface-alt); display: flex; align-items: center; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; width: 100%; }
        .icon-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; }
        .icon-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .icon-card.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
        .icon-emoji { font-size: 28px; }
        .icon-label { font-weight: 600; font-size: 13px; }

        .summary-card { background: var(--surface-alt); border-radius: 24px; padding: 32px; width: 100%; display: flex; flex-direction: column; align-items: center; }
        .summary-room-icon { width: 90px; height: 90px; border-radius: 24px; background: var(--surface); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: var(--shadow); }
        .summary-room-name { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
        .summary-room-sub { color: var(--ink-soft); font-size: 14px; margin: 0; }

        .transition-next .wizard-content-wrapper { animation: slideNext 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .transition-back .wizard-content-wrapper { animation: slideBack 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideNext { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideBack { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
