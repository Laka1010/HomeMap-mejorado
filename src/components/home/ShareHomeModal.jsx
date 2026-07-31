import { useState } from "react";
import { Copy, Check, Share2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../i18n";
import { HouseMembersSection } from "../settings/HouseMembersSection";

export function ShareHomeModal({ home, members, currentUserRole, onRemoveMember, onChangeRole }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const inviteCode = home.inviteCode || t("shareHome.notAvailable");

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareText = t("shareHome.shareText", { name: home.name, code: inviteCode });
    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title: t("shareHome.shareTitleText", { name: home.name }), text: shareText });
        setShareStatus(t("shareHome.sharedSuccessfully"));
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareStatus(t("shareHome.copiedToClipboard"));
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setShareStatus(t("shareHome.shareError"));
      }
    }
  };

  return (
    <div className="share-modal-content hm-fade-in">
      <div className="invite-section">
        <label className="hm-label">{t("shareHome.inviteCodeLabel")}</label>
        <p className="share-desc">{t("shareHome.desc")}</p>

        <div className="code-card">
          <div className="code-text">{revealed ? inviteCode : "********"}</div>
          <div className="code-actions">
            <button
              type="button"
              className="copy-btn"
              onClick={() => setRevealed((visible) => !visible)}
              aria-label={revealed ? t("shareHome.hideCodeAria") : t("shareHome.revealCodeAria")}
              title={revealed ? t("shareHome.hideCode") : t("shareHome.revealCode")}
            >
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button type="button" className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy} aria-label={t("shareHome.copyCodeAria")}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        <button className="hm-btn hm-btn-primary share-external-btn" onClick={handleShare}>
          <Share2 size={16} /> {t("shareHome.shareLink")}
        </button>
        {shareStatus && <p className="share-status" role="status">{shareStatus}</p>}
      </div>

      <HouseMembersSection
        members={members}
        currentUserRole={currentUserRole}
        onChangeRole={onChangeRole}
        onRemoveMember={onRemoveMember}
      />

      <style>{`
        .share-modal-content {
          padding: 4px 0;
        }
        .share-desc {
          font-size: 13.5px;
          color: var(--ink-soft);
          margin: 0 0 16px;
        }
        .invite-section {
          margin-bottom: 32px;
        }
        .code-card {
          background: var(--surface-alt);
          border: 2px dashed var(--border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s;
          margin-bottom: 12px;
        }
        .code-card:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .code-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink);
        }
        .copy-btn {
          background: var(--surface);
          border: 1px solid var(--border);
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-soft);
          transition: all 0.2s;
          cursor: pointer;
        }
        .code-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .copy-btn.copied {
          background: var(--success);
          color: white;
          border-color: var(--success);
        }
        .share-external-btn {
          width: 100%;
          justify-content: center;
          font-size: 14px;
        }
        .share-status {
          color: var(--success);
          font-size: 12.5px;
          text-align: center;
          margin: 8px 0 0;
        }
      `}</style>
    </div>
  );
}
