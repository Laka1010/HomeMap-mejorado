import { supabase } from "../supabaseClient";
import { logIfPermissionDenied } from "./securityEventsService";

/**
 * Feed .ics del hogar: URL secreta a la que suscribirse desde Google/Apple
 * Calendar para ver los eventos manuales (calendar_events) fuera de Haven.
 *
 * El token vive en public.house_calendar_feeds y solo se toca mediante las
 * RPCs `calendar_feed_token` (cualquier miembro, get-or-create) y
 * `regenerate_calendar_feed_token` (solo admin) — ver migración
 * 20260902_089_calendar_feed.sql. La Edge Function `calendar-feed` sirve el
 * .ics resolviendo ?token= a un house_id.
 */

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed`;

export function buildFeedUrl(token) {
  return `${FUNCTIONS_BASE}?token=${encodeURIComponent(token)}`;
}

/** Variante webcal:// — un toque abre el diálogo de suscripción en Apple/Google. */
export function buildWebcalUrl(token) {
  return buildFeedUrl(token).replace(/^https?:\/\//, "webcal://");
}

export const calendarFeedService = {
  /** Token del hogar, creándolo la primera vez. Cualquier miembro. */
  async getFeedToken(houseId) {
    const { data, error } = await supabase.rpc("calendar_feed_token", { p_house_id: houseId });
    if (error) throw error;
    return data;
  },

  /** Rota el token (rompe las suscripciones actuales). Solo admin. */
  async regenerateFeedToken(houseId) {
    const { data, error } = await supabase.rpc("regenerate_calendar_feed_token", { p_house_id: houseId });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
    return data;
  },
};
