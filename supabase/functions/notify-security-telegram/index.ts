// Fase 7B — llamada exclusivamente interna (Postgres AFTER INSERT trigger
// en security_events, ver 20260811_065_security_critical_telegram_alert.sql),
// nunca invocada por el cliente: verify_jwt=false porque la autorización no
// es un JWT de usuario, es el secreto compartido de la cabecera
// x-telegram-trigger-secret, comprobado contra TELEGRAM_TRIGGER_SECRET.
//
// El mensaje enviado a Telegram es fijo y genérico a propósito: esta
// función nunca recibe (ni necesita) datos del evento -- nada de user_id,
// IP, metadata, tipo de evento, importes ni cualquier otro dato privado.

const GENERIC_MESSAGE =
  "🚨 HomeMap Security\nSe ha detectado un evento de seguridad crítico.\nRevisa el Security Center.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparación en tiempo constante para no filtrar el secreto por timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const triggerSecret = Deno.env.get("TELEGRAM_TRIGGER_SECRET");
  if (!triggerSecret) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }

  const receivedSecret = req.headers.get("x-telegram-trigger-secret") || "";
  if (!timingSafeEqual(receivedSecret, triggerSecret)) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: GENERIC_MESSAGE }),
      }
    );

    if (!telegramResponse.ok) {
      return jsonResponse({ ok: false }, 502);
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ ok: false }, 502);
  }
});
