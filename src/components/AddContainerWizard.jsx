import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, MapPin, Box } from "lucide-react";
import { useTranslation } from "../i18n";
import { useDragToDismiss } from "../hooks/useDragToDismiss";

const BOX_COLORS = ["#3D5A80", "#C98A3E", "#6B7A5E", "#8E5B72", "#4C7A8B", "#8B6B4C"];

export function AddContainerWizard({ state, onClose, onSave, defaults = {} }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("next");
  const [data, setData] = useState({
    name: "",
    roomId: defaults.roomId || state.rooms[0]?.id || "",
    zoneId: defaults.zoneId || "",
    color: BOX_COLORS[0],
  });
  const [locLevel, setLocLevel] = useState("room"); // room -> zone

  const TOTAL_STEPS = 4;

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
    const newContainer = {
      id: "c-" + Math.random().toString(36).slice(2, 10),
      name: data.name.trim(),
      roomId: data.roomId,
      zoneId: data.zoneId || null,
      parentId: null,
      color: data.color,
      photo: null,
    };
    onSave(newContainer);
    onClose();
  };

  const selectedRoom = state.rooms.find(r => r.id === data.roomId);
  const selectedZone = state.zones.find(z => z.id === data.zoneId);

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
                <h2 className="hm-display wizard-title">{t("wizard.addContainerNameTitle")}</h2>
                <div className="wizard-input-wrapper">
                  <input
                    autoFocus
                    type="text"
                    className="hm-input wizard-big-input"
                    placeholder={t("wizard.addContainerNamePlaceholder")}
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
                <h2 className="hm-display wizard-title">{t("wizard.addContainerLocationTitle")}</h2>

                {locLevel === "room" ? (
                  <div className="selection-grid">
                    {state.rooms.map(room => (
                      <button
                        key={room.id}
                        className="selection-card hm-tap"
                        onClick={() => { setData({ ...data, roomId: room.id, zoneId: "" }); setLocLevel("zone"); }}
                      >
                        <span className="selection-label">{room.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="selection-grid">
                    <button className="selection-card back-pill" onClick={() => setLocLevel("room")}>
                      <ChevronLeft size={14} /> {t("wizard.changeRoom")}
                    </button>
                    {state.zones.filter(z => z.roomId === data.roomId).map(zone => (
                      <button
                        key={zone.id}
                        className="selection-card hm-tap"
                        onClick={() => { setData({ ...data, zoneId: zone.id }); nextStep(); }}
                      >
                        <span className="selection-icon">{zone.icon}</span>
                        <span className="selection-label">{zone.name}</span>
                      </button>
                    ))}
                    <button className="selection-card selection-skip hm-tap" onClick={nextStep}>
                      <span className="selection-label">{t("wizard.noSpecificZone")}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="wizard-step-container">
                <h2 className="hm-display wizard-title">{t("wizard.addContainerColorTitle")}</h2>
                <div className="color-grid">
                  {BOX_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-btn hm-tap ${data.color === c ? "selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => { setData({ ...data, color: c }); nextStep(); }}
                    />
                  ))}
                </div>
                <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>{t("wizard.addContainerColorHint")}</p>
              </div>
            )}

            {step === 4 && (
              <div className="wizard-step-container">
                <h2 className="hm-display wizard-title">{t("wizard.addContainerSummaryTitle")}</h2>
                <div className="summary-card">
                  <div className="summary-box-preview" style={{ background: data.color }}>
                    <Box size={40} color="#fff" />
                  </div>
                  <h3 className="summary-box-name">{data.name}</h3>
                  <div className="summary-location">
                    <MapPin size={14} />
                    <span>{selectedRoom?.name} {selectedZone ? `→ ${selectedZone.name}` : ""}</span>
                  </div>
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
            <button className="hm-btn hm-btn-ghost" onClick={onClose}>{t("wizard.cancel")}</button>
            {step === TOTAL_STEPS ? (
              <button className="hm-btn hm-btn-primary wizard-main-btn" onClick={handleSave}>
                <Check size={18} /> {t("wizard.createContainerButton")}
              </button>
            ) : (step !== 2 && step !== 3) && (
              <button className="hm-btn hm-btn-primary wizard-main-btn" onClick={nextStep} disabled={step === 1 && !data.name.trim()}>
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
        .wizard-body { padding: 20px 32px 40px; flex: 1; overflow-y: auto; overscroll-behavior-y: contain; display: flex; flex-direction: column; }
        .wizard-content-wrapper { flex: 1; display: flex; flex-direction: column; }
        .wizard-step-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .wizard-title { font-size: 28px; margin-bottom: 32px; font-weight: 700; }
        .wizard-big-input { font-size: 20px !important; padding: 16px 20px !important; border-radius: 16px !important; text-align: center; border: 2px solid var(--border) !important; width: 100%; max-width: 400px; }
        .wizard-footer { padding: 20px 32px 32px; background: var(--surface-alt); display: flex; align-items: center; }

        .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
        .selection-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s ease; color: var(--ink); }
        .selection-card:hover { border-color: var(--accent); background: var(--accent-soft); }
        .selection-label { font-weight: 700; font-size: 14px; }
        .selection-skip { grid-column: span 2; padding: 12px; border-style: dashed; }
        .back-pill { grid-column: span 2; padding: 10px; border-radius: 99px; background: var(--surface-alt); font-size: 12px; flex-direction: row; gap: 6px; border: none; color: var(--ink); }

        .color-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-top: 10px; }
        .color-btn { width: 48px; height: 48px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: all 0.2s ease; }
        .color-btn.selected { border-color: var(--ink); transform: scale(1.1); }

        .summary-card { background: var(--surface-alt); border-radius: 24px; padding: 32px; width: 100%; display: flex; flex-direction: column; align-items: center; }
        .summary-box-preview { width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: var(--shadow); }
        .summary-box-name { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
        .summary-location { display: flex; align-items: center; gap: 6px; color: var(--ink-soft); font-size: 14px; font-weight: 500; }

        .transition-next .wizard-content-wrapper { animation: slideNext 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .transition-back .wizard-content-wrapper { animation: slideBack 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideNext { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideBack { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
