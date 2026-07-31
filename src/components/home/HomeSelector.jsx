import { useState } from "react";
import { Home, Plus, Users, ChevronRight, Hash, Check, Star, X } from "lucide-react";
import { useTranslation } from "../../i18n";

export function HomeSelector({ homes, currentHomeId, onSelect, onOpenCreate, onJoin, onClose, canCreateHome = true }) {
  const { t } = useTranslation();
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      onJoin(inviteCode.trim());
      setShowJoin(false);
      setInviteCode("");
    }
  };

  return (
    <div className="home-selector-container hm-fade-in">
      <div className="home-selector-header">
        <div className="home-selector-header-row">
          <h2 className="hm-display home-selector-title">{t("homeSelector.title")}</h2>
          {onClose && (
            <button className="hm-modal-close home-selector-close" onClick={onClose} aria-label={t("homeSelector.closeAria")}>
              <X size={20} />
            </button>
          )}
        </div>
        <p className="home-selector-subtitle">{t("homeSelector.subtitle")}</p>
      </div>

      <div className="homes-list">
        {homes.map((home) => (
          <button
            key={home.id}
            className={`home-item-card hm-tap ${currentHomeId === home.id ? "active" : ""}`}
            onClick={() => onSelect(home.id)}
          >
            <div className="home-item-icon-wrapper">
              <Home size={20} />
            </div>
            <div className="home-item-info">
              <div className="home-item-name">
                {home.name}
                {home.isOwner && <Star size={12} className="owner-star" />}
              </div>
              <div className="home-item-meta">
                <Users size={12} /> {t("homeSelector.membersCount", { count: home.memberCount })}
              </div>
            </div>
            {currentHomeId === home.id ? (
              <div className="active-badge"><Check size={14} /></div>
            ) : (
              <ChevronRight size={18} className="item-arrow" />
            )}
          </button>
        ))}
      </div>

      <div className="home-selector-actions">
        {!canCreateHome ? (
          <div className="home-create-limit">{t("homeSelector.createLimitReached")}</div>
        ) : (
          <button className="hm-btn hm-btn-primary hm-btn--full" onClick={onOpenCreate}>
            <Plus size={18} /> {t("homeSelector.createNewHome")}
          </button>
        )}

        {!showJoin ? (
          <button className="hm-btn hm-btn-soft hm-btn--full" onClick={() => setShowJoin(true)}>
            <Hash size={18} /> {t("homeSelector.joinWithCode")}
          </button>
        ) : (
          <form className="join-form hm-pop" onSubmit={handleJoinSubmit}>
            <input
              autoFocus
              className="hm-input join-input"
              placeholder={t("homeSelector.codePlaceholder")}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
            <div className="join-form-actions">
              <button type="button" className="hm-btn hm-btn-soft" onClick={() => setShowJoin(false)}>{t("homeSelector.cancel")}</button>
              <button type="submit" className="hm-btn hm-btn-primary join-confirm" disabled={!inviteCode.trim()}>{t("homeSelector.join")}</button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .home-selector-container {
          padding: 10px 0;
        }
        .home-selector-header {
          margin-bottom: 24px;
        }
        .home-selector-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }
        .home-selector-title {
          font-size: 24px;
          margin: 0;
          font-weight: 700;
        }
        .home-selector-close {
          position: static !important;
          flex-shrink: 0;
        }
        .home-selector-container {
          padding-top: 22px;
        }
        .home-selector-subtitle {
          color: var(--ink-soft);
          font-size: 14px;
        }
        .homes-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .home-item-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
          color: var(--ink);
        }
        .home-item-card:hover {
          border-color: var(--accent);
          background: var(--surface-alt);
        }
        .home-item-card.active {
          border-color: var(--accent);
          background: var(--accent-soft);
          box-shadow: 0 4px 12px -2px var(--accent-soft);
        }
        .home-item-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          flex-shrink: 0;
        }
        .home-item-card.active .home-item-icon-wrapper {
          background: white;
        }
        .home-item-info {
          flex: 1;
        }
        .home-item-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .owner-star {
          color: #E8B876;
          fill: #E8B876;
        }
        .home-item-meta {
          font-size: 12px;
          color: var(--ink-soft);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .active-badge {
          background: var(--accent);
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .item-arrow {
          color: var(--border);
        }
        .home-selector-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .home-create-limit {
          background: var(--surface-alt);
          color: var(--ink-soft);
          font-size: 13px;
          text-align: center;
          border-radius: 14px;
          padding: 12px 16px;
        }
        .join-form {
          background: var(--surface-alt);
          padding: 16px;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .join-input {
          height: 44px;
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .join-form-actions {
          display: flex;
          gap: 8px;
        }
        .join-confirm {
          flex: 1;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
