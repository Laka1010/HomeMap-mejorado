// Fase 7B/7C — llamada exclusivamente interna (Postgres AFTER INSERT
// trigger en security_events, ver
// 20260811_066_security_critical_telegram_alert_content.sql), nunca
// invocada por el cliente: verify_jwt=false porque la autorización no es
// un JWT de usuario, es el secreto compartido de la cabecera
// x-telegram-trigger-secret, comprobado contra TELEGRAM_TRIGGER_SECRET.
//
// El body ya viene con un resumen construido en Postgres a partir de la
// fila real insertada (event_label / user_email / created_at / details) --
// nunca metadata cruda, nunca datos financieros. Un llamante sin el
// secreto correcto nunca llega a construir ningún texto (401 antes de
// leer el body), así que una petición externa no puede elegir
// arbitrariamente el mensaje.

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

// Defensivo: el body lo construye Postgres, pero Telegram tiene un límite
// de 4096 caracteres por mensaje y no queremos que un valor inesperado
// rompa el envío.
function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + "…" : trimmed;
}

function buildMessage(payload: Record<string, unknown>): string {
  const eventLabel = safeText(payload.event_label, 200) ?? "Evento de seguridad crítico";
  const userEmail = safeText(payload.user_email, 200) ?? "Desconocido";
  const createdAt = safeText(payload.created_at, 50);
  const details = safeText(payload.details, 300);

  const lines = [
    "🚨 HomeMap Security",
    "━━━━━━━━━━━━━━",
    "🔴 CRITICAL",
    "",
    `Evento: ${eventLabel}`,
    `Usuario: ${userEmail}`,
  ];
  if (createdAt) lines.push(`Fecha: ${createdAt}`);
  if (details) lines.push(`Detalles: ${details}`);
  lines.push("", "👉 Revisa el Security Center");

  return lines.join("\n");
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

  let payload: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    // `req.json()` también acepta `null`, un array o un número; sin esta
    // comprobación, un body así hacía que buildMessage lanzara TypeError al
    // leer `payload.event_label` y la alerta crítica se perdía con un 500.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    // Body ausente o no-JSON: se manda igualmente la alerta con el
    // fallback genérico -- perder el detalle nunca debe impedir avisar de
    // un evento crítico real.
  }

  const text = buildMessage(payload);

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
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
