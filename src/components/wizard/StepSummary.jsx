import { Fragment } from "react";
import { MapPin, Tag, Calendar, Euro, FileText } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";

export function StepSummary({ data, state }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const room = state.rooms.find(r => r.id === data.roomId);
  const zone = state.zones.find(z => z.id === data.zoneId);
  const container = state.containers.find(c => c.id === data.containerId);

  const getPath = () => {
    const parts = [];
    if (room) parts.push(room.name);
    if (zone) parts.push(zone.name);
    if (container) parts.push(container.name);
    return parts;
  };

  const path = getPath();

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepSummaryTitle")}</h2>

      <div className="summary-card">
        {data.photo && (
          <div className="summary-photo">
            <img src={data.photo} alt={data.name} />
          </div>
        )}

        <div className="summary-content">
          <div className="summary-main">
            <h3 className="summary-name">{data.name}</h3>
            <div className="summary-category">
              <Tag size={12} /> {data.category}
            </div>
          </div>

          <div className="summary-details">
            <div className="summary-item">
              <MapPin size={14} className="summary-item-icon" />
              <div className="summary-item-text">
                {path.length > 0 ? (
                  <div className="summary-path">
                    {path.map((p, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="path-sep">→</span>}
                        <span>{p}</span>
                      </Fragment>
                    ))}
                  </div>
                ) : t("wizard.stepSummaryNoLocation")}
              </div>
            </div>

            {(data.price || data.purchaseDate) && (
              <div className="summary-row">
                {data.price && (
                  <div className="summary-item">
                    <Euro size={14} className="summary-item-icon" />
                    <span className="summary-item-text">{formatCurrency(data.price)}</span>
                  </div>
                )}
                {data.purchaseDate && (
                  <div className="summary-item">
                    <Calendar size={14} className="summary-item-icon" />
                    <span className="summary-item-text">{data.purchaseDate}</span>
                  </div>
                )}
              </div>
            )}

            {data.notes && (
              <div className="summary-item summary-item-notes">
                <FileText size={14} className="summary-item-icon" />
                <p className="summary-item-text">&ldquo;{data.notes}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
          width: 100%;
          max-width: 440px;
          text-align: left;
          box-shadow: var(--shadow);
        }
        .summary-photo {
          width: 100%;
          height: 200px;
          background: var(--surface-alt);
        }
        .summary-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .summary-content {
          padding: 24px;
        }
        .summary-main {
          margin-bottom: 24px;
        }
        .summary-name {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 6px 0;
        }
        .summary-category {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--accent-soft);
          color: var(--accent);
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
        }
        .summary-details {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .summary-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .summary-item-icon {
          color: var(--ink-soft);
          margin-top: 2px;
          flex-shrink: 0;
        }
        .summary-item-text {
          font-size: 14px;
          font-weight: 500;
        }
        .summary-path {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .path-sep {
          color: var(--border);
        }
        .summary-row {
          display: flex;
          gap: 24px;
        }
        .summary-item-notes {
          font-style: italic;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
