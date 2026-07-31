import { useState, Fragment } from "react";
import {
  Archive, ArrowDown, ArrowRight, BedDouble, Box, Check, Home,
  MapPin, Package, Search, Share2, Sparkles, UserRound, Users,
} from "lucide-react";
import { OnboardingSlide } from "./OnboardingSlide";
import { ProgressIndicator } from "./ProgressIndicator";
import { useTranslation } from "../../i18n";

function useRoomOptions() {
  const { t } = useTranslation();
  return [
    { name: t("roomIcons.salon"), icon: "🛋️" },
    { name: t("roomIcons.dormitorio"), icon: "🛏️" },
    { name: t("roomIcons.cocina"), icon: "🍳" },
    { name: t("roomIcons.bano"), icon: "🚿" },
    { name: t("roomIcons.trastero"), icon: "📦" },
    { name: t("roomIcons.garaje"), icon: "🚗" },
  ];
}

function LocationStack() {
  const { t } = useTranslation();
  return (
    <div className="onboarding-location-stack">
      {[
        ["🏠", t("onboarding.locationRoom")],
        ["📍", t("onboarding.locationZone")],
        ["📦", t("onboarding.locationBox")],
        ["📱", t("onboarding.locationObject")],
      ].map(([icon, label], index) => (
        <Fragment key={label}>
          <div className="onboarding-location-row"><span>{icon}</span><strong>{label}</strong></div>
          {index < 3 && <ArrowDown size={18} />}
        </Fragment>
      ))}
    </div>
  );
}

function WelcomeSlide() {
  const { t } = useTranslation();
  return (
    <OnboardingSlide title={t("onboarding.welcomeTitle")} description={t("onboarding.welcomeDescription")}>
      <div className="onboarding-house-art">
        <Home size={82} strokeWidth={1.3} />
        <div className="onboarding-house-items"><BedDouble size={24} /><Box size={24} /><Archive size={24} /></div>
      </div>
    </OnboardingSlide>
  );
}

function OrganizationSlide() {
  const { t } = useTranslation();
  return (
    <OnboardingSlide title={t("onboarding.organizationTitle")} description={t("onboarding.organizationDescription")}>
      <LocationStack />
    </OnboardingSlide>
  );
}

function SearchSlide() {
  const { t } = useTranslation();
  return (
    <OnboardingSlide title={t("onboarding.searchTitle")} description={t("onboarding.searchDescription")}>
      <div className="onboarding-search-demo">
        <div className="onboarding-search-input"><Search size={18} /> {t("onboarding.searchDemoQuery")}</div>
        <div className="onboarding-search-result">
          <div className="onboarding-result-icon"><Search size={20} /></div>
          <div><strong>{t("onboarding.searchDemoQuery")}</strong><div className="onboarding-breadcrumb">{t("onboarding.breadcrumbDormitorio")} <b>→</b> {t("onboarding.breadcrumbEscritorio")} <b>→</b> {t("onboarding.breadcrumbCajonDerecho")}</div></div>
        </div>
      </div>
    </OnboardingSlide>
  );
}

function AddObjectSlide() {
  const { t } = useTranslation();
  const steps = [t("onboarding.stepNameLabel"), t("onboarding.stepPhotoLabel"), t("onboarding.stepCategoryLabel"), t("onboarding.stepLocationLabel"), t("onboarding.stepSaveLabel")];
  return (
    <OnboardingSlide title={t("onboarding.addObjectTitle")} description={t("onboarding.addObjectDescription")}>
      <div className="onboarding-steps-demo">
        {steps.map((step, index) => (
          <div key={step} className="onboarding-step-item"><span>{index + 1}</span><strong>{step}</strong>{index < 4 && <ArrowRight size={15} />}</div>
        ))}
      </div>
    </OnboardingSlide>
  );
}

function SharingSlide() {
  const { t } = useTranslation();
  return (
    <OnboardingSlide title={t("onboarding.sharingTitle")} description={t("onboarding.sharingDescription")}>
      <div className="onboarding-sharing-art">
        <div className="onboarding-person"><UserRound size={42} /><span>{t("onboarding.you")}</span></div>
        <Share2 size={24} />
        <div className="onboarding-person"><Users size={42} /><span>{t("onboarding.yourTeam")}</span></div>
      </div>
    </OnboardingSlide>
  );
}

function FinishSlide() {
  const { t } = useTranslation();
  return (
    <OnboardingSlide title={t("onboarding.finishTitle")} description={t("onboarding.finishDescription")}>
      <div className="onboarding-finish-art"><Sparkles size={64} /><Check size={34} /></div>
    </OnboardingSlide>
  );
}

function SetupSlide({ setup, setSetup }) {
  const { t } = useTranslation();
  const roomOptions = useRoomOptions();
  return (
    <OnboardingSlide title={t("onboarding.setupTitle")} description={t("onboarding.setupDescription")}>
      <div className="onboarding-setup">
        <label className="hm-label" htmlFor="onboarding-home-name">{t("onboarding.setupHomeNameLabel")}</label>
        <input id="onboarding-home-name" className="hm-input" value={setup.homeName} onChange={(e) => setSetup({ ...setup, homeName: e.target.value })} placeholder={t("onboarding.setupHomeNamePlaceholder")} autoFocus />
        <label className="hm-label">{t("onboarding.setupCreateRoomLabel")}</label>
        <div className="onboarding-room-grid">
          {roomOptions.map((room) => (
            <button key={room.name} type="button" className={`onboarding-room-option ${setup.roomName === room.name ? "selected" : ""}`} onClick={() => setSetup({ ...setup, roomName: room.name })}>
              <span>{room.icon}</span>{room.name}
            </button>
          ))}
        </div>
      </div>
    </OnboardingSlide>
  );
}

export function Onboarding({ onComplete, onSkip, initialSetup }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState({ homeName: initialSetup?.homeName || t("onboarding.setupHomeNamePlaceholder"), roomName: "" });
  const slides = [WelcomeSlide, OrganizationSlide, SearchSlide, AddObjectSlide, SharingSlide, FinishSlide];
  const isSetup = step === slides.length;
  const Slide = slides[step] || FinishSlide;
  const total = slides.length;

  const next = () => {
    if (step < total) setStep(step + 1);
    else onComplete(setup);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-shell">
        <button className="onboarding-skip" onClick={onSkip}>{t("onboarding.skip")}</button>
        <ProgressIndicator current={Math.min(step + 1, total)} total={total} />
        <div className="onboarding-content">
          {isSetup ? <SetupSlide setup={setup} setSetup={setSetup} /> : <Slide />}
        </div>
        <div className="onboarding-footer">
          {step > 0 && <button className="hm-btn hm-btn-ghost" onClick={() => setStep(step - 1)}>{t("onboarding.back")}</button>}
          {step === total - 1 && (
            <button className="hm-btn hm-btn-soft" onClick={() => setStep(total)}>
              {t("onboarding.configureHome")}
            </button>
          )}
          <button className="hm-btn hm-btn-primary onboarding-next" onClick={step === total - 1 ? () => onComplete(setup) : next}>
            {isSetup ? t("onboarding.enterHaven") : step === total - 1 ? t("onboarding.enterHaven") : step === 0 ? t("onboarding.start") : t("onboarding.next")}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <style>{`
        .onboarding-overlay { position: fixed; inset: 0; z-index: 2000; background: var(--bg); color: var(--ink); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .onboarding-shell { width: 100%; max-width: 760px; min-height: min(720px, 92vh); display: flex; flex-direction: column; position: relative; }
        .onboarding-skip { align-self: flex-end; border: 0; background: transparent; color: var(--ink-soft); cursor: pointer; font: 600 13px Inter, sans-serif; padding: 8px 0; }
        .onboarding-skip:hover { color: var(--ink); }
        .onboarding-progress { display: flex; gap: 6px; justify-content: center; margin: 8px auto 0; }
        .onboarding-progress span { width: 24px; height: 5px; border-radius: 99px; background: var(--border); transition: background .3s, width .3s; }
        .onboarding-progress span.active { background: var(--accent); width: 34px; }
        .onboarding-content { flex: 1; display: flex; align-items: center; justify-content: center; padding: 30px 0; }
        .onboarding-slide { width: 100%; max-width: 650px; text-align: center; display: flex; align-items: center; flex-direction: column; }
        .onboarding-illustration { width: min(100%, 540px); min-height: 220px; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; color: var(--accent); }
        .onboarding-title { font-size: clamp(28px, 5vw, 44px); line-height: 1.08; margin: 0 0 14px; font-weight: 700; }
        .onboarding-description { color: var(--ink-soft); font-size: 16px; line-height: 1.5; max-width: 480px; margin: 0; }
        .onboarding-footer { min-height: 58px; display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
        .onboarding-next { min-width: 150px; justify-content: center; }
        .onboarding-house-art { width: 220px; height: 180px; border-radius: 32px; background: var(--accent-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
        .onboarding-house-items { display: flex; gap: 22px; color: var(--pin); }
        .onboarding-location-stack { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--ink); }
        .onboarding-location-row { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 10px 28px; min-width: 190px; justify-content: flex-start; box-shadow: var(--shadow); }
        .onboarding-location-row span { font-size: 22px; }
        .onboarding-location-stack > svg { color: var(--pin); }
        .onboarding-search-demo { width: min(100%, 480px); background: var(--surface-alt); border-radius: 22px; padding: 20px; text-align: left; }
        .onboarding-search-input { background: var(--surface); border: 2px solid var(--accent); border-radius: 13px; padding: 13px 15px; display: flex; align-items: center; gap: 10px; color: var(--ink); font-size: 14px; }
        .onboarding-search-result { display: flex; gap: 12px; align-items: center; background: var(--surface); border-radius: 14px; padding: 14px; margin-top: 12px; }
        .onboarding-result-icon { width: 40px; height: 40px; border-radius: 11px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; flex: 0 0 auto; }
        .onboarding-breadcrumb { color: var(--ink-soft); font-size: 12px; margin-top: 6px; }
        .onboarding-breadcrumb b { color: var(--pin); margin: 0 3px; }
        .onboarding-steps-demo { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 550px; }
        .onboarding-step-item { display: flex; align-items: center; gap: 7px; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 12px; box-shadow: var(--shadow); }
        .onboarding-step-item span { background: var(--accent); color: var(--accent-ink); width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; font: 600 12px 'IBM Plex Mono', monospace; }
        .onboarding-step-item > svg { color: var(--pin); }
        .onboarding-sharing-art { display: flex; align-items: center; gap: 24px; color: var(--accent); }
        .onboarding-person { width: 125px; height: 125px; border-radius: 28px; background: var(--accent-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--accent); }
        .onboarding-person span { font-weight: 600; font-size: 13px; }
        .onboarding-finish-art { position: relative; width: 150px; height: 150px; border-radius: 50%; background: var(--success-soft); display: grid; place-items: center; color: var(--success); }
        .onboarding-finish-art > svg:last-child { position: absolute; right: 12px; bottom: 15px; background: var(--success); color: white; border-radius: 50%; padding: 7px; width: 48px; height: 48px; }
        .onboarding-setup { width: min(100%, 480px); text-align: left; display: flex; flex-direction: column; gap: 10px; }
        .onboarding-setup .hm-label:not(:first-child) { margin-top: 16px; }
        .onboarding-room-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .onboarding-room-option { border: 1px solid var(--border); background: var(--surface); border-radius: 13px; padding: 11px 5px; color: var(--ink); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; font: 600 12px Inter, sans-serif; }
        .onboarding-room-option span { font-size: 22px; }
        .onboarding-room-option:hover, .onboarding-room-option.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
        @media (max-width: 560px) { .onboarding-overlay { padding: 18px; } .onboarding-shell { min-height: 94vh; } .onboarding-content { padding: 16px 0; } .onboarding-illustration { min-height: 190px; } .onboarding-location-row { min-width: 170px; } .onboarding-sharing-art { gap: 10px; transform: scale(.9); } .onboarding-person { width: 110px; height: 110px; } .onboarding-room-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
