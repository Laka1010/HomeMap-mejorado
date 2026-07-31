import { useState } from "react";
import { User, Lock, ArrowRight } from "lucide-react";
import { useTranslation } from "../../i18n";

export function ProfileSection({ profile, onUpdateProfile, onLogout, onChangePassword }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(true);

  return (
    <section className="hm-fade-in" style={{ display: "grid", gap: 14 }}>
      <button
        type="button"
        className="hm-card hm-btn hm-card--p18"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          justifyContent: "space-between",
          textAlign: "left",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          color: "var(--ink)",
        }}
        onClick={() => setShowDetails((prev) => !prev)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: "var(--surface-alt)", display: "grid", placeItems: "center", fontSize: 28, color: "var(--accent)", border: "1px solid var(--border)" }}>
            {profile.avatar ? <img src={profile.avatar} alt={profile.userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 24 }} /> : <User size={28} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" }}>{profile.userName}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.email || t("settings.emailLabel")}</div>
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--accent)" }}>
          {t("settings.profileButton")} <ArrowRight size={18} style={{ transform: showDetails ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
        </span>
      </button>

      {showDetails && (
        <div className="hm-card hm-pop hm-card--p18" style={{ display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("settings.accountSection")}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("settings.profilePhoto")}</div>
          </div>

          <label className="hm-label">{t("settings.nameLabel")}</label>
          <input className="hm-input" value={profile.userName} onChange={(e) => onUpdateProfile({ userName: e.target.value })} />

          <label className="hm-label">{t("settings.lastNameLabel")}</label>
          <input className="hm-input" value={profile.lastName || ""} onChange={(e) => onUpdateProfile({ lastName: e.target.value })} />

          <label className="hm-label">{t("settings.emailLabel")}</label>
          <input className="hm-input" value={profile.email || ""} disabled />

          <div style={{ display: "grid", gap: 10 }}>
            <button className="hm-btn hm-btn-soft" onClick={onChangePassword}>
              <Lock size={16} /> {t("settings.changePassword")}
            </button>
            <button className="hm-btn hm-btn-primary" onClick={onLogout}>
              <ArrowRight size={16} /> {t("settings.signOut")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
