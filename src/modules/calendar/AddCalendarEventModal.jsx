import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";
import { REPEAT_OPTIONS, repeatLabelKey } from "../tasks/taskRepeat";

const ALERT_OPTIONS = ["none", "at_time", "5m", "10m", "15m", "30m", "1h", "1d"];

const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Suma `minutes` a una marca "YYYY-MM-DD" + "HH:MM" y devuelve { date, time }. */
function addMinutes(dateStr, timeStr, minutes) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  base.setMinutes(base.getMinutes() + minutes);
  return { date: toISODate(base), time: `${pad(base.getHours())}:${pad(base.getMinutes())}` };
}

/** Clave comparable para ordenar inicio vs fin. */
function stamp(dateStr, timeStr, allDay) {
  return allDay ? `${dateStr}T00:00` : `${dateStr}T${timeStr || "00:00"}`;
}

/**
 * Formulario de "nuevo evento" del calendario, con el mismo formato que el
 * "New Event" de Apple Calendar: hoja inferior con lista agrupada (Título /
 * Ubicación · Todo el día / Empieza / Termina / Repetir · Aviso · URL / Notas)
 * y acciones Cancelar / Añadir en la barra superior.
 *
 * Alta y edición comparten componente: si llega `event` se precargan sus
 * valores y aparece el botón "Eliminar evento" al pie.
 */
export function AddCalendarEventModal({ initialDate, event, onClose, onSave, onDelete }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const isEdit = Boolean(event);

  const [data, setData] = useState(() => {
    if (event) {
      return {
        title: event.title || "",
        location: event.location || "",
        allDay: event.allDay ?? false,
        startDate: event.startDate || initialDate || toISODate(new Date()),
        startTime: event.startTime || "09:00",
        endDate: event.endDate || event.startDate || initialDate || toISODate(new Date()),
        endTime: event.endTime || "10:00",
        repeat: REPEAT_OPTIONS.includes(event.repeat) ? event.repeat : "none",
        alert: ALERT_OPTIONS.includes(event.alert) ? event.alert : "none",
        notes: event.notes || "",
        url: event.url || "",
      };
    }
    const now = new Date();
    const startDate = initialDate || toISODate(now);
    const startTime = `${pad((now.getHours() + 1) % 24)}:00`;
    const end = addMinutes(startDate, startTime, 60);
    return {
      title: "",
      location: "",
      allDay: false,
      startDate,
      startTime,
      endDate: end.date,
      endTime: end.time,
      repeat: "none",
      alert: "none",
      notes: "",
      url: "",
    };
  });

  const patch = (fields) => setData((d) => ({ ...d, ...fields }));

  // Cambiar el inicio arrastra el fin para no dejarlo antes (Apple mantiene la
  // duración; aquí basta con empujarlo a +1h si se quedó invertido).
  const onStartDateChange = (value) => {
    setData((d) => {
      const next = { ...d, startDate: value };
      if (stamp(next.endDate, next.endTime, next.allDay) < stamp(value, next.startTime, next.allDay)) {
        const bumped = next.allDay ? { date: value, time: next.endTime } : addMinutes(value, next.startTime, 60);
        next.endDate = bumped.date;
        next.endTime = bumped.time;
      }
      return next;
    });
  };
  const onStartTimeChange = (value) => {
    setData((d) => {
      const next = { ...d, startTime: value };
      if (stamp(next.endDate, next.endTime, next.allDay) <= stamp(next.startDate, value, next.allDay)) {
        const bumped = addMinutes(next.startDate, value, 60);
        next.endDate = bumped.date;
        next.endTime = bumped.time;
      }
      return next;
    });
  };

  const endBeforeStart = useMemo(
    () => stamp(data.endDate, data.endTime, data.allDay) < stamp(data.startDate, data.startTime, data.allDay),
    [data],
  );
  const canSave = data.title.trim().length > 0 && !endBeforeStart;

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      title: data.title.trim(),
      location: data.location.trim(),
      allDay: data.allDay,
      startDate: data.startDate,
      startTime: data.allDay ? "" : data.startTime,
      endDate: data.endDate,
      endTime: data.allDay ? "" : data.endTime,
      repeat: data.repeat,
      alert: data.alert,
      notes: data.notes.trim(),
      url: data.url.trim(),
    };
    onSave(payload);
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="cev-sheet" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>

        <div className="cev-navbar">
          <button className="cev-navbtn" onClick={onClose}>{t("calendarEvent.cancel")}</button>
          <div className="cev-navtitle">{isEdit ? t("calendarEvent.editTitle") : t("calendarEvent.newTitle")}</div>
          <button className="cev-navbtn cev-navbtn--primary" onClick={handleSave} disabled={!canSave}>
            {isEdit ? t("calendarEvent.save") : t("calendarEvent.add")}
          </button>
        </div>

        <div className="cev-body hm-scroll">
          <div className="cev-group">
            <div className="cev-row cev-row--input">
              <input
                className="cev-field cev-field--title"
                placeholder={t("calendarEvent.fieldTitle")}
                value={data.title}
                autoFocus
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <div className="cev-row cev-row--input">
              <input
                className="cev-field"
                placeholder={t("calendarEvent.fieldLocation")}
                value={data.location}
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>
          </div>

          <div className="cev-group">
            <label className="cev-row">
              <span className="cev-label">{t("calendarEvent.fieldAllDay")}</span>
              <input
                type="checkbox"
                className="cev-switch"
                checked={data.allDay}
                onChange={(e) => patch({ allDay: e.target.checked })}
              />
            </label>
            <div className="cev-row">
              <span className="cev-label">{t("calendarEvent.fieldStarts")}</span>
              <span className="cev-datetime">
                <input
                  type="date"
                  className="cev-field cev-field--date"
                  value={data.startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                />
                {!data.allDay && (
                  <input
                    type="time"
                    className="cev-field cev-field--time"
                    value={data.startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                  />
                )}
              </span>
            </div>
            <div className="cev-row">
              <span className="cev-label">{t("calendarEvent.fieldEnds")}</span>
              <span className="cev-datetime">
                <input
                  type="date"
                  className="cev-field cev-field--date"
                  value={data.endDate}
                  min={data.startDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                />
                {!data.allDay && (
                  <input
                    type="time"
                    className="cev-field cev-field--time"
                    value={data.endTime}
                    onChange={(e) => patch({ endTime: e.target.value })}
                  />
                )}
              </span>
            </div>
            {endBeforeStart && (
              <div className="cev-row cev-row--error">{t("calendarEvent.endBeforeStartError")}</div>
            )}
            <div className="cev-row">
              <span className="cev-label">{t("calendarEvent.fieldRepeat")}</span>
              <select
                className="cev-field cev-field--select"
                value={data.repeat}
                onChange={(e) => patch({ repeat: e.target.value })}
              >
                {REPEAT_OPTIONS.map((r) => (
                  <option key={r} value={r}>{t(repeatLabelKey(r))}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cev-group">
            <div className="cev-row">
              <span className="cev-label">{t("calendarEvent.fieldAlert")}</span>
              <select
                className="cev-field cev-field--select"
                value={data.alert}
                onChange={(e) => patch({ alert: e.target.value })}
              >
                {ALERT_OPTIONS.map((a) => (
                  <option key={a} value={a}>{t(`calendarEvent.alert_${a}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cev-group">
            <div className="cev-row cev-row--input">
              <input
                className="cev-field"
                placeholder={t("calendarEvent.fieldUrl")}
                value={data.url}
                inputMode="url"
                onChange={(e) => patch({ url: e.target.value })}
              />
            </div>
            <div className="cev-row cev-row--input cev-row--notes">
              <textarea
                className="cev-field cev-field--notes"
                placeholder={t("calendarEvent.fieldNotes")}
                rows={3}
                value={data.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </div>

          {isEdit && (
            <div className="cev-group">
              <button className="cev-row cev-row--delete" onClick={() => onDelete?.(event)}>
                <Trash2 size={16} /> {t("calendarEvent.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .cev-sheet { background: var(--surface-alt); width: 100%; max-width: 540px; max-height: 92vh; border-radius: 28px 28px 0 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 -12px 40px rgba(0,0,0,0.18); position: relative; animation: hmSheetIn .32s cubic-bezier(.22,1,.36,1) backwards; }
        @media (prefers-reduced-motion: reduce) { .cev-sheet { animation: none !important; } }

        .cev-navbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 12px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .cev-navtitle { font-weight: 700; font-size: 16px; color: var(--ink); }
        .cev-navbtn { background: none; border: none; font-size: 15px; color: var(--accent); cursor: pointer; padding: 6px 4px; -webkit-tap-highlight-color: transparent; min-width: 64px; }
        .cev-navbtn:first-child { text-align: left; }
        .cev-navbtn:last-child { text-align: right; }
        .cev-navbtn--primary { font-weight: 700; }
        .cev-navbtn:disabled { color: var(--ink-soft); opacity: .5; cursor: not-allowed; }

        .cev-body { padding: 16px 16px 28px; overflow-y: auto; overscroll-behavior-y: contain; display: flex; flex-direction: column; gap: 22px; }
        .cev-group { background: var(--surface); border-radius: 14px; overflow: hidden; }
        .cev-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; min-height: 44px; border-bottom: 1px solid var(--border); }
        .cev-group .cev-row:last-child { border-bottom: none; }
        .cev-row--input { padding: 4px 14px; }
        .cev-row--notes { align-items: stretch; }
        .cev-label { font-size: 15px; color: var(--ink); flex-shrink: 0; }

        .cev-field { background: none; border: none; font-size: 15px; color: var(--ink); font-family: inherit; text-align: right; min-width: 0; padding: 8px 0; -webkit-tap-highlight-color: transparent; }
        .cev-field:focus { outline: none; }
        .cev-field::placeholder { color: var(--ink-soft); }
        .cev-row--input .cev-field { flex: 1; text-align: left; }
        .cev-field--title { font-size: 17px; font-weight: 600; }
        .cev-datetime { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
        .cev-field--date, .cev-field--time { background: var(--surface-alt); border-radius: 8px; padding: 6px 10px; text-align: left; color: var(--ink); }
        .cev-field--select { background: var(--surface-alt); border-radius: 8px; padding: 6px 10px; text-align: left; max-width: 55%; }
        .cev-field--notes { width: 100%; text-align: left; resize: vertical; padding: 10px 0; line-height: 1.4; }

        .cev-switch { width: 44px; height: 26px; appearance: none; -webkit-appearance: none; background: var(--border); border-radius: 999px; position: relative; cursor: pointer; transition: background .18s ease; flex-shrink: 0; }
        .cev-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: transform .18s ease; }
        .cev-switch:checked { background: var(--accent); }
        .cev-switch:checked::after { transform: translateX(18px); }

        .cev-row--error { color: var(--danger); font-size: 13px; justify-content: flex-start; padding-top: 0; }
        .cev-row--delete { width: 100%; background: none; border: none; cursor: pointer; color: var(--danger); font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; }
      `}</style>
    </div>
  );
}
