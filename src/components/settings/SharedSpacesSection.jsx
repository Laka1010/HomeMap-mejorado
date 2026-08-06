import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import { financialSpacesService } from "../../modules/economy/services/financialSpacesService";

/**
 * Espacios compartidos de Economía creados en esta casa, con opción de
 * eliminarlos por completo (no solo archivar). Personal y Household son
 * permanentes y no aparecen aquí — ver delete_shared_financial_space, que
 * ya rechaza cualquier otro tipo en el servidor; esta pantalla solo evita
 * mostrar un botón que fallaría.
 */
export function SharedSpacesSection({ houseId }) {
  const { t } = useTranslation();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!houseId) return;
    setLoading(true);
    try {
      setSpaces(await financialSpacesService.listSharedSpaces(houseId));
    } catch (err) {
      console.error("Error loading shared spaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [houseId]);

  const handleDelete = async (spaceId) => {
    setDeletingId(spaceId);
    setError("");
    try {
      await financialSpacesService.deleteSpace(spaceId);
      setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
      setConfirmingId(null);
    } catch (err) {
      console.error("Error deleting shared space:", err);
      setError(t("houseSettings.sharedSpaces.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || spaces.length === 0) return null;

  return (
    <div>
      <label className="hm-label">{t("houseSettings.sharedSpaces.title")}</label>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>
        {t("houseSettings.sharedSpaces.hint")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {spaces.map((space) => (
          <div key={space.id} className="hm-card hm-card--p14" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="hm-row-icon" style={{ background: "var(--surface-alt)", fontSize: 17 }}>
                {space.icon || "❤️"}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {space.name}
              </div>
              {space.is_owner && confirmingId !== space.id && (
                <button
                  className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger"
                  onClick={() => { setError(""); setConfirmingId(space.id); }}
                  aria-label={t("houseSettings.sharedSpaces.deleteAria")}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {confirmingId === space.id && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--danger-soft)", padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {t("houseSettings.sharedSpaces.confirmDelete", { name: space.name })} {t("houseSettings.sharedSpaces.cannotUndo")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="hm-btn hm-btn-soft" onClick={() => setConfirmingId(null)}>
                    {t("houseSettings.sharedSpaces.cancel")}
                  </button>
                  <button
                    className="hm-btn hm-btn--danger"
                    onClick={() => handleDelete(space.id)}
                    disabled={deletingId === space.id}
                  >
                    {t("houseSettings.sharedSpaces.confirmYesDelete")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
