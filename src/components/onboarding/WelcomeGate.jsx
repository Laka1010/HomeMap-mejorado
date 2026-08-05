import { useRef, useState } from "react";
import { ArrowLeft, Camera, Check, X } from "lucide-react";
import { getPhotoError, fileToBase64 } from "../../services/photoUtils.jsx";
import { BrandMark } from "../BrandMark";
import { useTranslation } from "../../i18n";
import { HOME_TEMPLATES } from "../../modules/homeTemplates/templates";
import {
  CUSTOM_ROOM_CATALOG,
  CUSTOM_TASK_CATALOG,
  CUSTOM_LIST_CATALOG,
  CUSTOM_CATEGORY_CATALOG,
} from "../../modules/homeTemplates/customCatalog";

/**
 * Pantalla obligatoria de pantalla completa mostrada cuando el usuario no
 * pertenece a ninguna casa todavía. Sustituye al antiguo modal descartable
 * `HomeSelector` para este caso (ver App.jsx: se renderiza en vez del shell
 * con sidebar/bottom-nav, no encima).
 *
 * También se reutiliza tal cual como asistente de dependencias cuando una
 * acción de la app (gasto, factura...) necesita un hogar y todavía no hay
 * ninguno (ver src/dependencyGuard.js) — en ese caso se le pasan `title`,
 * `subtitle` y `onCancel` para adaptar el copy y permitir cerrarlo — y como
 * flujo de creación de una 2ª+ casa desde HomeSelector (ver App.jsx, modal
 * "createHome"), pasando `initialStep="create"` para saltar la pantalla de
 * elección Crear/Unirse.
 */
export function WelcomeGate({ onCreateHouse, onJoinHouse, onLogout, title, subtitle, onCancel, initialStep = "choice" }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(initialStep); // "choice" | "create" | "join"

  return (
    <div className="welcome-gate">
      {onCancel && (
        <button className="wg-cancel" onClick={onCancel} aria-label={t("onboarding.welcomeGate.cancelAria")}>
          <X size={20} />
        </button>
      )}
      {step === "choice" && <ChoiceStep title={title} subtitle={subtitle} onCreate={() => setStep("create")} onJoin={() => setStep("join")} onLogout={onLogout} />}
      {step === "create" && <CreateStep onBack={initialStep === "create" ? null : () => setStep("choice")} onSubmit={onCreateHouse} />}
      {step === "join" && <JoinStep onBack={() => setStep("choice")} onSubmit={onJoinHouse} />}

      <style>{`
        .welcome-gate {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: #ffffff;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          font-family: 'Inter', sans-serif;
          color: #1a1a1a;
        }
        .wg-cancel {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #f2f2f2;
          color: #6b6b6b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .wg-cancel:hover { background: #e5e5e5; color: #1a1a1a; }
        .wg-panel {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .wg-panel--wide { max-width: 620px; }
        .wg-emoji {
          font-size: 56px;
          line-height: 1;
          margin-bottom: 28px;
        }
        .wg-title {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 700;
          margin: 0 0 20px;
          color: #1a1a1a;
        }
        .wg-subtitle {
          font-size: 15.5px;
          line-height: 1.6;
          color: #6b6b6b;
          margin: 0 0 48px;
          max-width: 360px;
        }
        .wg-options {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .wg-option-card {
          width: 100%;
          text-align: left;
          border: 1px solid #e5e5e5;
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wg-option-head {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
        }
        .wg-option-desc {
          font-size: 13.5px;
          color: #6b6b6b;
          line-height: 1.5;
          margin: 0;
        }
        .wg-btn {
          margin-top: 4px;
          height: 48px;
          border-radius: 12px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s, transform 0.1s;
        }
        .wg-btn:active { transform: scale(0.98); }
        .wg-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .wg-btn-primary { background: #1a1a1a; color: #fff; }
        .wg-btn-soft { background: #f2f2f2; color: #1a1a1a; }
        .wg-logout {
          margin-top: 40px;
          background: none;
          border: none;
          color: #9b9b9b;
          font-size: 13px;
          cursor: pointer;
        }
        .wg-logout:hover { color: #6b6b6b; text-decoration: underline; }

        .wg-back {
          align-self: flex-start;
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #6b6b6b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 32px;
        }
        .wg-back:hover { color: #1a1a1a; }
        .wg-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
          text-align: left;
        }
        .wg-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #6b6b6b;
        }
        .wg-input {
          height: 50px;
          border-radius: 12px;
          border: 1px solid #e5e5e5;
          padding: 0 16px;
          font-size: 15px;
          width: 100%;
          box-sizing: border-box;
          background: #fafafa;
        }
        .wg-input:focus {
          outline: none;
          border-color: #1a1a1a;
          background: #fff;
        }
        .wg-input-code {
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .wg-photo-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .wg-photo-preview {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid #e5e5e5;
          flex-shrink: 0;
        }
        .wg-photo-placeholder {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #f2f2f2;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9b9b9b;
          flex-shrink: 0;
        }
        .wg-photo-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wg-photo-btn {
          background: none;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: #1a1a1a;
        }
        .wg-photo-remove {
          background: none;
          border: none;
          font-size: 12.5px;
          color: #9b9b9b;
          cursor: pointer;
          text-align: left;
          padding: 0;
        }
        .wg-error {
          background: #fdecec;
          color: #c0392b;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.4;
        }
        .wg-spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: hmSpin 0.8s linear infinite;
        }

        /* Start mode (Empty / Template / AI) */
        .wg-startmode-card {
          width: 100%;
          text-align: left;
          border: 1px solid #e5e5e5;
          border-radius: 18px;
          padding: 20px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.15s, transform 0.1s, background 0.15s;
        }
        .wg-startmode-card:hover { border-color: #1a1a1a; }
        .wg-startmode-card:active { transform: scale(0.99); }
        .wg-startmode-card--disabled { cursor: not-allowed; opacity: 0.6; }
        .wg-startmode-card--disabled:hover { border-color: #e5e5e5; }
        .wg-startmode-emoji { font-size: 32px; line-height: 1; flex-shrink: 0; }
        .wg-startmode-body { flex: 1; min-width: 0; }
        .wg-startmode-title-row { display: flex; align-items: center; gap: 8px; }
        .wg-startmode-title { font-size: 16px; font-weight: 700; }
        .wg-startmode-badge {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9b6b2e;
          background: #fbeecf;
          border-radius: 999px;
          padding: 3px 9px;
        }
        .wg-startmode-desc { font-size: 13px; color: #6b6b6b; margin: 4px 0 0; line-height: 1.4; }
        .wg-startmode-note { font-size: 12px; color: #9b9b9b; margin: 6px 0 0; font-style: italic; }

        /* Template gallery */
        .wg-template-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .wg-template-card {
          text-align: left;
          border: 1px solid #e5e5e5;
          border-radius: 20px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .wg-template-card:hover { border-color: #1a1a1a; transform: translateY(-2px); box-shadow: 0 8px 20px -12px rgba(0,0,0,0.25); }
        .wg-template-card:active { transform: translateY(0); }
        .wg-template-badge {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }
        .wg-template-name { font-size: 16px; font-weight: 700; margin: 0; }
        .wg-template-desc { font-size: 13px; color: #6b6b6b; margin: 0; line-height: 1.45; flex: 1; }
        .wg-template-counts { display: flex; flex-wrap: wrap; gap: 6px; }
        .wg-template-count-pill {
          font-size: 11.5px;
          font-weight: 600;
          color: #6b6b6b;
          background: #f2f2f2;
          border-radius: 999px;
          padding: 4px 10px;
        }

        /* Custom builder */
        .wg-builder-section { width: 100%; text-align: left; margin-bottom: 24px; }
        .wg-builder-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6b6b6b;
          margin: 0 0 12px;
        }
        .wg-builder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .wg-check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 600;
          user-select: none;
        }
        .wg-check-row.checked { border-color: #1a1a1a; background: #f7f7f7; }
        .wg-check-box {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1.5px solid #c9c9c9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }
        .wg-check-row.checked .wg-check-box { background: #1a1a1a; border-color: #1a1a1a; }

        /* Preview */
        .wg-preview-card {
          width: 100%;
          background: #fafafa;
          border: 1px solid #e5e5e5;
          border-radius: 20px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
          margin-bottom: 28px;
        }
        .wg-preview-row { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; }
        .wg-preview-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #1a1a1a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .wg-preview-note {
          font-size: 13px;
          color: #6b6b6b;
          line-height: 1.5;
          background: #fbeecf;
          border-radius: 12px;
          padding: 12px 14px;
        }

        .wg-footer-row { width: 100%; display: flex; gap: 12px; }
        .wg-footer-row .wg-btn { flex: 1; }
      `}</style>
    </div>
  );
}

function ChoiceStep({ onCreate, onJoin, onLogout, title, subtitle }) {
  const { t } = useTranslation();
  return (
    <div className="wg-panel hm-fade-in">
      <div className="wg-emoji"><BrandMark size={56} /></div>
      <h1 className="wg-title">{title || t("onboarding.welcomeGate.defaultTitle")}</h1>
      <p className="wg-subtitle">
        {subtitle || (
          <>
            {t("onboarding.welcomeGate.defaultSubtitleLine1")}
            <br />
            {t("onboarding.welcomeGate.defaultSubtitleLine2")}
          </>
        )}
      </p>

      <div className="wg-options">
        <div className="wg-option-card">
          <div className="wg-option-head"><span>🏠</span> {t("onboarding.welcomeGate.createOptionTitle")}</div>
          <p className="wg-option-desc">{t("onboarding.welcomeGate.createOptionDesc")}</p>
          <button className="wg-btn wg-btn-primary" onClick={onCreate}>{t("onboarding.welcomeGate.createOptionButton")}</button>
        </div>

        <div className="wg-option-card">
          <div className="wg-option-head"><span>👨‍👩‍👧</span> {t("onboarding.welcomeGate.joinOptionTitle")}</div>
          <p className="wg-option-desc">{t("onboarding.welcomeGate.joinOptionDesc")}</p>
          <button className="wg-btn wg-btn-soft" onClick={onJoin}>{t("onboarding.welcomeGate.joinOptionButton")}</button>
        </div>
      </div>

      {onLogout && (
        <button className="wg-logout" onClick={onLogout}>{t("onboarding.welcomeGate.logout")}</button>
      )}
    </div>
  );
}

/** Convierte una plantilla fija (templates.js) en una selección con texto ya resuelto. */
function resolveTemplateSelection(tpl, t) {
  return {
    templateId: tpl.id,
    rooms: tpl.rooms.map((r) => ({ name: t(r.nameKey), icon: r.icon })),
    tasks: tpl.tasks.map((tk) => ({ title: t(tk.titleKey) })),
    shoppingLists: tpl.shoppingLists.map((l) => ({ name: t(l.nameKey) })),
    categories: tpl.categories ? tpl.categories.map((c) => t(c)) : null,
    highlightNote: tpl.highlightNoteKey ? t(tpl.highlightNoteKey) : null,
  };
}

/** Convierte las casillas marcadas del builder Custom en la misma forma de selección. */
function buildCustomSelection(checked, t) {
  return {
    templateId: "custom",
    rooms: CUSTOM_ROOM_CATALOG.filter((r) => checked.rooms.has(r.id)).map((r) => ({ name: t(r.nameKey), icon: r.icon })),
    tasks: CUSTOM_TASK_CATALOG.filter((x) => checked.tasks.has(x.id)).map((x) => ({ title: t(x.titleKey) })),
    shoppingLists: CUSTOM_LIST_CATALOG.filter((x) => checked.lists.has(x.id)).map((x) => ({ name: t(x.nameKey) })),
    categories: checked.categories.size > 0
      ? CUSTOM_CATEGORY_CATALOG.filter((x) => checked.categories.has(x.id)).map((x) => t(x.nameKey))
      : null,
    highlightNote: null,
  };
}

function CreateStep({ onBack, onSubmit }) {
  const { t } = useTranslation();
  const [subStep, setSubStep] = useState("details"); // details | startMode | gallery | customBuilder | preview
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [selection, setSelection] = useState(null);
  const [customChoices, setCustomChoices] = useState({ rooms: new Set(), tasks: new Set(), lists: new Set(), categories: new Set() });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const photoError = getPhotoError(file);
    if (photoError) {
      setError(t(photoError));
      return;
    }
    try {
      setError("");
      setPhoto(await fileToBase64(file));
    } catch {
      setError(t("onboarding.welcomeGate.imageReadError"));
    }
  };

  const submitHome = async (templateSelection) => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit(name.trim(), photo, templateSelection);
    } catch (err) {
      setError(err?.message || t("onboarding.welcomeGate.createError"));
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (subStep === "startMode") setSubStep("details");
    else if (subStep === "gallery") setSubStep("startMode");
    else if (subStep === "customBuilder") setSubStep("gallery");
    else if (subStep === "preview") setSubStep(selection?.templateId === "custom" ? "customBuilder" : "gallery");
    else if (onBack) onBack();
  };

  return (
    <div className="wg-panel hm-fade-in wg-panel--wide">
      {(subStep !== "details" || onBack) && (
        <button className="wg-back" onClick={goBack}><ArrowLeft size={16} /> {t("onboarding.welcomeGate.back")}</button>
      )}

      {subStep === "details" && (
        <DetailsStep
          name={name}
          setName={setName}
          photo={photo}
          setPhoto={setPhoto}
          error={error}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onContinue={() => { setError(""); setSubStep("startMode"); }}
        />
      )}

      {subStep === "startMode" && (
        <StartModeStep
          error={error}
          isSubmitting={isSubmitting}
          onEmpty={() => submitHome(null)}
          onTemplate={() => setSubStep("gallery")}
        />
      )}

      {subStep === "gallery" && (
        <TemplateGalleryStep
          onSelect={(tpl) => {
            if (tpl.isCustom) {
              setSelection({ templateId: "custom" });
              setSubStep("customBuilder");
            } else {
              setSelection(resolveTemplateSelection(tpl, t));
              setSubStep("preview");
            }
          }}
        />
      )}

      {subStep === "customBuilder" && (
        <CustomBuilderStep
          checked={customChoices}
          setChecked={setCustomChoices}
          onContinue={() => {
            setSelection(buildCustomSelection(customChoices, t));
            setSubStep("preview");
          }}
        />
      )}

      {subStep === "preview" && selection && (
        <TemplatePreviewStep
          selection={selection}
          error={error}
          isSubmitting={isSubmitting}
          onCreate={() => submitHome(selection)}
        />
      )}
    </div>
  );
}

function DetailsStep({ name, setName, photo, setPhoto, error, fileInputRef, onFileChange, onContinue }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 28 }}>{t("onboarding.welcomeGate.createTitle")}</h1>
      <form
        className="wg-form"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onContinue(); }}
      >
        {error && <div className="wg-error" role="alert">{error}</div>}

        <div>
          <label className="wg-label">{t("onboarding.welcomeGate.homeNameLabel")}</label>
          <input
            autoFocus
            className="wg-input"
            style={{ marginTop: 8 }}
            placeholder={t("onboarding.welcomeGate.homeNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="wg-label">{t("onboarding.welcomeGate.photoLabel")}</label>
          <div className="wg-photo-row" style={{ marginTop: 8 }}>
            {photo ? (
              <img src={photo} alt="" className="wg-photo-preview" />
            ) : (
              <div className="wg-photo-placeholder"><Camera size={22} /></div>
            )}
            <div className="wg-photo-actions">
              <button type="button" className="wg-photo-btn" onClick={() => fileInputRef.current?.click()}>
                {photo ? t("onboarding.welcomeGate.changePhoto") : t("onboarding.welcomeGate.addPhoto")}
              </button>
              {photo && (
                <button type="button" className="wg-photo-remove" onClick={() => setPhoto(null)}>
                  <X size={12} style={{ verticalAlign: "-1px" }} /> {t("onboarding.welcomeGate.removePhoto")}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <button type="submit" className="wg-btn wg-btn-primary" disabled={!name.trim()} style={{ marginTop: 8 }}>
          {t("wizard.next")}
        </button>
      </form>
    </>
  );
}

function StartModeStep({ error, isSubmitting, onEmpty, onTemplate }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 8 }}>{t("homeTemplates.chooseStart.title")}</h1>
      <p className="wg-subtitle" style={{ marginBottom: 32 }}>{t("homeTemplates.chooseStart.subtitle")}</p>

      {error && <div className="wg-error" role="alert" style={{ width: "100%", marginBottom: 16 }}>{error}</div>}

      <div className="wg-options">
        <button type="button" className="wg-startmode-card" onClick={onEmpty} disabled={isSubmitting}>
          <span className="wg-startmode-emoji">🏠</span>
          <span className="wg-startmode-body">
            <span className="wg-startmode-title-row"><span className="wg-startmode-title">{t("homeTemplates.chooseStart.emptyTitle")}</span></span>
            <p className="wg-startmode-desc">{t("homeTemplates.chooseStart.emptyDesc")}</p>
          </span>
          {isSubmitting ? <div className="wg-spinner" style={{ borderTopColor: "#1a1a1a", borderColor: "rgba(0,0,0,0.15)" }} /> : null}
        </button>

        <button type="button" className="wg-startmode-card" onClick={onTemplate} disabled={isSubmitting}>
          <span className="wg-startmode-emoji">🏡</span>
          <span className="wg-startmode-body">
            <span className="wg-startmode-title-row"><span className="wg-startmode-title">{t("homeTemplates.chooseStart.templateTitle")}</span></span>
            <p className="wg-startmode-desc">{t("homeTemplates.chooseStart.templateDesc")}</p>
          </span>
        </button>

        <div className="wg-startmode-card wg-startmode-card--disabled">
          <span className="wg-startmode-emoji">✨</span>
          <span className="wg-startmode-body">
            <span className="wg-startmode-title-row">
              <span className="wg-startmode-title">{t("homeTemplates.chooseStart.aiTitle")}</span>
              <span className="wg-startmode-badge">{t("homeTemplates.chooseStart.aiBadge")}</span>
            </span>
            <p className="wg-startmode-desc">{t("homeTemplates.chooseStart.aiDesc")}</p>
            <p className="wg-startmode-note">{t("homeTemplates.chooseStart.aiNote")}</p>
          </span>
        </div>
      </div>
    </>
  );
}

function TemplateGalleryStep({ onSelect }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 8 }}>{t("homeTemplates.gallery.title")}</h1>
      <p className="wg-subtitle" style={{ marginBottom: 32 }}>{t("homeTemplates.gallery.subtitle")}</p>

      <div className="wg-template-grid">
        {HOME_TEMPLATES.map((tpl) => (
          <button key={tpl.id} type="button" className="wg-template-card" onClick={() => onSelect(tpl)}>
            <div className="wg-template-badge" style={{ background: `${tpl.color}22` }}>{tpl.emoji}</div>
            <h3 className="wg-template-name">{t(tpl.nameKey)}</h3>
            <p className="wg-template-desc">{t(tpl.descKey)}</p>
            {!tpl.isCustom && (
              <div className="wg-template-counts">
                <span className="wg-template-count-pill">{t("homeTemplates.gallery.roomsCount", { count: tpl.rooms.length })}</span>
                {tpl.tasks.length > 0 && <span className="wg-template-count-pill">{t("homeTemplates.gallery.tasksCount", { count: tpl.tasks.length })}</span>}
                {tpl.shoppingLists.length > 0 && <span className="wg-template-count-pill">{t("homeTemplates.gallery.listsCount", { count: tpl.shoppingLists.length })}</span>}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

function CheckRow({ checked, onToggle, label }) {
  return (
    <div className={`wg-check-row ${checked ? "checked" : ""}`} onClick={onToggle}>
      <span className="wg-check-box">{checked && <Check size={13} />}</span>
      <span>{label}</span>
    </div>
  );
}

function CustomBuilderStep({ checked, setChecked, onContinue }) {
  const { t } = useTranslation();

  const toggle = (section, id) => {
    setChecked((prev) => {
      const next = new Set(prev[section]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [section]: next };
    });
  };

  const total = checked.rooms.size + checked.tasks.size + checked.lists.size + checked.categories.size;

  return (
    <>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 8 }}>{t("homeTemplates.customBuilder.title")}</h1>
      <p className="wg-subtitle" style={{ marginBottom: 24 }}>{t("homeTemplates.customBuilder.subtitle")}</p>

      <div className="wg-builder-section">
        <h4 className="wg-builder-section-title">{t("homeTemplates.customBuilder.roomsSection")}</h4>
        <div className="wg-builder-grid">
          {CUSTOM_ROOM_CATALOG.map((r) => (
            <CheckRow key={r.id} checked={checked.rooms.has(r.id)} onToggle={() => toggle("rooms", r.id)} label={t(r.nameKey)} />
          ))}
        </div>
      </div>

      <div className="wg-builder-section">
        <h4 className="wg-builder-section-title">{t("homeTemplates.customBuilder.listsSection")}</h4>
        <div className="wg-builder-grid">
          {CUSTOM_LIST_CATALOG.map((l) => (
            <CheckRow key={l.id} checked={checked.lists.has(l.id)} onToggle={() => toggle("lists", l.id)} label={t(l.nameKey)} />
          ))}
        </div>
      </div>

      <div className="wg-builder-section">
        <h4 className="wg-builder-section-title">{t("homeTemplates.customBuilder.categoriesSection")}</h4>
        <div className="wg-builder-grid">
          {CUSTOM_CATEGORY_CATALOG.map((c) => (
            <CheckRow key={c.id} checked={checked.categories.has(c.id)} onToggle={() => toggle("categories", c.id)} label={t(c.nameKey)} />
          ))}
        </div>
      </div>

      <div className="wg-builder-section" style={{ marginBottom: 8 }}>
        <h4 className="wg-builder-section-title">{t("homeTemplates.customBuilder.tasksSection")}</h4>
        <div className="wg-builder-grid">
          {CUSTOM_TASK_CATALOG.map((tk) => (
            <CheckRow key={tk.id} checked={checked.tasks.has(tk.id)} onToggle={() => toggle("tasks", tk.id)} label={t(tk.titleKey)} />
          ))}
        </div>
      </div>

      <button type="button" className="wg-btn wg-btn-primary" style={{ width: "100%" }} disabled={total === 0} onClick={onContinue}>
        {t("homeTemplates.customBuilder.continueButton")}
      </button>
    </>
  );
}

function TemplatePreviewStep({ selection, error, isSubmitting, onCreate }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 24 }}>{t("homeTemplates.preview.title")}</h1>

      {error && <div className="wg-error" role="alert" style={{ width: "100%", marginBottom: 16 }}>{error}</div>}

      <div className="wg-preview-card">
        <div className="wg-preview-row"><span className="wg-preview-check"><Check size={13} /></span> {t("homeTemplates.preview.rooms", { count: selection.rooms.length })}</div>
        <div className="wg-preview-row"><span className="wg-preview-check"><Check size={13} /></span> {t("homeTemplates.preview.lists", { count: selection.shoppingLists.length })}</div>
        <div className="wg-preview-row"><span className="wg-preview-check"><Check size={13} /></span> {t("homeTemplates.preview.tasks", { count: selection.tasks.length })}</div>
        {selection.categories && (
          <div className="wg-preview-row"><span className="wg-preview-check"><Check size={13} /></span> {t("homeTemplates.preview.categories", { count: selection.categories.length })}</div>
        )}
        {selection.highlightNote && <div className="wg-preview-note">{selection.highlightNote}</div>}
      </div>

      <button type="button" className="wg-btn wg-btn-primary" style={{ width: "100%" }} disabled={isSubmitting} onClick={onCreate}>
        {isSubmitting ? <div className="wg-spinner" /> : t("homeTemplates.preview.createButton")}
      </button>
    </>
  );
}

function JoinStep({ onBack, onSubmit }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit(code.trim());
    } catch (err) {
      setError(err?.message || t("onboarding.welcomeGate.joinError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wg-panel hm-fade-in">
      <button className="wg-back" onClick={onBack}><ArrowLeft size={16} /> {t("onboarding.welcomeGate.back")}</button>
      <h1 className="wg-title" style={{ fontSize: 24, marginBottom: 28 }}>{t("onboarding.welcomeGate.joinTitle")}</h1>

      <form className="wg-form" onSubmit={handleSubmit}>
        {error && <div className="wg-error" role="alert">{error}</div>}

        <div>
          <label className="wg-label">{t("onboarding.welcomeGate.inviteCodeLabel")}</label>
          <input
            autoFocus
            className="wg-input wg-input-code"
            style={{ marginTop: 8 }}
            placeholder="HM-X49K"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="wg-btn wg-btn-primary" disabled={!code.trim() || isSubmitting} style={{ marginTop: 8 }}>
          {isSubmitting ? <div className="wg-spinner" /> : t("onboarding.welcomeGate.joinButton")}
        </button>
      </form>
    </div>
  );
}
