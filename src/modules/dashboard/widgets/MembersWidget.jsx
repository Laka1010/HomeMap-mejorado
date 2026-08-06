import { Users, Shield } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { WidgetCard } from "./WidgetCard";

const ROLE_KEY = { admin: "shareHome.roleAdminLabel", adult: "shareHome.roleAdultLabel", child: "shareHome.roleChildLabel" };

/** Miembros reales de la casa (no datos de ejemplo), máximo 5. */
export function MembersWidget({ members }) {
  const { t } = useTranslation();
  const list = (Array.isArray(members) ? members : []).slice(0, 5);
  if (list.length === 0) return null;

  return (
    <WidgetCard icon={Users} title={t("dashboardOverview.membersTitle")}>
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((member) => {
          const name = member.name || member.email || t("membersModule.roleMember");
          const role = member.role;
          return (
            <div key={member.user_id || member.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="hm-avatar hm-avatar--sm">
                {name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 11.5, color: role === "admin" ? "var(--pin)" : "var(--ink-soft)", display: "flex", alignItems: "center", gap: 4 }}>
                  {role === "admin" && <Shield size={10} />}
                  {t(ROLE_KEY[role] || "shareHome.roleAdultLabel")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
