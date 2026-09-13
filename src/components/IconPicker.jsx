import { Lock, Sparkles } from "lucide-react";
import { useTranslation } from "../i18n";

/**
 * Selector de iconos genérico y reutilizable (sección 8 del pedido: "crear
 * una estructura de iconos que permita ampliar esta función posteriormente
 * sin modificar la arquitectura"). No sabe nada de habitaciones/cajas/
 * objetos -- solo recibe dos listas planas `{key, emoji, label}` y avisa
 * qué tecla se eligió. Añadir un dominio nuevo (cajas, objetos, categorías
 * de Economía...) es pasarle sus propios arrays gratuito/premium, nunca
 * tocar este componente.
 *
 * Las opciones premium se muestran siempre (nunca ocultas del todo, para
 * que el usuario sepa que existen) pero bloqueadas con un candado si
 * `canUsePremium` es falso; tocarlas entonces llama a `onRequirePremium` en
 * vez de seleccionarlas.
 */
export function IconPicker({ value, onSelect, options, premiumOptions = [], canUsePremium = false, onRequirePremium }) {
  const { t } = useTranslation();

  const handlePremiumClick = (key) => {
    if (canUsePremium) onSelect(key);
    else if (onRequirePremium) onRequirePremium();
  };

  return (
    <div className="hm-icon-picker">
      <div className="hm-icon-picker-grid">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`hm-icon-picker-card ${value === opt.key ? "selected" : ""}`}
            onClick={() => onSelect(opt.key)}
          >
            <span className="hm-icon-picker-emoji">{opt.emoji}</span>
            <span className="hm-icon-picker-label">{opt.label}</span>
          </button>
        ))}
      </div>

      {premiumOptions.length > 0 && (
        <>
          <div className="hm-icon-picker-section-title">
            <Sparkles size={13} /> {t("iconPicker.premiumSectionTitle")}
          </div>
          <div className="hm-icon-picker-grid">
            {premiumOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`hm-icon-picker-card ${value === opt.key ? "selected" : ""} ${!canUsePremium ? "locked" : ""}`}
                onClick={() => handlePremiumClick(opt.key)}
              >
                {!canUsePremium && <span className="hm-icon-picker-lock"><Lock size={11} /></span>}
                <span className="hm-icon-picker-emoji">{opt.emoji}</span>
                <span className="hm-icon-picker-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <style>{`
        .hm-icon-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; width: 100%; }
        .hm-icon-picker-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; }
        .hm-icon-picker-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .hm-icon-picker-card.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
        .hm-icon-picker-card.locked { opacity: 0.55; }
        .hm-icon-picker-emoji { font-size: 28px; }
        .hm-icon-picker-label { font-weight: 600; font-size: 13px; }
        .hm-icon-picker-lock { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
        .hm-icon-picker-section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; margin: 18px 0 12px; width: 100%; }
      `}</style>
    </div>
  );
}
