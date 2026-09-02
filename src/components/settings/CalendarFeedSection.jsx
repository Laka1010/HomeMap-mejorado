import { useEffect, useState } from "react";
import { CalendarDays, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "../../i18n";
import { calendarFeedService, buildFeedUrl, buildWebcalUrl } from "../../services/calendarFeedService";

/**
 * Enlace de suscripción al calendario del hogar (.ics). Se pega en Google
 * Calendar ("Otros calendarios → Suscribirse con URL") o Apple Calendar
 * ("Ajustes → Calendario → Cuentas → Añadir → Otra → Añadir calendario
 * suscrito"). Solo lectura hacia fuera. Ver src/services/calendarFeedService.js.
 *
 * La URL es larga por naturaleza (dominio de Supabase + token); la caja que la
 * muestra trunca con "…" y NUNCA desborda — cada contenedor de la cadena lleva
 * min-width:0 para que el grid de HouseSettingsScreen no crezca a lo ancho. El
 * usuario no necesita leerla: copia con un toque o pulsa "Suscribirse".
 */
export function CalendarFeedSection({ houseId, isAdmin }) {
  const { t } = useTranslation();
  const [token, setToken] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!houseId) return;
    let cancelled = false;
    setLoadError(false);
    calendarFeedService.getFeedToken(houseId)
      .then((value) => { if (!cancelled) setToken(value); })
      .catch((error) => {
        console.error("Error loading calendar feed token:", error);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, [houseId]);

  const url = token ? buildFeedUrl(token) : "";

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubscribe = () => {
    if (token) window.location.href = buildWebcalUrl(token);
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const next = await calendarFeedService.regenerateFeedToken(houseId);
      if (next) setToken(next);
    } catch (error) {
      console.error("Error regenerating calendar feed token:", error);
    } finally {
      setRegenerating(false);
      setConfirmingRegen(false);
    }
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <CalendarDays size={16} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("calendarFeed.title")}</div>
      </div>

      <div className="hm-card hm-card--p16" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("calendarFeed.description")}</div>

        {loadError ? (
          <div style={{ fontSize: 13, color: "var(--danger)" }}>{t("calendarFeed.loadError")}</div>
        ) : (
          <>
            <div className="cf-actions">
              <button
                type="button"
                className={`hm-btn ${copied ? "hm-btn-soft" : "hm-btn-primary"} cf-btn`}
                onClick={handleCopy}
                disabled={!url}
              >
                {copied ? <><Check size={16} /> {t("calendarFeed.copied")}</> : <><Copy size={16} /> {t("calendarFeed.copy")}</>}
              </button>
              <button type="button" className="hm-btn hm-btn-soft cf-btn" onClick={handleSubscribe} disabled={!token}>
                {t("calendarFeed.subscribeButton")}
              </button>
            </div>

            <div className="cf-url" title={url}>{url || "…"}</div>

            <button type="button" className="cf-help-toggle" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t("calendarFeed.howToTitle")}
            </button>
            {showHelp && (
              <ul className="cf-help-list">
                <li>{t("calendarFeed.howToGoogle")}</li>
                <li>{t("calendarFeed.howToApple")}</li>
              </ul>
            )}

            {isAdmin && (
              <div className="cf-regen">
                {confirmingRegen ? (
                  <>
                    <p className="cf-regen-warning">{t("calendarFeed.regenerateWarning")}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="hm-btn hm-btn-soft" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmingRegen(false)} disabled={regenerating}>
                        {t("common.cancel")}
                      </button>
                      <button type="button" className="hm-btn hm-btn--danger" style={{ flex: 1, justifyContent: "center" }} onClick={handleRegenerate} disabled={regenerating}>
                        {regenerating ? t("calendarFeed.regenerating") : t("calendarFeed.regenerateConfirm")}
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="hm-btn hm-btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 12.5 }} onClick={() => setConfirmingRegen(true)}>
                    <RefreshCw size={14} /> {t("calendarFeed.regenerate")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .cf-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .cf-btn { flex: 1 1 140px; justify-content: center; min-width: 0; }
        .cf-url {
          min-width: 0; max-width: 100%;
          background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px;
          padding: 8px 12px;
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--ink-soft);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cf-help-toggle { background: none; border: none; color: var(--accent); font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0; }
        .cf-help-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--ink-soft); }
        .cf-regen { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--border); }
        .cf-regen-warning { font-size: 12.5px; color: var(--ink-soft); margin: 0 0 10px; text-align: center; }
      `}</style>
    </div>
  );
}
