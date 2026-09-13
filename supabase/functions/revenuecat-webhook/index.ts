import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// Webhook de RevenueCat -> única vía por la que subscription_status pasa a
// reflejar un pago REAL (Play Store/App Store). Nunca invocado por el
// cliente: verify_jwt=false porque la autorización no es un JWT de usuario,
// es el secreto compartido de la cabecera Authorization, comprobado contra
// REVENUECAT_WEBHOOK_SECRET (mismo patrón que notify-security-telegram con
// x-telegram-trigger-secret). Un llamante sin el secreto correcto recibe
// 401 antes de leer ni procesar nada del body.
//
// El SDK cliente NUNCA es la fuente de verdad de si alguien es Premium --
// solo sirve para iniciar la compra. Este webhook, con service_role, es el
// único que puede llamar a sync_subscription_from_revenuecat (revocada para
// authenticated/anon, ver 20260913_107_revenuecat_subscription_sync.sql).
// ============================================================================

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparación en tiempo constante para no filtrar el secreto por timing,
// igual que notify-security-telegram/index.ts.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Entitlement único que da acceso a todo Haven Premium (mismo entitlement
// para Monthly y Yearly -- no hay niveles distintos de Premium).
const HAVEN_ENTITLEMENT = "haven_pro";

// Tipos de evento que representan un cambio de estado real del entitlement.
// Todo lo que no está aquí (BILLING_ISSUE, CANCELLATION, TRANSFER...) se
// trata aparte: se registra para no perderlo/duplicarlo, pero no cambia
// subscription_status -- ver comentario más abajo.
const ACTIVE_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]);
const EXPIRED_EVENT_TYPES = new Set(["EXPIRATION"]);
// BILLING_ISSUE (pago fallido) y CANCELLATION (cancela pero sigue activo
// hasta fin de periodo) no cambian el estado aquí: Play Store/App Store ya
// gestionan su propio periodo de gracia, y el entitlement sigue activo
// mientras tanto. Se registran igualmente para no reprocesarlos si
// RevenueCat los reintenta. Punto de extensión para un futuro aviso al
// usuario ("hay un problema con tu pago"), no implementado todavía.
const DEDUPE_ONLY_EVENT_TYPES = new Set(["BILLING_ISSUE", "CANCELLATION"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("revenuecat-webhook: REVENUECAT_WEBHOOK_SECRET no configurado");
    return jsonResponse({ error: "Webhook no configurado" }, 500);
  }

  const receivedAuth = req.headers.get("Authorization") || "";
  if (!timingSafeEqual(receivedAuth, `Bearer ${secret}`)) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  try {
    const body = await req.json();
    const event = body?.event;
    if (!event || typeof event !== "object") {
      return jsonResponse({ error: "Falta el campo event" }, 400);
    }

    const eventId: string | undefined = event.id;
    const eventType: string | undefined = event.type;
    const appUserId: string | undefined = event.app_user_id;
    if (!eventId || !eventType || !appUserId) {
      return jsonResponse({ error: "Evento incompleto (falta id, type o app_user_id)" }, 400);
    }

    // Eventos que no nos interesan en absoluto (p.ej. TEST, SUBSCRIPTION_PAUSED):
    // 200 sin acción, ni siquiera de-duplicación.
    if (!ACTIVE_EVENT_TYPES.has(eventType) && !EXPIRED_EVENT_TYPES.has(eventType) && !DEDUPE_ONLY_EVENT_TYPES.has(eventType)) {
      return jsonResponse({ ok: true, ignored: eventType });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const eventAtMs: number | undefined = event.event_timestamp_ms;
    const eventAt = eventAtMs ? new Date(eventAtMs).toISOString() : new Date().toISOString();

    if (DEDUPE_ONLY_EVENT_TYPES.has(eventType)) {
      // Solo se registra el event_id para no reprocesarlo -- no toca profiles.
      const { error } = await admin.from("revenuecat_webhook_events").upsert({ event_id: eventId }, { onConflict: "event_id", ignoreDuplicates: true });
      if (error) {
        console.error("revenuecat-webhook: error registrando evento de solo-dedupe:", error.message);
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ ok: true, dedupeOnly: eventType });
    }

    const entitlementActive = ACTIVE_EVENT_TYPES.has(eventType)
      && Array.isArray(event.entitlement_ids)
      && event.entitlement_ids.includes(HAVEN_ENTITLEMENT);

    const expiresAtMs: number | undefined = event.expiration_at_ms;
    const purchasedAtMs: number | undefined = event.purchased_at_ms;
    const store: string | undefined = event.store; // "PLAY_STORE" | "APP_STORE" | ...

    const { error } = await admin.rpc("sync_subscription_from_revenuecat", {
      p_user_id: appUserId,
      p_event_id: eventId,
      p_event_at: eventAt,
      p_entitlement_active: entitlementActive,
      p_expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
      p_started_at: purchasedAtMs ? new Date(purchasedAtMs).toISOString() : null,
      p_platform: store ? store.toLowerCase() : null,
    });

    if (error) {
      console.error("revenuecat-webhook: error en sync_subscription_from_revenuecat:", error.message);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true, type: eventType, entitlementActive });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("revenuecat-webhook error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
