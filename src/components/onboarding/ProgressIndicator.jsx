import { useTranslation } from "../../i18n";

export function ProgressIndicator({ current, total }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-progress" aria-label={t("wizard.stepCounter", { step: current, total })}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < current ? "active" : ""} />
      ))}
    </div>
  );
}
