import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../i18n";
import { financialSpacesService } from "../../modules/economy/services/financialSpacesService";

/**
 * Ajuste puramente personal (no de la casa, aunque vive en esta pantalla):
 * cada usuario decide si sus compañeros de casa pueden ENTRAR (solo lectura)
 * a su Workspace Personal. Nadie más puede cambiarlo por ti -- ni el admin
 * de la casa -- solo tu propio espacio, vía set_personal_space_privacy
 * (comprueba owner_id = auth.uid() en el servidor).
 *
 * La existencia del espacio (nombre + icono, como tarjeta bloqueada) ya es
 * visible para tus compañeros de casa SIEMPRE, esté activado esto o no --
 * este interruptor solo decide si además pueden abrirlo para ver cuentas y
 * movimientos (nunca pueden añadir/editar/borrar nada en él).
 */
export function PersonalSpacePrivacySection() {
  const { t } = useTranslation();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    financialSpacesService.getPersonalSpace()
      .then((s) => { if (!cancelled) setSpace(s); })
      .catch((err) => console.error("Error loading personal space:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async () => {
    if (!space || saving) return;
    const next = !space.shared_with_house;
    setSaving(true);
    setError("");
    const previous = space.shared_with_house;
    setSpace((s) => ({ ...s, shared_with_house: next }));
    try {
      await financialSpacesService.setPersonalSpacePrivacy(next);
    } catch (err) {
      console.error("Error updating personal space privacy:", err);
      setSpace((s) => ({ ...s, shared_with_house: previous }));
      setError(t("houseSettings.personalPrivacy.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !space) return null;

  const shared = !!space.shared_with_house;

  return (
    <div>
      <label className="hm-label">{t("houseSettings.personalPrivacy.title")}</label>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>
        {t("houseSettings.personalPrivacy.hint")}
      </p>
      <button
        className="hm-btn hm-btn-soft hm-btn--full"
        onClick={handleToggle}
        disabled={saving}
        style={{
          justifyContent: "space-between",
          borderColor: shared ? "var(--accent)" : "var(--border)",
          background: shared ? "var(--accent-soft)" : "var(--surface)",
          opacity: saving ? 0.7 : 1,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {shared ? <Eye size={17} /> : <EyeOff size={17} />}
          {t("houseSettings.personalPrivacy.toggleLabel", { name: space.name })}
        </span>
        <span style={{ color: shared ? "var(--accent)" : "var(--ink-soft)", fontWeight: 700 }}>
          {shared ? t("common.on") : t("common.off")}
        </span>
      </button>
      {error && <p style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
