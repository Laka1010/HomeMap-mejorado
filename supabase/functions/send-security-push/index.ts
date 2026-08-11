// Edge Function: send-security-push (Fase 7 — Security Push Notifications)
//
// Invocada exclusivamente por el trigger `security_events_notify_critical`
// (Postgres, vía pg_net) cuando se inserta un security_event con
// severity='critical'. NO la invoca ningún cliente con JWT de usuario —
// por eso NO usa verify_jwt (a diferencia de vision-proxy/delete-account):
// se autentica con un secreto compartido propio (header
// x-push-trigger-secret), guardado en Supabase Vault en el lado de la
// base de datos y como secreto de esta función en el lado de Supabase.
//
// Contenido del mensaje deliberadamente genérico (ver ejemplo del propio
// diseño aprobado) — no se lee metadata/ip_address/user_id del evento
// para construir el texto, solo se recibe event_type/severity/created_at
// desde el propio trigger. El deep-link a Admin Console usa únicamente
// event_id.
//
// Credenciales de Firebase: SOLO viven aquí, como secretos de la función
// (Deno.env), nunca en el repo ni en el cliente. SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente en toda
// Edge Function — no hace falta configurarlos a mano.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") ?? "";
const FIREBASE_PRIVATE_KEY = (Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");

async function getFcmAccessToken(): Promise<string> {
  const privateKey = await importPKCS8(FIREBASE_PRIVATE_KEY, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setIssuer(FIREBASE_CLIENT_EMAIL)
    .setSubject(FIREBASE_CLIENT_EMAIL)
    .setAudience("https://oauth2.googleapis.com/token")
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener el token OAuth2 de Google: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const incomingSecret = req.headers.get("x-push-trigger-secret") ?? "";
  if (!PUSH_TRIGGER_SECRET || incomingSecret !== PUSH_TRIGGER_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const eventId = payload?.event_id as string | undefined;
  if (!eventId) {
    return new Response(JSON.stringify({ error: "event_id requerido" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Destinatarios: SOLO quien esté hoy en security_admins. El FCM token
  // nunca decide esto -- is_security_admin()/security_admins es la única
  // fuente de verdad, igual que en el resto del proyecto.
  const { data: admins, error: adminsError } = await supabase
    .from("security_admins")
    .select("user_id");
  if (adminsError) {
    return new Response(JSON.stringify({ error: adminsError.message }), { status: 500 });
  }
  const adminIds = (admins ?? []).map((a) => a.user_id);
  if (adminIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_admins" }), { status: 200 });
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("push_tokens")
    .select("id, user_id, token")
    .in("user_id", adminIds)
    .eq("is_active", true);
  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), { status: 500 });
  }
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), { status: 200 });
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    // Firebase todavía no configurado (secretos pendientes) -- no se
    // intenta enviar nada. No es un error del sistema, es un estado
    // esperado hasta que se complete la configuración externa.
    for (const t of tokens) {
      await supabase.from("security_push_delivery_log").insert({
        event_id: eventId,
        admin_user_id: t.user_id,
        push_token_id: t.id,
        status: "failed",
        error_reason: "firebase_not_configured",
      });
    }
    return new Response(JSON.stringify({ sent: 0, reason: "firebase_not_configured" }), { status: 200 });
  }

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken();
  } catch (e) {
    for (const t of tokens) {
      await supabase.from("security_push_delivery_log").insert({
        event_id: eventId,
        admin_user_id: t.user_id,
        push_token_id: t.id,
        status: "failed",
        error_reason: `oauth_error: ${String(e).slice(0, 200)}`,
      });
    }
    return new Response(JSON.stringify({ error: "oauth_error" }), { status: 502 });
  }

  let sent = 0;
  for (const t of tokens) {
    try {
      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: {
                title: "🚨 Critical Security Event",
                body: "Se ha detectado actividad potencialmente maliciosa. Toca para revisar el evento.",
              },
              data: { event_id: eventId },
              android: { priority: "high" },
            },
          }),
        },
      );

      if (fcmRes.ok) {
        sent += 1;
        await supabase.from("security_push_delivery_log").insert({
          event_id: eventId,
          admin_user_id: t.user_id,
          push_token_id: t.id,
          status: "sent",
        });
      } else {
        const errBody = await fcmRes.json().catch(() => ({}));
        const fcmStatus = errBody?.error?.status ?? "";
        const isInvalidToken = fcmRes.status === 404 || fcmStatus === "UNREGISTERED" || fcmStatus === "NOT_FOUND";

        if (isInvalidToken) {
          await supabase.from("push_tokens").update({ is_active: false }).eq("id", t.id);
        }

        await supabase.from("security_push_delivery_log").insert({
          event_id: eventId,
          admin_user_id: t.user_id,
          push_token_id: t.id,
          status: isInvalidToken ? "invalid_token" : "failed",
          error_reason: JSON.stringify(errBody).slice(0, 300),
        });
      }
    } catch (e) {
      await supabase.from("security_push_delivery_log").insert({
        event_id: eventId,
        admin_user_id: t.user_id,
        push_token_id: t.id,
        status: "failed",
        error_reason: `fetch_error: ${String(e).slice(0, 200)}`,
      });
    }
  }

  return new Response(JSON.stringify({ sent, total: tokens.length }), { status: 200 });
});
