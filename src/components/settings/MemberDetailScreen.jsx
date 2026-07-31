import { useEffect, useState } from "react";
import {
  ArrowLeft, Shield, Repeat, UserMinus, Package, ShoppingCart, CheckSquare,
  Wallet, FileText, Home as HomeIcon, Calendar, Check, X,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { memberStatsService } from "../../services/memberStatsService";

/**
 * Información del miembro — solo Owner/Admin puede llegar aquí (ver
 * HouseMembersSection: la fila solo es clicable si el que mira es admin).
 * Filosofía: gestionar el hogar, no vigilar a la persona. Por eso NO se
 * pinta el email (solo lo ve el propio usuario en "Editar perfil"), ni
 * nada de dispositivo/IP/idioma/tema — todo lo que se muestra es
 * información del hogar (rol, fecha de alta, cuánto ha aportado al hogar),
 * no de la cuenta personal del miembro.
 */
export function MemberDetailScreen({
  member,
  houseId,
  viewerRole,
  viewerUserId,
  onChangeRole,
  onTransferOwnership,
  onRemoveMember,
  onClose,
}) {
  const { t, locale } = useTranslation();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);

  const isSelf = member?.user_id === viewerUserId;
  const viewerIsAdmin = viewerRole === "admin";
  const canSeeEconomy = member?.role !== "child";

  useEffect(() => {
    let cancelled = false;
    if (!houseId || !member?.user_id) return;
    setStats(null);
    setStatsError(false);
    memberStatsService
      .getMemberStats(houseId, member.user_id, { includeEconomy: canSeeEconomy })
      .then((result) => { if (!cancelled) setStats(result); })
      .catch((error) => {
        console.error("Error loading member stats:", error);
        if (!cancelled) setStatsError(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, member?.user_id, canSeeEconomy]);

  if (!member) return null;

  const ROLE_LABELS = {
    admin: t("shareHome.roleAdminLabel"),
    adult: t("shareHome.roleAdultLabel"),
    child: t("shareHome.roleChildLabel"),
  };

  const joinedLabel = member.joined_at
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(member.joined_at))
    : null;

  const statCards = [
    { key: "objectsAdded", icon: Package, label: t("memberDetail.statObjects"), value: stats?.objectsAdded },
    { key: "roomsCreated", icon: HomeIcon, label: t("memberDetail.statRooms"), value: stats?.roomsCreated },
    { key: "purchasesCreated", icon: ShoppingCart, label: t("memberDetail.statPurchases"), value: stats?.purchasesCreated },
    { key: "tasksCompleted", icon: CheckSquare, label: t("memberDetail.statTasks"), value: stats?.tasksCompleted },
    ...(canSeeEconomy ? [
      { key: "expensesRegistered", icon: Wallet, label: t("memberDetail.statExpenses"), value: stats?.expensesRegistered },
      { key: "billsRegistered", icon: FileText, label: t("memberDetail.statBills"), value: stats?.billsRegistered },
    ] : []),
  ];

  const permissions = [
    { label: t("memberDetail.permManageHome"), granted: true },
    { label: t("memberDetail.permEconomy"), granted: canSeeEconomy },
    { label: t("memberDetail.permInvite"), granted: true },
    { label: t("memberDetail.permManageMembers"), granted: member.role === "admin" },
  ];

  const confirmTransfer = () => onTransferOwnership?.(member);
  const confirmRemove = () => onRemoveMember?.(member);

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div
        className="hm-drawer hm-scroll"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", borderRadius: "0" }}
      >
        <div style={{ padding: "28px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t("memberDetail.title")}</div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label={t("common.close")}>
            <ArrowLeft size={20} />
          </button>
        </div>

        <div style={{ padding: 28, overflowY: "auto", display: "grid", gap: 26, alignContent: "start" }}>
          {/* CABECERA */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 26, flexShrink: 0 }}>
              {member.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="hm-display" style={{ fontSize: 20, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {member.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {member.role === "admin" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--pin)", fontWeight: 600, fontSize: 13 }}>
                    <Shield size={13} /> {ROLE_LABELS.admin}
                  </span>
                ) : (
                  <span style={{ color: "var(--ink-soft)", fontWeight: 600, fontSize: 13 }}>{ROLE_LABELS[member.role] || member.role}</span>
                )}
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", padding: "3px 9px", borderRadius: 999 }}>
                  {t("memberDetail.statusActive")}
                </span>
              </div>
              {joinedLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                  <Calendar size={13} /> {t("memberDetail.joinedOn", { date: joinedLabel })}
                </div>
              )}
            </div>
          </div>

          {/* RESUMEN DE ACTIVIDAD */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{t("memberDetail.activityTitle")}</div>
            {statsError ? (
              <div className="hm-card hm-card--p16" style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("memberDetail.statsError")}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {statCards.map(({ key, icon: Icon, label, value }) => (
                  <div key={key} className="hm-card hm-card--p16" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                      <Icon size={15} />
                    </div>
                    <div className="hm-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                      {value === undefined ? "—" : value}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PERMISOS */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{t("memberDetail.permissionsTitle")}</div>
            <div className="hm-card hm-card--p16" style={{ display: "grid", gap: 10 }}>
              {permissions.map((perm) => (
                <div key={perm.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {perm.granted ? (
                    <Check size={16} style={{ color: "var(--success)", flexShrink: 0 }} />
                  ) : (
                    <X size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 13.5, color: perm.granted ? "var(--ink)" : "var(--ink-soft)" }}>{perm.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ACCIONES — solo si el que mira es admin y no se está viendo a sí mismo */}
          {viewerIsAdmin && !isSelf && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{t("memberDetail.actionsTitle")}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {member.role !== "admin" && (
                  <div className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13.5 }}>{t("memberDetail.changeRoleLabel")}</span>
                    <select
                      className="hm-input"
                      style={{ width: "auto" }}
                      value={member.role}
                      onChange={(e) => onChangeRole?.(member.user_id, e.target.value)}
                      aria-label={t("shareHome.changeRoleAria", { name: member.name })}
                    >
                      <option value="adult">{ROLE_LABELS.adult}</option>
                      <option value="child">{ROLE_LABELS.child}</option>
                    </select>
                  </div>
                )}

                {member.role !== "admin" && (
                  <button className="hm-btn hm-btn-soft hm-btn--full" onClick={confirmTransfer}>
                    <Repeat size={15} /> {t("memberDetail.transferOwnership")}
                  </button>
                )}

                {member.role !== "admin" && (
                  <button className="hm-btn hm-btn-ghost hm-btn--full hm-text-danger" onClick={confirmRemove}>
                    <UserMinus size={15} /> {t("memberDetail.removeMember")}
                  </button>
                )}

                {member.role === "admin" && (
                  <div className="hm-card hm-card--p16" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                    {t("memberDetail.ownerNoActions")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
