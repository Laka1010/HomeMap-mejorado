import { memo } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "../i18n";

export const AppHeader = memo(function AppHeader({ user, profile, currentHome, onOpenHomeSelector, onOpenNotifications, onOpenAccountHub, onOpenSearch, unreadNotifications = 0, showNotifications = true }) {
  const { t } = useTranslation();

  const displayedName = [profile.userName, profile.lastName].filter(Boolean).join(" ") || user?.name || t("common.userFallback");

  const initials = displayedName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 12, width: "100%", paddingBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button
          type="button"
          onClick={onOpenAccountHub}
          className="hm-btn hm-btn-soft"
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            borderRadius: "50%",
            padding: 0,
            background: "var(--surface)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent)",
            fontSize: 15,
            fontWeight: 700,
            flexShrink: 0,
            overflow: "hidden",
            border: "1px solid var(--border)",
            cursor: "pointer",
            transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
          }}
          aria-label={t("settings.profileButton")}
          title={t("settings.profileButton")}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          {initials}
        </button>

        <button
          type="button"
          className="hm-btn hm-btn-ghost"
          onClick={onOpenHomeSelector}
          style={{
            padding: 0,
            minWidth: 0,
            height: "auto",
            border: "none",
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
            fontSize: 15,
            color: "var(--ink)",
          }}
          aria-label={t("common.changeHome")}
          title={t("common.changeHome")}
        >
          <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{currentHome?.name || profile.homeName || t("home.defaultName")}</strong>
          <ChevronDown size={14} style={{ color: "var(--ink-soft)" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifySelf: "end" }}>
        {onOpenSearch && (
          <button
            className="hm-btn hm-btn-soft"
            style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, borderRadius: "50%", justifyContent: "center", border: "1px solid var(--border)", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            onClick={onOpenSearch}
            aria-label={t("search.title")}
            title={t("search.title")}
          >
            <Search size={18} />
          </button>
        )}
        {showNotifications && (
          <button
            className="hm-btn hm-btn-soft"
            style={{ position: "relative", overflow: "visible", width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, borderRadius: "50%", justifyContent: "center", border: "1px solid var(--border)", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            onClick={onOpenNotifications}
            aria-label={t("header.notifications")}
            title={t("header.notifications")}
          >
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span
                className="hm-mono"
                style={{
                  position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 3px",
                  borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  border: "2px solid var(--surface)",
                }}
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
});
