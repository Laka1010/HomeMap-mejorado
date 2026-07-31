import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";

function getPointerStyle(targetRect, anchor = "bottom") {
  if (!targetRect) return {};
  const base = {
    top: anchor === "bottom" ? targetRect.bottom + 14 : targetRect.top - 14,
    left: Math.max(20, Math.min(targetRect.left + targetRect.width / 2 - 12, window.innerWidth - 44)),
  };
  return base;
}

export function FeatureGuide({ targetId, title, description, primaryLabel, onPrimary, onClose, canDismiss = true }) {
  const { t } = useTranslation();
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const syncRect = () => {
      const node = document.getElementById(targetId);
      setRect(node ? node.getBoundingClientRect() : null);
    };

    syncRect();
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [targetId]);

  const pointer = useMemo(() => getPointerStyle(rect, "bottom"), [rect]);

  if (!rect) return null;

  return (
    <div className="feature-guide-root" aria-live="polite">
      <div className="feature-guide-backdrop" />
      <div className="feature-guide-spotlight" style={{
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 18,
      }} />
      <div className="feature-guide-pointer" style={{ top: pointer.top, left: pointer.left }} />
      <div className="feature-guide-card" style={{
        top: Math.min(rect.bottom + 34, window.innerHeight - 170),
        left: Math.max(18, Math.min(rect.left, window.innerWidth - 340)),
        width: 320,
      }}>
        <div className="feature-guide-card-title">{title}</div>
        <div className="feature-guide-card-text">{description}</div>
        <div className="feature-guide-card-actions">
          {canDismiss && (
            <button className="hm-btn hm-btn-ghost" onClick={onClose}>{t("onboarding.tour.close")}</button>
          )}
          <button className="hm-btn hm-btn-primary" onClick={onPrimary || onClose}>{primaryLabel || t("onboarding.tour.gotIt")}</button>
        </div>
      </div>

      <style>{`
        .feature-guide-root {
          position: fixed;
          inset: 0;
          z-index: 1300;
          pointer-events: none;
        }
        .feature-guide-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10, 14, 18, 0.44);
          backdrop-filter: blur(2px);
        }
        .feature-guide-spotlight {
          position: absolute;
          border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 0 0 999px rgba(10, 14, 18, 0.46);
          border-radius: 16px;
        }
        .feature-guide-pointer {
          position: absolute;
          width: 24px;
          height: 24px;
          background: var(--surface);
          transform: rotate(45deg);
          border-left: 1px solid var(--border);
          border-top: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .feature-guide-card {
          position: absolute;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 22px;
          box-shadow: 0 18px 48px -24px rgba(0, 0, 0, 0.4);
          padding: 16px;
          pointer-events: auto;
        }
        .feature-guide-card-title {
          font-weight: 800;
          font-size: 16px;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .feature-guide-card-text {
          font-size: 13.5px;
          line-height: 1.45;
          color: var(--ink-soft);
          margin-bottom: 14px;
        }
        .feature-guide-card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
