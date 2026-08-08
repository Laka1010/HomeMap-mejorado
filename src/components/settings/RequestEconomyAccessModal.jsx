import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";
import { economyAccessService } from "../../modules/economy/services/economyAccessService";

/**
 * Confirmación antes de enviar una solicitud de acceso de solo lectura a la
 * economía Personal de otro miembro. `ownerUserId`/`ownerName` identifican
 * a quién se le pide; `onSent` refresca el mapa de estados en el llamador
 * (HouseSettingsScreen) tras un envío correcto.
 */
export function RequestEconomyAccessModal({ ownerUserId, ownerName, onClose, onSent }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      await economyAccessService.requestAccess(ownerUserId);
      onSent?.();
      onClose?.();
    } catch (err) {
      console.error("Error requesting economy access:", err);
      setError(t("economyAccess.requestError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose?.(e); }}>
      <div className="hm-modal" style={{ maxWidth: 420, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.close")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("economyAccess.requestModalTitle", { name: ownerName })}</h3>
        </div>
        <div className="hm-modal-body">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", display: "grid", placeItems: "center", color: "var(--ink-soft)", flexShrink: 0 }}>
              <Lock size={17} />
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
              {t("economyAccess.requestModalBody", { name: ownerName })}
            </p>
          </div>

          {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="hm-btn hm-btn-soft hm-btn--full" onClick={onClose} disabled={sending}>
              {t("common.cancel")}
            </button>
            <button className="hm-btn hm-btn-primary hm-btn--full" onClick={handleSend} disabled={sending}>
              {sending ? t("economyAccess.sending") : t("economyAccess.sendRequest")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
