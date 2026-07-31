import { useTranslation } from "../i18n";

/**
 * Contenido del asistente de dependencias: se muestra dentro del <Modal>
 * compartido (App.jsx) cuando una acción necesita un prerrequisito que
 * todavía no existe (ver src/dependencyGuard.js). Deliberadamente mínimo:
 * icono, una explicación de 1-2 líneas, un botón principal y cancelar.
 */
export function DependencyGateModal({ meta, onProceed, onCancel }) {
  const { t } = useTranslation();
  return (
    <div className="dep-gate">
      <div className="dep-gate-icon">{meta.icon}</div>
      <p className="dep-gate-title">{t(meta.title)}</p>
      <p className="dep-gate-desc">{t(meta.description)}</p>
      <div className="dep-gate-actions">
        <button className="hm-btn hm-btn-primary hm-btn--full" onClick={onProceed}>{t(meta.cta)}</button>
        <button className="hm-btn hm-btn-ghost hm-btn--full" onClick={onCancel}>{t("dependencyGate.cancel")}</button>
      </div>

      <style>{`
        .dep-gate {
          padding: 12px 4px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
        }
        .dep-gate-icon {
          font-size: 48px;
          line-height: 1;
          margin-bottom: 10px;
        }
        .dep-gate-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .dep-gate-desc {
          font-size: 13.5px;
          color: var(--ink-soft);
          line-height: 1.5;
          margin: 0 0 20px;
          max-width: 320px;
        }
        .dep-gate-actions {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}
