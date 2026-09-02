// Feed iCalendar (.ics) de solo lectura de los eventos manuales de un hogar
// (public.calendar_events). Pensado para suscribirse desde Google Calendar /
// Apple Calendar: esas apps piden la URL sin ninguna cabecera de auth, asi que
// verify_jwt=false y la autorizacion es el token secreto de la query
// (?token=...), que resuelve a un house_id en public.house_calendar_feeds
// (ver migracion 20260902_089). Mismo patron de secreto-en-vez-de-JWT que
// notify-security-telegram, y mismo cliente service_role + chequeo de IP
// bloqueada que vision-proxy.
//
// Solo lectura hacia fuera: editar en Google/Apple no vuelve a Haven. Las horas
// se emiten como "hora local flotante" (sin Z ni TZID) porque asi se guardan en
// calendar_events (hora de pared local); un evento a las 21:00 se ve a las 21:00
// en cualquier huso.

import { createClient } from "npm:@supabase/supabase-js@2";

const ICS_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Content-Disposition": 'inline; filename="haven.ics"',
  "Cache-Control": "public, max-age=3600",
};

function textResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
}

// Mismo orden de confianza que vision-proxy / public._security_event_client_ip().
function clientIp(req: Request): string | null {
  const pick = (raw: string | null): string | null => {
    if (!raw) return null;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    let v = parts[parts.length - 1];
    const bracketed = v.match(/^\[(.+)\]:\d+$/);
    if (bracketed) return bracketed[1];
    if (v.includes(".") && v.split(":").length === 2) v = v.split(":")[0];
    return v || null;
  };
  return pick(req.headers.get("sb-forwarded-for"))
    ?? pick(req.headers.get("cf-connecting-ip"))
    ?? pick(req.headers.get("x-forwarded-for"))
    ?? pick(req.headers.get("x-real-ip"));
}

async function isIpBlocked(
  admin: ReturnType<typeof createClient>,
  ip: string | null,
): Promise<boolean> {
  if (!ip) return false;
  try {
    const { data, error } = await admin.rpc("_is_ip_blocked", { p_ip: ip });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

// RFC 5545 3.3.11: escapar \ ; , y saltos de linea en valores de texto.
function escapeICS(value: string): string {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Nota: no se pliegan las lineas a 75 octetos (RFC 5545 3.1 lo pide como
// SHOULD). Google Calendar y Apple Calendar aceptan lineas largas sin plegar, y
// plegar por posicion de caracter puede partir un par surrogate (emoji en el
// nombre de la casa o en un titulo) y romper el UTF-8. Los valores si se
// escapan (escapeICS), que es lo que de verdad importa para el parseo.
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-09-04" -> "20260904" */
function fmtDate(dateStr: string): string {
  return dateStr.replace(/-/g, "").slice(0, 8);
}

/** "2026-09-04" + "21:00" -> "20260904T210000" (hora local flotante) */
function fmtDateTime(dateStr: string, timeStr: string): string {
  const [hh = "00", mm = "00"] = (timeStr || "").split(":");
  return `${fmtDate(dateStr)}T${pad2(Number(hh))}${pad2(Number(mm))}00`;
}

/** "2026-09-04" + N dias -> "YYYYMMDD" */
function addDaysCompact(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}

function nowStampUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

const RRULE_FREQ: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

interface CalendarEventRow {
  id: string;
  title: string;
  location: string | null;
  all_day: boolean;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  repeat: string | null;
  notes: string | null;
  url: string | null;
}

function buildVEvent(ev: CalendarEventRow, stamp: string): string {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${ev.id}@haven.app`, `DTSTAMP:${stamp}`];

  if (ev.all_day) {
    const endBase = ev.end_date || ev.start_date;
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(ev.start_date)}`);
    // DTEND es exclusivo en iCal para eventos de dia completo.
    lines.push(`DTEND;VALUE=DATE:${addDaysCompact(endBase, 1)}`);
  } else {
    const startTime = ev.start_time || "09:00";
    lines.push(`DTSTART:${fmtDateTime(ev.start_date, startTime)}`);
    if (ev.end_date && ev.end_time) {
      lines.push(`DTEND:${fmtDateTime(ev.end_date, ev.end_time)}`);
    } else {
      // Fallback: +1 hora sobre el inicio (contemplando el salto de dia).
      const [y, m, d] = ev.start_date.split("-").map(Number);
      const [hh, mm] = startTime.split(":").map(Number);
      const end = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
      end.setHours(end.getHours() + 1);
      lines.push(
        `DTEND:${end.getFullYear()}${pad2(end.getMonth() + 1)}${pad2(end.getDate())}T${pad2(end.getHours())}${pad2(end.getMinutes())}00`,
      );
    }
  }

  lines.push(`SUMMARY:${escapeICS(ev.title || "")}`);
  if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);

  const descParts: string[] = [];
  if (ev.notes) descParts.push(ev.notes);
  if (ev.url) descParts.push(ev.url);
  if (descParts.length) lines.push(`DESCRIPTION:${escapeICS(descParts.join("\n"))}`);
  if (ev.url) lines.push(`URL:${escapeICS(ev.url)}`);

  const freq = ev.repeat ? RRULE_FREQ[ev.repeat] : null;
  if (freq) lines.push(`RRULE:FREQ=${freq}`);

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return textResponse("Method not allowed", 405);
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token || !/^[a-f0-9]{16,128}$/i.test(token)) {
    return textResponse("Not found", 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return textResponse("Server misconfigured", 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (await isIpBlocked(admin, clientIp(req))) {
    return textResponse("Blocked", 403);
  }

  const { data: feed, error: feedError } = await admin
    .from("house_calendar_feeds")
    .select("house_id")
    .eq("token", token)
    .maybeSingle();

  if (feedError || !feed) {
    return textResponse("Not found", 404);
  }

  const [{ data: house }, { data: events }] = await Promise.all([
    admin.from("houses").select("name").eq("id", feed.house_id).maybeSingle(),
    admin
      .from("calendar_events")
      .select("id,title,location,all_day,start_date,start_time,end_date,end_time,repeat,notes,url")
      .eq("house_id", feed.house_id)
      .order("start_date", { ascending: true }),
  ]);

  const calName = escapeICS(house?.name ? `${house.name} - Haven` : "Haven");
  const stamp = nowStampUTC();

  const parts: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haven//Calendar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
    ...(events || []).map((ev) => buildVEvent(ev as CalendarEventRow, stamp)),
    "END:VCALENDAR",
  ];

  const body = parts.join("\r\n") + "\r\n";
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers: ICS_HEADERS });
});
