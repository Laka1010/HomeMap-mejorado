import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";

export function StepLocation({ data, onChange, state, onNext }) {
  const { t } = useTranslation();
  const [level, setLevel] = useState("room"); // room -> zone -> container

  const handleRoomSelect = (roomId) => {
    onChange({ roomId, zoneId: null, containerId: null });
    const hasZones = state.zones.some(z => z.roomId === roomId);
    if (hasZones) {
      setLevel("zone");
    } else {
      onNext();
    }
  };

  const handleZoneSelect = (zoneId) => {
    onChange({ zoneId, containerId: null });
    const hasContainers = state.containers.some(c => c.zoneId === zoneId);
    if (hasContainers) {
      setLevel("container");
    } else {
      onNext();
    }
  };

  const handleContainerSelect = (containerId) => {
    onChange({ containerId });
    onNext();
  };

  const getRoomIcon = (key) => {
    const icons = {
      salon: "🏠", cocina: "🍳", habitacion: "🛏️", bano: "🚿",
      trastero: "📦", garaje: "🚗", oficina: "💼"
    };
    return icons[key] || "🏠";
  };

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepLocationTitle")}</h2>

      <div className="location-breadcrumbs">
        <div className={`breadcrumb ${level === "room" ? "active" : ""}`}>{t("wizard.stepLocationRoomBreadcrumb")}</div>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <div className={`breadcrumb ${level === "zone" ? "active" : ""}`}>{t("wizard.stepLocationZoneBreadcrumb")}</div>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <div className={`breadcrumb ${level === "container" ? "active" : ""}`}>{t("wizard.stepLocationBoxBreadcrumb")}</div>
      </div>

      <div className="location-selection-area">
        {level === "room" && (
          <div className="selection-grid">
            {state.rooms.map(room => (
              <button
                key={room.id}
                className="selection-card hm-tap"
                onClick={() => handleRoomSelect(room.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRoomSelect(room.id); }}
                        role="button"
                        tabIndex={0}
                        aria-label={t("wizard.stepLocationSelectRoomAria", { name: room.name })}
                      >
                        <span className="selection-icon">{getRoomIcon(room.icon)}</span>
                        <span className="selection-label">{room.name}</span>
                      </button>
                    ))}
                  </div>
                )}

        {level === "zone" && (
          <div className="selection-grid">
            {state.zones.filter(z => z.roomId === data.roomId).map(zone => (
              <button
                key={zone.id}
                className="selection-card hm-tap"
                onClick={() => handleZoneSelect(zone.id)}
              >
                <span className="selection-icon">{zone.icon}</span>
                <span className="selection-label">{zone.name}</span>
              </button>
            ))}
            <button className="selection-card selection-skip hm-tap" onClick={onNext}>
              <span className="selection-label">{t("wizard.noSpecificZone")}</span>
            </button>
          </div>
        )}

        {level === "container" && (
          <div className="selection-list">
            {state.containers.filter(c => c.zoneId === data.zoneId).map(container => (
              <button
                key={container.id}
                className="selection-row hm-tap"
                onClick={() => handleContainerSelect(container.id)}
              >
                <div className="selection-row-color" style={{ background: container.color }} />
                <span className="selection-label">{container.name}</span>
                <ChevronRight size={18} className="selection-row-arrow" />
              </button>
            ))}
            <button className="selection-row selection-skip hm-tap" onClick={onNext}>
              <span className="selection-label">{t("wizard.stepLocationOutsideBox")}</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        .location-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
          background: var(--surface-alt);
          padding: 6px 16px;
          border-radius: 99px;
        }
        .breadcrumb {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .breadcrumb.active {
          color: var(--accent);
        }
        .breadcrumb-sep {
          color: var(--border);
        }
        .location-selection-area {
          width: 100%;
          max-width: 500px;
        }
        .selection-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .selection-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--ink);
        }
        .selection-card:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .selection-icon {
          font-size: 28px;
        }
        .selection-label {
          font-weight: 700;
          font-size: 14px;
        }
        .selection-skip {
          grid-column: span 2;
          padding: 14px;
          border-style: dashed;
        }
        .selection-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .selection-row {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          text-align: left;
          color: var(--ink);
        }
        .selection-row-color {
          width: 14px;
          height: 14px;
          border-radius: 4px;
        }
        .selection-row-arrow {
          margin-left: auto;
          color: var(--border);
        }
      `}</style>
    </div>
  );
}
