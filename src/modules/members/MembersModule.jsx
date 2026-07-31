import { Users } from "lucide-react";
import { ModuleCard } from "../core/ModuleCard";
import { useTranslation } from "../../i18n";

export function MembersModule({ state }) {
  const { t } = useTranslation();
  const ROLE_LABELS = { admin: t("membersModule.roleAdmin"), adult: t("membersModule.roleAdult"), child: t("membersModule.roleChild") };
  const roleLabel = (role) => ROLE_LABELS[role] || role || t("membersModule.roleMember");
  const members = Array.isArray(state.members) ? state.members : [];
  const activity = Array.isArray(state.activity) ? state.activity : [];

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 className="hm-display" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{t("membersModule.title")}</h1>
        <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 4 }}>{t("membersModule.subtitle")}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {members.length === 0 ? (
          <ModuleCard icon={Users} title={t("membersModule.addMembersTitle")} subtitle={t("membersModule.addMembersSubtitle")} badge={t("membersModule.familyBadge")} />
        ) : (
          // `id` es el nombre del miembro de ejemplo (DEMO_MEMBERS); los
          // miembros reales (houseService.getHouseMembers / import de un
          // export con datos reales) usan `user_id` y no tienen `tasks`.
          members.map((member) => (
            <ModuleCard key={member.id || member.user_id} icon={Users} title={member.name} subtitle={roleLabel(member.role)} badge={member.tasks ?? ""}>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{activity[0]?.title || t("membersModule.noActivity")}</div>
            </ModuleCard>
          ))
        )}
      </div>
    </div>
  );
}
