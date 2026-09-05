import { useEffect, useState } from "react";
import {
  ArrowLeft, Shield, Repeat, UserMinus, Package, ShoppingCart, CheckSquare,
  Wallet, FileText, Home as HomeIcon, Calendar, Check, X, PiggyBank, Send, Pencil, Archive,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { memberStatsService } from "../../services/memberStatsService";
import { SelectField } from "../SelectField";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

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
  onChangeEconomyAccess,
  onTransferOwnership,
  onRemoveMember,
  childSpace,
  childSpaceLoading = false,
  funderAccounts = [],
  currencyCode = "EUR",
  onCreateChildSpace,
  onFundChildSpace,
  onRenameChildSpace,
  onArchiveChildSpace,
  onClose,
}) {
  const { t, locale } = useTranslation();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [childModal, setChildModal] = useState(null); // 'create' | 'fund' | 'rename' | null

  const isSelf = member?.user_id === viewerUserId;
  const viewerIsAdmin = viewerRole === "admin";
  // economy_role: null = automático (según rol de casa), 'none' = sin acceso
  // explícito, 'contributor'/'manager' = acceso explícito a ese nivel. Ver
  // get_workspace_role() en la base de datos — este selector solo cubre el
  // caso de uso real (dar/quitar Economía a un miembro concreto), no expone
  // 'viewer'/'owner' porque no hay una acción de producto para ellos aquí.
  const economyRole = member?.economy_role;
  const canSeeEconomy = economyRole === "none" ? false : economyRole ? true : member?.role !== "child";
  const canEditEconomyAccess = viewerIsAdmin && !isSelf && member?.role !== "admin";

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
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale === "ca" ? "ca-ES" : "es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(member.joined_at))
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
    { key: "manageHome", label: t("memberDetail.permManageHome"), granted: true },
    { key: "economy", label: t("memberDetail.permEconomy"), granted: canSeeEconomy },
    { key: "invite", label: t("memberDetail.permInvite"), granted: true },
    { key: "manageMembers", label: t("memberDetail.permManageMembers"), granted: member.role === "admin" },
  ];

  const economySelectValue = economyRole || "auto";
  const handleEconomyAccessChange = (value) => {
    onChangeEconomyAccess?.(member.user_id, value === "auto" ? null : value);
  };

  const confirmTransfer = () => onTransferOwnership?.(member);
  const confirmRemove = () => onRemoveMember?.(member);

  return (
    <>
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
            <div className="hm-avatar hm-avatar--lg">
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
                <span className="hm-badge hm-badge--success">
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
                <div key={perm.key} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {perm.granted ? (
                      <Check size={16} style={{ color: "var(--success)", flexShrink: 0 }} />
                    ) : (
                      <X size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 13.5, color: perm.granted ? "var(--ink)" : "var(--ink-soft)" }}>{perm.label}</span>
                  </div>
                  {perm.key === "economy" && canEditEconomyAccess && (
                    <SelectField
                      className="hm-input"
                      style={{ width: "auto", fontSize: 12.5, padding: "4px 8px" }}
                      title={t("memberDetail.economyAccessAria", { name: member.name })}
                      aria-label={t("memberDetail.economyAccessAria", { name: member.name })}
                      value={economySelectValue}
                      onChange={handleEconomyAccessChange}
                      options={[
                        { value: "auto", label: t("memberDetail.economyAccessAuto") },
                        { value: "none", label: t("memberDetail.economyAccessRevoked") },
                        { value: "contributor", label: t("memberDetail.economyAccessContributor") },
                        { value: "manager", label: t("memberDetail.economyAccessManager") },
                      ]}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ESPACIO DE ECONOMÍA DEL NIÑO — solo lo ve/crea el admin de la casa.
              Independiente del selector "Acceso a Economía" de arriba, que es
              para el Workspace del Hogar. */}
          {viewerIsAdmin && !isSelf && member.role === "child" && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{t("memberDetail.childSpaceSectionTitle")}</div>
              <div className="hm-card hm-card--p16" style={{ display: "grid", gap: 12 }}>
                {childSpaceLoading ? (
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("memberDetail.childSpaceLoading")}</div>
                ) : childSpace ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)", display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }}>
                        {childSpace.icon || "🧒"}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{childSpace.name}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t("memberDetail.childSpaceExistsHint", { name: member.name })}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button className="hm-btn hm-btn-primary hm-btn--full" onClick={() => setChildModal("fund")}>
                        <Send size={15} /> {t("memberDetail.childSpaceFundBtn")}
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="hm-btn hm-btn-soft" style={{ flex: 1 }} onClick={() => setChildModal("rename")}>
                          <Pencil size={14} /> {t("memberDetail.childSpaceRenameBtn")}
                        </button>
                        <button className="hm-btn hm-btn-ghost hm-text-danger" style={{ flex: 1 }} onClick={() => onArchiveChildSpace?.()}>
                          <Archive size={14} /> {t("memberDetail.childSpaceArchiveBtn")}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-soft)", fontSize: 13 }}>
                      <PiggyBank size={16} style={{ flexShrink: 0 }} />
                      <span>{t("memberDetail.childSpaceNoneHint", { name: member.name })}</span>
                    </div>
                    <button className="hm-btn hm-btn-primary hm-btn--full" onClick={() => setChildModal("create")}>
                      <PiggyBank size={15} /> {t("memberDetail.childSpaceCreateBtn")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ACCIONES — solo si el que mira es admin y no se está viendo a sí mismo */}
          {viewerIsAdmin && !isSelf && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{t("memberDetail.actionsTitle")}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {member.role !== "admin" && (
                  <div className="hm-card hm-card--p16" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13.5 }}>{t("memberDetail.changeRoleLabel")}</span>
                    <SelectField
                      className="hm-input"
                      style={{ width: "auto" }}
                      title={t("memberDetail.changeRoleLabel")}
                      aria-label={t("shareHome.changeRoleAria", { name: member.name })}
                      value={member.role}
                      onChange={(v) => onChangeRole?.(member.user_id, v)}
                      options={[
                        { value: "adult", label: ROLE_LABELS.adult },
                        { value: "child", label: ROLE_LABELS.child },
                      ]}
                    />
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

    {childModal === "create" && (
      <ChildSpaceNameModal
        title={t("memberDetail.childSpaceCreateBtn")}
        confirmLabel={t("memberDetail.childSpaceCreateBtn")}
        initialValue={t("memberDetail.childSpaceDefaultName", { name: member.name })}
        onClose={() => setChildModal(null)}
        onSubmit={(name) => { setChildModal(null); onCreateChildSpace?.(name, "🧒"); }}
      />
    )}
    {childModal === "rename" && childSpace && (
      <ChildSpaceNameModal
        title={t("memberDetail.childSpaceRenameBtn")}
        confirmLabel={t("memberDetail.childSpaceRenameBtn")}
        initialValue={childSpace.name}
        onClose={() => setChildModal(null)}
        onSubmit={(name) => { setChildModal(null); onRenameChildSpace?.(name); }}
      />
    )}
    {childModal === "fund" && childSpace && (
      <FundChildSpaceModal
        childName={member.name}
        accounts={funderAccounts}
        currencyCode={currencyCode}
        onClose={() => setChildModal(null)}
        onSubmit={(accountId, amount, note) => { setChildModal(null); onFundChildSpace?.(accountId, amount, note); }}
      />
    )}
    </>
  );
}

/** Modal simple de un solo campo (nombre), para crear o renombrar el espacio del niño. */
function ChildSpaceNameModal({ title, confirmLabel, initialValue = "", onClose, onSubmit }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [name, setName] = useState(initialValue);

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    onSubmit(clean);
  };

  return (
    <div className="hm-modal-overlay" style={{ zIndex: 1400 }} onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.cancel")}><X size={20} /></button>
          <h3 className="hm-display hm-modal-title">{title}</h3>
        </div>
        <div className="hm-modal-body">
          <label className="hm-label">{t("memberDetail.childSpaceNameLabel")}</label>
          <input
            className="hm-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder={t("memberDetail.childSpaceNamePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("common.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={submit} disabled={!name.trim()}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal para enviar dinero (paga) al espacio del niño desde una cuenta del adulto. */
function FundChildSpaceModal({ childName, accounts = [], currencyCode = "EUR", onClose, onSubmit }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const numeric = Number(String(amount).replace(",", "."));
  const valid = accountId && Number.isFinite(numeric) && numeric > 0;

  return (
    <div className="hm-modal-overlay" style={{ zIndex: 1400 }} onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.cancel")}><X size={20} /></button>
          <h3 className="hm-display hm-modal-title">{t("memberDetail.childSpaceFundTitle", { name: childName })}</h3>
        </div>
        <div className="hm-modal-body">
          {accounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{t("memberDetail.childSpaceFundNoAccounts")}</p>
          ) : (
            <>
              <label className="hm-label">{t("memberDetail.childSpaceFundFromLabel")}</label>
              <SelectField
                className="hm-input"
                value={accountId}
                onChange={setAccountId}
                options={accounts.map((a) => ({ value: a.id, label: `${a.icon || "💳"} ${a.name} · ${a.spaceName}` }))}
              />
              <label className="hm-label" style={{ marginTop: 12 }}>{t("memberDetail.childSpaceFundAmountLabel", { currency: currencyCode })}</label>
              <input
                className="hm-input"
                inputMode="decimal"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
              <label className="hm-label" style={{ marginTop: 12 }}>{t("memberDetail.childSpaceFundNoteLabel")}</label>
              <input
                className="hm-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("memberDetail.childSpaceFundNotePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && valid && onSubmit(accountId, numeric, note.trim() || null)}
              />
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("common.cancel")}</button>
            <button
              className="hm-btn hm-btn-primary"
              disabled={!valid}
              onClick={() => onSubmit(accountId, numeric, note.trim() || null)}
            >
              {t("memberDetail.childSpaceFundBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
