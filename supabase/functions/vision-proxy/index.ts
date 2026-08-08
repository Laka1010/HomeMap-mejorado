import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js@2";

// Mismo límite que src/services/photoUtils.jsx (MAX_PHOTO_SIZE) -- aquí se
// re-valida server-side porque el límite del cliente es fácil de saltarse
// llamando a esta función directamente.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Cuota diaria por usuario para acotar el gasto en la API de OpenAI. No hay
// un motivo de producto para necesitar más de esto en un uso normal
// (escanear objetos/tickets); ajustar si hace falta.
const DAILY_CALL_LIMIT = 60;

const OBJECT_DETECTION_PROMPT = `
Analiza esta fotografía de un espacio doméstico (cajón, estantería, caja o habitación).
Identifica cada objeto individual visible y claramente reconocible.
Responde ÚNICAMENTE con un array JSON, sin texto adicional, con este formato exacto:
[
  { "name": "Nombre del objeto", "category": "Una categoría breve", "confidence": 0.0-1.0 }
]
`.trim();

const KNOWN_STORES = [
  "Mercadona", "Lidl", "Carrefour", "Consum", "Aldi",
  "Dia", "Bonpreu", "Esclat", "Caprabo", "Alcampo",
];

// Modo "receipt": extrae los datos de un ticket de supermercado en vez de
// detectar objetos físicos. Misma filosofía de prompt que OBJECT_DETECTION_PROMPT
// (solo JSON, sin texto adicional) pero con un esquema distinto, y con
// instrucciones explícitas de normalización de nombres de producto — la
// tarea de "LECHE ENTERA 1L" -> "Leche entera" se resuelve aquí, en el
// prompt, en vez de con reglas/regex en el cliente.
const RECEIPT_SCAN_PROMPT = `
Analiza esta fotografía de un ticket de compra de supermercado en España.
Extrae los datos y responde ÚNICAMENTE con un JSON, sin texto adicional, con este formato exacto:
{
  "store": "Nombre del supermercado",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Nombre normalizado del producto", "quantity": 1, "unitPrice": 0.00 }
  ],
  "taxAmount": 0.00,
  "discountAmount": 0.00,
  "total": 0.00
}

Reglas importantes:
- Normaliza cada nombre de producto a una forma natural y legible en español,
  con la primera letra en mayúscula. Por ejemplo: "LECHE ENTERA 1L" -> "Leche entera",
  "TOM FRITO" -> "Tomate frito", "PAN MOLDE" -> "Pan de molde".
- Para el supermercado, intenta reconocer si coincide con alguno de estos
  nombres conocidos (usa el nombre exacto de la lista si coincide):
  ${KNOWN_STORES.join(", ")}.
  Si no lo reconoces, escribe el nombre tal como aparece en el ticket.
- Si no puedes leer con certeza un dato (impuestos, descuento, fecha), usa
  null en ese campo en vez de inventar un valor.
- "quantity" es el número de unidades de esa línea, no el precio.
- "unitPrice" es el precio por unidad, no el total de la línea.
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

// Tamaño decodificado aproximado de un data URL base64, sin decodificarlo
// entero en memoria: basta con el largo de la parte base64 y su padding.
function estimateBase64DecodedBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64Part = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = base64Part.endsWith("==") ? 2 : base64Part.endsWith("=") ? 1 : 0;
  return Math.floor((base64Part.length * 3) / 4) - padding;
}

// El gateway de Supabase ya verificó la firma del JWT antes de invocar esta
// función (verify_jwt = true), así que confiar en el "sub" del payload aquí
// es seguro -- solo lo usamos para poder llevar la cuota por usuario.
function getUserIdFromAuthHeader(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function parseJsonLoosely(rawText: string, fallback: unknown) {
  try {
    return JSON.parse(rawText);
  } catch {
    const arrayMatch = rawText.match(/\[[\s\S]*\]/);
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    const extracted = arrayMatch?.[0] ?? objectMatch?.[0];
    if (!extracted) return fallback;
    try {
      return JSON.parse(extracted);
    } catch {
      return fallback;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 204);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const { provider, image, mode } = await req.json();
    const providerName = String(provider || "openai").toLowerCase();
    const scanMode = String(mode || "object_detection");

    if (!image || typeof image !== "string") {
      return jsonResponse({ error: "Falta el campo image en base64 data URL" }, 400);
    }

    if (estimateBase64DecodedBytes(image) > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "La imagen supera el tamaño máximo permitido (5MB)" }, 413);
    }

    if (providerName !== "openai") {
      return jsonResponse({ error: `Proveedor no soportado todavía en esta Edge Function: ${providerName}` }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY no configurada en Supabase Edge Function" }, 500);
    }

    // verify_jwt=true garantiza que req trae un JWT válido, pero por si acaso
    // no se pudiera decodificar (config futura sin verify_jwt), fallamos
    // cerrado en vez de dejar pasar peticiones sin cuota.
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: currentCount, error: usageError } = await admin.rpc("increment_vision_proxy_usage", {
        p_user_id: userId,
      });
      if (!usageError && typeof currentCount === "number" && currentCount > DAILY_CALL_LIMIT) {
        return jsonResponse({ error: "Límite diario de escaneos alcanzado. Inténtalo mañana." }, 429);
      }
    }

    const isReceiptMode = scanMode === "receipt";
    const prompt = isReceiptMode ? RECEIPT_SCAN_PROMPT : OBJECT_DETECTION_PROMPT;
    const systemMessage = isReceiptMode
      ? "Devuelve solo un JSON válido con un objeto, sin texto adicional."
      : "Devuelve solo un JSON válido con un array de objetos, sin texto adicional.";

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const rawText = completion.choices?.[0]?.message?.content ?? (isReceiptMode ? "{}" : "[]");

    if (isReceiptMode) {
      const parsed = parseJsonLoosely(rawText, {});
      return jsonResponse(parsed);
    }

    const parsed = parseJsonLoosely(rawText, []);
    const objects = Array.isArray(parsed) ? parsed : parsed?.objects ?? [];
    return jsonResponse(objects);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return jsonResponse({ error: message }, 500);
  }
});
