import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { economyService } from "../economy/services/economyService";
import { buildLocalEvents } from "./buildLocalEvents";
import { toDateKey, getWeekDates, addDays, billDueLabel, EVENT_CATEGORY_META } from "./calendarUtils";
import { EmptyState } from "../../components/EmptyState";
import { useTranslation } from "../../i18n";
import { intlLocale } from "../../utils/dates";

const SWIPE_THRESHOLD = 40;

/**
 * Agenda semanal compacta: "qué tengo que hacer esta semana", no un
 * calendario mensual. `selectedDate` es la única fuente de verdad — la
 * semana visible se deriva de ella (getWeekDates), así que nunca se pueden
 * desincronizar. Punto de extensión futuro: un `viewMode` ("week"|"month")
 * podría decidir si renderizar la barra semanal o una rejilla mensual que
 * reutilice el mismo `eventsByDate` de abajo, sin duplicar la agregación.
 */
export function CalendarModule({ state, currentHome, canSeeEconomy = true }) {
  const { t, locale } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [bills, setBills] = useState([]);
  const touchStartX = useRef(null);

  // Las facturas viven en economy_bills, no en el estado global de la casa
  // (state.bills nunca se rellena — ver notifications/engine.js, que resuelve
  // esto igual: las carga aparte y las fusiona antes de construir eventos).
  // Se ocultan para el rol "child", igual que el módulo Economía completo.
  useEffect(() => {
    if (!currentHome?.id || !canSeeEconomy) {
      setBills([]);
      return;
    }
    let cancelled = false;
    economyService.getAllBills(currentHome.id)
      .then((rows) => { if (!cancelled) setBills(rows); })
      .catch((error) => {
        console.error("Error cargando facturas para el calendario:", error);
        if (!cancelled) setBills([]);
      });
    return () => { cancelled = true; };
  }, [currentHome?.id, canSeeEconomy]);

  const events = useMemo(() => buildLocalEvents({ ...state, bills }), [state, bills]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const dateKey = toDateKey(event.date);
      if (!dateKey) return;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(event);
    });
    return map;
  }, [events]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const dateLocale = intlLocale(locale);
  const monthLabel = selectedDate.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
  const weekdayLetters = useMemo(
    () => weekDates.map((d) => d.toLocaleDateString(dateLocale, { weekday: "narrow" })),
    [weekDates, dateLocale],
  );
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);

  const dayEvents = useMemo(() => {
    const list = eventsByDate.get(selectedKey) || [];
    return [...list].sort((a, b) => {
      const aHasTime = Boolean(a.time);
      const bHasTime = Boolean(b.time);
      if (aHasTime && bHasTime) return a.time.localeCompare(b.time);
      if (aHasTime) return -1;
      if (bHasTime) return 1;
      return 0;
    });
  }, [eventsByDate, selectedKey]);

  const goToWeek = (deltaDays) => setSelectedDate((d) => addDays(d, deltaDays));

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    goToWeek(deltaX < 0 ? 7 : -7);
  };

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", textTransform: "capitalize" }}>
        {monthLabel}
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 4 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button className="hm-btn hm-btn-soft" style={{ borderRadius: 999, flexShrink: 0, width: 32, height: 32, minHeight: 32, padding: 0, justifyContent: "center" }} onClick={() => goToWeek(-7)} aria-label={t("calendarModule.prevWeekAria")}>
          <ChevronLeft size={16} />
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: 1 }}>
          {weekDates.map((date, i) => {
            const dateKey = toDateKey(date);
            const isSelected = dateKey === selectedKey;
            const isToday = dateKey === todayKey;
            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(date)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "6px 0",
                  border: "none",
                  borderRadius: 14,
                  cursor: "pointer",
                  background: isSelected ? "var(--accent)" : "transparent",
                  transition: "background 0.15s ease, transform 0.1s ease",
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.8)" : "var(--ink-soft)" }}>
                  {weekdayLetters[i]}
                </span>
                <span
                  className={isSelected ? "" : "hm-display"}
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--ink)",
                  }}
                >
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <button className="hm-btn hm-btn-soft" style={{ borderRadius: 999, flexShrink: 0, width: 32, height: 32, minHeight: 32, padding: 0, justifyContent: "center" }} onClick={() => goToWeek(7)} aria-label={t("calendarModule.nextWeekAria")}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div key={selectedKey} className="hm-fade-in hm-card" style={{ padding: dayEvents.length === 0 ? 24 : 6 }}>
        {dayEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("calendarModule.emptyTitle")} subtitle={t("calendarModule.emptySubtitle")} />
        ) : (
          dayEvents.map((event, idx) => {
            const meta = EVENT_CATEGORY_META[event.type] || EVENT_CATEGORY_META.Tarea;
            const Icon = meta.icon;
            const subtitle = event.type === "Factura"
              ? billDueLabel(event.date, t)
              : event.time || t("calendarModule.noTime");
            return (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 10px",
                  borderBottom: idx < dayEvents.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div className="hm-row-icon" style={{ background: meta.bg, color: meta.color }}>
                  <Icon size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
                  <div className="hm-mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 1 }}>{subtitle}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
