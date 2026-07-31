import { Shield, UserMinus, Users } from "lucide-react";
import { useTranslation } from "../../i18n";

/**
 * Lista de miembros de la casa con su rol. Compartida por la configuración de
 * la casa y el modal de compartir, para que la gestión de roles viva en un
 * único sitio.
 *
 * Acepta tanto la forma cruda de houseService.getHouseMembers (`user_id`) como
 * la ya mapeada (`id` + `isYou`). El admin no aparece con controles: su rol no
 * se puede cambiar ni se le puede expulsar (lo impide también set_member_role /
 * remove_member en la base de datos).
 */
export function HouseMembersSection({
  members = [],
  currentUserId,
  currentUserRole,
  onChangeRole,
  onRemoveMember,
  onMemberClick,
  showIcon = false,
}) {
  const { t } = useTranslation();
  const ROLE_LABELS = {
    admin: t("shareHome.roleAdminLabel"),
    adult: t("shareHome.roleAdultLabel"),
    child: t("shareHome.roleChildLabel"),
  };

  const isAdmin = currentUserRole === "admin";
  const rows = members.map((m) => {
    const id = m.user_id ?? m.id;
    return {
      id,
      name: m.name || m.email || t("membersModule.roleMember"),
      role: m.role,
      joinedAt: m.joined_at,
      isYou: m.isYou ?? (currentUserId ? id === currentUserId : false),
    };
  });

  return (
    <div className="hm-members-section">
      <div className="hm-members-header">
        {showIcon && (
          <div className="hm-members-icon">
            <Users size={16} />
          </div>
        )}
        <div>
          <label className="hm-label" style={{ margin: 0 }}>
            {t("shareHome.membersLabel", { count: rows.length })}
          </label>
          {showIcon && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              {isAdmin ? t("houseSettings.membersHintAdmin") : t("houseSettings.membersHintReadOnly")}
            </div>
          )}
        </div>
      </div>

      <div className="hm-members-list">
        {rows.map((member) => {
          const canManage = isAdmin && !member.isYou && member.role !== "admin";
          const clickable = isAdmin && !!onMemberClick;
          return (
            <div
              key={member.id}
              className="hm-member-item"
              onClick={clickable ? () => onMemberClick({ user_id: member.id, name: member.name, role: member.role, joined_at: member.joinedAt }) : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              <div className="hm-member-avatar">{member.name.charAt(0).toUpperCase()}</div>
              <div className="hm-member-info">
                <div className="hm-member-name">
                  <span className="hm-member-name-text">{member.name}</span>
                  {member.isYou && <span className="hm-you-pill">{t("shareHome.youPill")}</span>}
                </div>
                <div className="hm-member-role">
                  {member.role === "admin" ? (
                    <span className="hm-role-owner"><Shield size={12} /> {ROLE_LABELS.admin}</span>
                  ) : (
                    <span className="hm-role-editor">{ROLE_LABELS[member.role] || member.role}</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="hm-member-actions" onClick={(e) => e.stopPropagation()}>
                  <select
                    className="hm-input hm-role-select"
                    value={member.role}
                    onChange={(e) => onChangeRole?.(member.id, e.target.value)}
                    aria-label={t("shareHome.changeRoleAria", { name: member.name })}
                  >
                    <option value="adult">{ROLE_LABELS.adult}</option>
                    <option value="child">{ROLE_LABELS.child}</option>
                  </select>
                  <button
                    className="hm-btn hm-btn-ghost hm-remove-btn"
                    onClick={() => onRemoveMember?.(member.id)}
                    title={t("shareHome.removeFromHomeAria")}
                    aria-label={t("shareHome.removeFromHomeAria")}
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .hm-members-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .hm-members-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent-soft);
          color: var(--accent);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .hm-members-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .hm-member-item {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 14px;
          padding: 10px;
          border-radius: 14px;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .hm-member-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--accent-ink);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          flex-shrink: 0;
        }
        .hm-member-info {
          flex: 1 1 140px;
          min-width: 140px;
          overflow: hidden;
        }
        .hm-member-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .hm-member-name {
          font-weight: 700;
          font-size: 14.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hm-member-name-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .hm-you-pill {
          font-size: 10px;
          background: var(--surface-alt);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--ink-soft);
          text-transform: uppercase;
          font-weight: 700;
        }
        .hm-member-role {
          font-size: 12px;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hm-role-owner {
          color: var(--pin);
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }
        .hm-role-editor {
          color: var(--ink-soft);
        }
        .hm-role-select {
          width: auto;
          min-height: 34px;
          height: 34px;
          padding: 0 8px;
          font-size: 12px;
          flex-shrink: 0;
        }
        .hm-remove-btn {
          color: var(--ink-soft) !important;
          padding: 8px !important;
          flex-shrink: 0;
        }
        .hm-remove-btn:hover {
          color: var(--danger) !important;
          background: var(--danger-soft) !important;
        }
      `}</style>
    </div>
  );
}
