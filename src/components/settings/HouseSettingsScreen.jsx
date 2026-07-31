import { ArrowLeft, Home as HomeIcon, Shield } from "lucide-react";
import { useTranslation } from "../../i18n";
import { CurrencySection } from "./CurrencySection";
import { HouseMembersSection } from "./HouseMembersSection";
import { CategoriesSection } from "./CategoriesSection";

/**
 * Configuración de la casa: ajustes que pertenecen al hogar y no al usuario
 * (moneda, miembros y sus roles, categorías). Todo lo que se edita aquí lo
 * comparten todos los miembros; los ajustes personales viven en SettingsScreen.
 */
export function HouseSettingsScreen({
  house,
  members,
  currentUserId,
  currency,
  onChangeCurrency,
  onChangeMemberRole,
  onRemoveMember,
  categories,
  onChangeCategories,
  onClose,
  isCurrencyLoading,
}) {
  const { t } = useTranslation();
  const myRole = house?.myRole;
  const isAdmin = myRole === "admin";

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div
        className="hm-drawer hm-scroll"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", borderRadius: "0" }}
      >
        <div style={{ padding: "28px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <HomeIcon size={18} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{t("houseSettings.title")}</div>
          </div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label={t("common.close")}>
            <ArrowLeft size={20} />
          </button>
        </div>

        <div style={{ padding: 28, overflowY: "auto", display: "grid", gap: 26, alignContent: "start" }}>
          {!isAdmin && (
            <div
              className="hm-card hm-card--p16"
              style={{ background: "var(--surface-alt)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink-soft)" }}
            >
              <Shield size={15} style={{ flexShrink: 0 }} />
              {t("houseSettings.readOnlyNotice")}
            </div>
          )}

          <CurrencySection
            currency={currency}
            isAdmin={isAdmin}
            onChange={onChangeCurrency}
            isLoading={isCurrencyLoading}
          />

          <HouseMembersSection
            members={members}
            currentUserId={currentUserId}
            currentUserRole={myRole}
            onChangeRole={onChangeMemberRole}
            onRemoveMember={onRemoveMember}
            showIcon
          />

          <CategoriesSection categories={categories} onChange={onChangeCategories} />
        </div>
      </div>
    </div>
  );
}
