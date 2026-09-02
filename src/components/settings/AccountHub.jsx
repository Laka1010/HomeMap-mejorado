import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ChevronRight, ExternalLink, User, Lock, Home as HomeIcon, Users, Shield,
  MessageCircle, Info, Eye, EyeOff, Upload, Download, Trash2, LogOut, Share2,
  Languages, Coins, Palette, Bell, Calendar, Crown, Sun, Moon, Smartphone, ShieldAlert,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { LanguageSection } from "./LanguageSection";
import { CurrencySection } from "./CurrencySection";
import { NotificationSection } from "./NotificationSection";
import { SupportSection } from "./SupportSection";
import { AboutSection } from "./AboutSection";
import { securityAdminService } from "../../modules/security/services/securityAdminService";

const ROLE_LABEL_KEY = { admin: "shareHome.roleAdminLabel", adult: "shareHome.roleAdultLabel", child: "shareHome.roleChildLabel" };

/**
 * Centro de cuenta: única puerta de entrada a configuración personal y del
 * hogar (sustituye la pestaña "Perfil" del menú inferior). Es un directorio
 * — la mayoría de filas abren pantallas que ya existían (Settings, Configuración
 * de la casa, Compartir casa); solo "Editar perfil" e "Información del hogar"
 * son vistas nuevas, porque antes vivían sueltas dentro de la vieja pantalla
 * Ajustes y no tenían dónde ir.
 *
 * Las secciones son datos (array), no JSX repetido a mano: añadir una fila
 * futura (foto de perfil, cambiar email, reportar un bug...) es añadir un
 * objeto a `rows`, no reorganizar el árbol de componentes. Ver `buildSections`.
 */
export function AccountHub({
  state,
  currentHome,
  houseMembers,
  user,
  onUpdateProfile,
  onRenameHouse,
  onChangePassword,
  onLogout,
  onDeleteAccount,
  onImportData,
  onExportData,
  isExporting,
  locale,
  theme,
  notifications,
  currency,
  onChangeLanguage,
  onChangeTheme,
  onToggleNotificationCategory,
  onChangeNotificationLevel,
  onChangeCurrency,
  isCurrencyLoading,
  build,
  openModal,
  onClose,
  version,
}) {
  const { t } = useTranslation();
  // null | "editProfile" | "homeInfo" | "language" | "currency" | "appearance"
  // | "notifications" | "support" | "about" — cada una es una pantalla propia,
  // de responsabilidad única, en vez de reutilizar la vieja pantalla "Ajustes"
  // que las mezclaba todas. Ver `renderView` más abajo.
  const [view, setView] = useState(null);

  // Entrada al Security Center: solo UX (evita mostrar la fila a quien no
  // la va a poder usar). La protección real es server-side — is_security_
  // admin() se vuelve a comprobar dentro de cada RPC del panel, así que
  // ocultar o no esta fila no cambia nada sobre quién puede actuar de
  // verdad. Ser admin de ESTA casa no influye aquí en absoluto.
  const [isSecurityAdmin, setIsSecurityAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    securityAdminService.amISecurityAdmin()
      .then((v) => { if (!cancelled) setIsSecurityAdmin(v); })
      .catch(() => { if (!cancelled) setIsSecurityAdmin(false); });
    return () => { cancelled = true; };
  }, []);
  const profile = state.profile;
  const isAdmin = currentHome?.myRole === "admin";

  const displayName = [profile.userName, profile.lastName].filter(Boolean).join(" ") || user?.name || t("common.userFallback");
  const displayEmail = profile.email || user?.email || "";
  const initials = displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const ownerMember = (houseMembers || []).find((m) => m.role === "admin");
  const ownerName = ownerMember?.name || (isAdmin ? displayName : null);

  const sections = buildSections({
    t, isExporting, onExportData, onImportData,
    setView, openModal, profile, onUpdateProfile, version, theme, onChangeTheme,
  });
  const dangerRows = buildDangerRows({ t, onLogout, onDeleteAccount });

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div className="hm-drawer profile-drawer hm-scroll" onClick={(e) => e.stopPropagation()} style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", borderRadius: "0" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <button
            className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center"
            onClick={() => (view ? setView(null) : onClose())}
            aria-label={view ? t("wizard.back") : t("common.close")}
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="hm-scroll" style={{ overflowY: "auto", padding: "8px 24px 44px" }}>
          <div key={view || "list"} className="hm-fade-in">
            {view === "editProfile" ? (
              <EditProfileView profile={profile} onUpdateProfile={onUpdateProfile} t={t} />
            ) : view === "changePassword" ? (
              <ChangePasswordView onChangePassword={onChangePassword} onDone={() => setView(null)} t={t} />
            ) : view === "homeInfo" ? (
              <HomeInfoView
                currentHome={currentHome}
                isAdmin={isAdmin}
                onRenameHouse={onRenameHouse}
                ownerName={ownerName}
                locale={locale}
                onShare={() => openModal("shareHome", null, { returnTo: "accountHub" })}
                t={t}
              />
            ) : view === "language" ? (
              <LanguageSection locale={locale} onChange={onChangeLanguage} />
            ) : view === "currency" ? (
              <CurrencySection currency={currency} isAdmin={isAdmin} onChange={onChangeCurrency} isLoading={isCurrencyLoading} />
            ) : view === "notifications" ? (
              <NotificationSection notifications={notifications} onToggleCategory={onToggleNotificationCategory} onChangeLevel={onChangeNotificationLevel} />
            ) : view === "support" ? (
              <SupportSection />
            ) : view === "about" ? (
              <AboutSection version={version} build={build} />
            ) : (
              <>
                <ProfileHeader
                  avatar={user?.avatar}
                  initials={initials}
                  displayName={displayName}
                  displayEmail={displayEmail}
                  role={currentHome?.myRole}
                  homeName={currentHome?.name}
                  t={t}
                />

                {sections.map((section) => (
                  <HubSection key={section.id} icon={section.icon} color={section.color} title={section.title}>
                    {section.rows.map((row, idx) => (
                      <HubRow key={row.id} {...row} isLast={idx === section.rows.length - 1} sectionColor={section.color} />
                    ))}
                  </HubSection>
                ))}

                {isSecurityAdmin && (
                  <HubSection icon={ShieldAlert} color="var(--danger)" title="Security Center">
                    <HubRow
                      id="securityCenter"
                      icon={ShieldAlert}
                      label="Security Center"
                      kind="nav"
                      isLast
                      sectionColor="var(--danger)"
                      onClick={() => openModal("securityCenter", null, { returnTo: "accountHub" })}
                    />
                  </HubSection>
                )}

                <HubSection>
                  {dangerRows.map((row, idx) => (
                    <HubRow key={row.id} {...row} isLast={idx === dangerRows.length - 1} />
                  ))}
                </HubSection>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileHeader({ avatar, initials, displayName, displayEmail, role, homeName, t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "16px 0 36px" }}>
      <div
        className="hm-avatar hm-avatar--xl"
        style={{
          marginBottom: 18,
          boxShadow: "0 10px 26px rgba(94,140,97,0.18)", border: "3px solid var(--surface)", outline: "1px solid var(--border)",
        }}
      >
        {avatar ? <img src={avatar} alt="" /> : initials}
      </div>
      <div className="hm-display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{displayName}</div>
      {displayEmail && <div style={{ marginTop: 5, fontSize: 13.5, color: "var(--ink-soft)" }}>{displayEmail}</div>}
      {(role || homeName) && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {role && (
            <span className="hm-badge hm-badge--accent">
              {t(ROLE_LABEL_KEY[role] || "shareHome.roleAdultLabel")}
            </span>
          )}
          {homeName && (
            <span className="hm-badge hm-badge--neutral">
              <HomeIcon size={12} /> {homeName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Datos, no JSX — pensado para crecer. Una fila futura (foto de perfil,
 * cambiar email, reportar un bug, changelog...) se añade aquí como un objeto
 * más en `rows` el día que exista de verdad la función detrás; hasta
 * entonces no se fabrica un botón sin nada que hacer.
 *
 * `kind` decide el elemento final de la fila: "nav" (abre una pantalla,
 * muestra chevron), "external" (sale de la app, muestra icono de enlace) o
 * "action" (se ejecuta al momento, sin indicador de navegación).
 */
function buildSections({ t, isExporting, onExportData, onImportData, setView, openModal, profile, onUpdateProfile, version, theme, onChangeTheme }) {
  return [
    {
      id: "account",
      icon: User,
      color: "var(--accent)",
      title: t("settings.accountSection"),
      rows: [
        { id: "editProfile", icon: User, label: t("accountHub.editProfile"), kind: "nav", onClick: () => setView("editProfile") },
        { id: "changePassword", icon: Lock, label: t("settings.changePassword"), kind: "nav", onClick: () => setView("changePassword") },
      ],
    },
    {
      id: "home",
      icon: HomeIcon,
      color: "var(--pin)",
      title: t("accountHub.homeSection"),
      rows: [
        { id: "homeInfo", icon: HomeIcon, label: t("accountHub.homeInformation"), kind: "nav", onClick: () => setView("homeInfo") },
        { id: "members", icon: Users, label: t("accountHub.membersRoles"), kind: "nav", onClick: () => openModal("houseSettings", null, { returnTo: "accountHub" }) },
        { id: "shareHome", icon: Share2, label: t("home.shareTitle"), kind: "nav", onClick: () => openModal("shareHome", null, { returnTo: "accountHub" }) },
      ],
    },
    {
      id: "preferences",
      icon: Palette,
      color: "var(--chart-income)",
      title: t("accountHub.preferencesSection"),
      rows: [
        { id: "language", icon: Languages, label: t("settings.languageSection"), kind: "nav", onClick: () => setView("language") },
        { id: "currency", icon: Coins, label: t("settings.currency"), kind: "nav", onClick: () => setView("currency") },
        { id: "appearance", custom: true, render: (isLast) => <AppearanceRow theme={theme} onChange={onChangeTheme} t={t} isLast={isLast} /> },
        { id: "notifications", icon: Bell, label: t("settings.notificationsSection"), kind: "nav", onClick: () => setView("notifications") },
        { id: "units", custom: true, render: (isLast) => <UnitsRow profile={profile} onUpdateProfile={onUpdateProfile} t={t} isLast={isLast} /> },
      ],
    },
    {
      id: "privacy",
      icon: Shield,
      color: "var(--chart-category)",
      title: t("accountHub.privacySection"),
      rows: [
        { id: "privacyPolicy", icon: Shield, label: t("ajustes.privacyPolicy"), kind: "external", href: "/privacy-policy.html" },
        { id: "terms", icon: Shield, label: t("ajustes.terms"), kind: "external", href: "/terms.html" },
        { id: "export", icon: Download, label: isExporting ? t("ajustes.exporting") : t("ajustes.exportData"), kind: "action", onClick: onExportData, disabled: isExporting },
        { id: "import", custom: true, render: () => <ImportRow onImportData={onImportData} t={t} /> },
      ],
    },
    {
      id: "support",
      icon: MessageCircle,
      color: "var(--chart-warning)",
      title: t("settings.supportSection"),
      rows: [
        { id: "contactSupport", icon: MessageCircle, label: t("settings.contactSupport"), kind: "nav", onClick: () => setView("support") },
      ],
    },
    {
      id: "about",
      icon: Info,
      color: "var(--ink-soft)",
      title: t("settings.aboutSection"),
      rows: [
        { id: "appVersion", icon: Info, label: t("accountHub.appVersion"), kind: "nav", trailingText: version ? `v${version}` : undefined, onClick: () => setView("about") },
      ],
    },
  ];
}

function buildDangerRows({ t, onLogout, onDeleteAccount }) {
  return [
    { id: "logout", icon: LogOut, label: t("settings.signOut"), kind: "action", danger: true, onClick: onLogout },
    { id: "deleteAccount", icon: Trash2, label: t("ajustes.deleteAccount"), kind: "action", danger: true, onClick: onDeleteAccount },
  ];
}

function HubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <div style={{ marginBottom: 10, paddingLeft: 2 }}>
          <span style={{ color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
        </div>
      )}
      <div className="hm-card" style={{ overflow: "hidden", padding: "4px 0" }}>
        {children}
      </div>
    </div>
  );
}

function IconBadge({ icon: Icon, color }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 9, background: color, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon size={16} color="#fff" strokeWidth={2.25} />
    </div>
  );
}

function HubRow({ icon: Icon, label, onClick, href, kind = "nav", danger, disabled, isLast, sectionColor, trailingText, custom, render }) {
  if (custom) return render(isLast);

  const trailingIcon =
    kind === "nav" ? <ChevronRight size={16} style={{ color: "var(--border)", flexShrink: 0 }} />
    : kind === "external" ? <ExternalLink size={14} style={{ color: "var(--border)", flexShrink: 0 }} />
    : null;

  const content = (
    <>
      <IconBadge icon={Icon} color={danger ? "var(--danger)" : sectionColor} />
      <span style={{ flex: 1, fontSize: 15, color: danger ? "var(--danger)" : "var(--ink)", fontWeight: 500 }}>{label}</span>
      {trailingText && <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>{trailingText}</span>}
      {trailingIcon}
    </>
  );
  const style = {
    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px",
    background: "transparent", border: "none", borderBottom: isLast ? "none" : "1px solid var(--border)",
    cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", textDecoration: "none",
    opacity: disabled ? 0.6 : 1,
  };
  if (href) {
    return <a className="hm-tap" href={href} target="_blank" rel="noreferrer" style={style}>{content}</a>;
  }
  return <button className="hm-tap" onClick={onClick} disabled={disabled} style={style}>{content}</button>;
}

function UnitsRow({ profile, onUpdateProfile, t, isLast }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <IconBadge icon={Palette} color="var(--chart-income)" />
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{t("ajustes.unitsLabel")}</span>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 999, padding: 3 }}>
        {["cm", "in"].map((unit) => (
          <button
            key={unit}
            className="hm-tap"
            onClick={() => onUpdateProfile({ units: unit })}
            style={{
              border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700,
              cursor: "pointer", background: profile.units === unit ? "var(--accent)" : "transparent",
              color: profile.units === unit ? "var(--accent-ink)" : "var(--ink-soft)",
            }}
          >
            {unit === "cm" ? t("ajustes.unitsCm") : t("ajustes.unitsIn")}
          </button>
        ))}
      </div>
    </div>
  );
}

const APPEARANCE_OPTIONS = [
  { value: "light", icon: Sun, labelKey: "settings.appearance.light" },
  { value: "dark", icon: Moon, labelKey: "settings.appearance.dark" },
  { value: "system", icon: Smartphone, labelKey: "settings.appearance.systemShort" },
];

function AppearanceRow({ theme, onChange, t, isLast }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <IconBadge icon={Palette} color="var(--chart-income)" />
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{t("settings.appearanceSection")}</span>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 999, padding: 3 }}>
        {APPEARANCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = theme === option.value;
          const label = t(option.labelKey);
          return (
            <button
              key={option.value}
              className="hm-tap"
              onClick={() => onChange(option.value)}
              aria-label={label}
              title={label}
              style={{
                border: "none", borderRadius: 999, padding: "6px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--accent-ink)" : "var(--ink-soft)",
              }}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImportRow({ onImportData, t }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onImportData(file);
        }}
      />
      <HubRow icon={Upload} label={t("ajustes.importData")} kind="action" onClick={() => inputRef.current?.click()} sectionColor="var(--chart-category)" />
    </>
  );
}

function EditProfileView({ profile, onUpdateProfile, t }) {
  return (
    <div>
      <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 20px" }}>{t("accountHub.editProfile")}</h1>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <div>
          <label className="hm-label">{t("settings.nameLabel")}</label>
          <input className="hm-input" value={profile.userName} onChange={(e) => onUpdateProfile({ userName: e.target.value })} />
        </div>
        <div>
          <label className="hm-label">{t("settings.lastNameLabel")}</label>
          <input className="hm-input" value={profile.lastName || ""} onChange={(e) => onUpdateProfile({ lastName: e.target.value })} />
        </div>
        <div>
          <label className="hm-label">{t("settings.emailLabel")}</label>
          <input className="hm-input" value={profile.email || ""} disabled />
        </div>
      </div>
    </div>
  );
}

function ChangePasswordView({ onChangePassword, onDone, t }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      setError(t("settings.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("settings.passwordMismatch"));
      return;
    }
    setError("");
    setLoading(true);
    const success = await onChangePassword(newPassword);
    setLoading(false);
    if (success) onDone();
  };

  return (
    <div>
      <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 20px" }}>{t("settings.changePassword")}</h1>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        {error && <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>{error}</div>}
        <div>
          <label className="hm-label">{t("settings.newPasswordLabel")}</label>
          <input
            type="password"
            autoComplete="new-password"
            className="hm-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="hm-label">{t("settings.confirmPasswordLabel")}</label>
          <input
            type="password"
            autoComplete="new-password"
            className="hm-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
        </div>
      </div>

      <button
        className="hm-btn hm-btn-primary hm-btn--full hm-mt-20"
        style={{ maxWidth: 480 }}
        disabled={loading || !newPassword || !confirmPassword}
        onClick={handleSubmit}
      >
        {t("settings.changePasswordButton")}
      </button>
    </div>
  );
}

function HomeInfoView({ currentHome, isAdmin, onRenameHouse, ownerName, locale, onShare, t }) {
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentHome?.name || "");
  useEffect(() => setNameDraft(currentHome?.name || ""), [currentHome?.id, currentHome?.name]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(currentHome.name);
      return;
    }
    if (trimmed !== currentHome.name) onRenameHouse(currentHome.id, trimmed);
  };

  const comingSoon = t("accountHub.comingSoon");
  const memberCount = Number.isFinite(currentHome?.memberCount) ? currentHome.memberCount : null;
  const createdLabel = currentHome?.createdAt
    ? new Date(currentHome.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale === "ca" ? "ca-ES" : "es-ES", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div>
      <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 20px" }}>{t("accountHub.homeInformation")}</h1>
      <div className="hm-card hm-card--p20" style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <div>
          <label className="hm-label">{t("ajustes.homeNameLabel")}</label>
          <input
            className="hm-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <label className="hm-label">{t("ajustes.codeLabel")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="hm-mono" style={{ fontWeight: 600, color: "var(--accent)", fontSize: 15 }}>
              {showInviteCode ? (currentHome?.inviteCode || t("ajustes.notAvailable")) : "********"}
            </span>
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              style={{ padding: 4 }}
              onClick={() => setShowInviteCode((v) => !v)}
              aria-label={showInviteCode ? t("ajustes.hideCodeAria") : t("ajustes.revealCodeAria")}
              title={showInviteCode ? t("ajustes.hideCode") : t("ajustes.revealCode")}
            >
              {showInviteCode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <InfoRow icon={Users} label={t("accountHub.homeInfoMembersLabel")} value={memberCount != null ? String(memberCount) : comingSoon} muted={memberCount == null} />
        <InfoRow icon={Crown} label={t("accountHub.homeInfoOwnerLabel")} value={ownerName || comingSoon} muted={!ownerName} />
        <InfoRow icon={Calendar} label={t("accountHub.homeInfoCreatedLabel")} value={createdLabel || comingSoon} muted={!createdLabel} />
      </div>

      <button className="hm-btn hm-btn-primary hm-btn--full hm-mt-20" style={{ maxWidth: 480 }} onClick={onShare}>
        <Share2 size={16} /> {t("home.shareTitle")}
      </button>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, muted }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>
        <Icon size={15} /> {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: muted ? "var(--ink-soft)" : "var(--ink)", fontStyle: muted ? "italic" : "normal" }}>
        {value}
      </span>
    </div>
  );
}
