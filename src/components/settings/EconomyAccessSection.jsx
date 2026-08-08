import { useEffect, useState } from "react";
import { Eye, Check, X, Share2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import { economyAccessService } from "../../modules/economy/services/economyAccessService";

/**
 * Gestión de "quién puede ver mi economía Personal": solicitudes que me han
 * enviado (aceptar/rechazar), a quién le tengo concedido acceso ahora mismo
 * (revocar), y compañeros de casa con los que aún no comparto nada (para
 * compartir directamente sin esperar a que ellos lo pidan). Reemplaza al
 * antiguo toggle household-wide (PersonalSpacePrivacySection) por el
 * sistema de consentimiento por pareja de economy_access_requests.
 * `members`/`currentUserId` vienen de HouseSettingsScreen (ya los tiene
 * cargados); el resto de datos los carga esta sección por su cuenta, como
 * AccountsSection.
 */
export function EconomyAccessSection({ members = [], currentUserId }) {
  const { t } = useTranslation();
  const [received, setReceived] = useState([]);
  const [granted, setGranted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [receivedRows, grantedRows] = await Promise.all([
        economyAccessService.listReceivedRequests(),
        economyAccessService.listGrantedAccess(),
      ]);
      setReceived(receivedRows);
      setGranted(grantedRows);
    } catch (err) {
      console.error("Error loading economy access data:", err);
      setError(t("economyAccess.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRespond = async (requestId, accept) => {
    setBusyId(requestId);
    try {
      await economyAccessService.respondToRequest(requestId, accept);
      await load();
    } catch (err) {
      console.error("Error responding to access request:", err);
      setError(t("economyAccess.respondError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (row) => {
    setBusyId(row.id);
    try {
      await economyAccessService.revokeAccess(row.requester_user_id);
      await load();
    } catch (err) {
      console.error("Error revoking economy access:", err);
      setError(t("economyAccess.revokeError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleGrant = async (userId) => {
    setBusyId(userId);
    try {
      await economyAccessService.grantAccess(userId);
      await load();
    } catch (err) {
      console.error("Error granting economy access:", err);
      setError(t("economyAccess.grantError"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  // Compañeros de casa con los que todavía no comparto nada — para poder
  // compartir directamente, sin necesitar que ellos lo pidan primero.
  const grantedIds = new Set(granted.map((r) => r.requester_user_id));
  const shareable = members
    .map((m) => ({ id: m.user_id ?? m.id, name: m.name || m.email || t("membersModule.roleMember") }))
    .filter((m) => m.id && m.id !== currentUserId && !grantedIds.has(m.id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Eye size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{t("economyAccess.sectionTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{t("economyAccess.sectionDescription")}</div>
        </div>
      </div>

      {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {received.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: granted.length > 0 ? 14 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {t("economyAccess.receivedTitle")}
          </div>
          {received.map((r) => (
            <div key={r.id} className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5 }}>{t("economyAccess.receivedRow", { name: r.name })}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger"
                  onClick={() => handleRespond(r.id, false)}
                  disabled={busyId === r.id}
                >
                  <X size={14} /> {t("economyAccess.reject")}
                </button>
                <button
                  className="hm-btn hm-btn-primary hm-btn--compact"
                  onClick={() => handleRespond(r.id, true)}
                  disabled={busyId === r.id}
                >
                  <Check size={14} /> {t("economyAccess.accept")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {granted.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {t("economyAccess.grantedTitle")}
          </div>
          {granted.map((r) => (
            <div key={r.id} className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5 }}>{r.name}</div>
              <button
                className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger"
                onClick={() => handleRevoke(r)}
                disabled={busyId === r.id}
              >
                {t("economyAccess.stopSharing")}
              </button>
            </div>
          ))}
        </div>
      )}

      {received.length === 0 && granted.length === 0 && shareable.length === 0 && (
        <div className="hm-card hm-card--p16" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
          {t("economyAccess.emptyState")}
        </div>
      )}

      {shareable.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: received.length > 0 || granted.length > 0 ? 14 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {t("economyAccess.shareableTitle")}
          </div>
          {shareable.map((m) => (
            <div key={m.id} className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5 }}>{m.name}</div>
              <button
                className="hm-btn hm-btn-soft hm-btn--compact"
                onClick={() => handleGrant(m.id)}
                disabled={busyId === m.id}
              >
                <Share2 size={14} /> {t("economyAccess.shareDirectly")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
