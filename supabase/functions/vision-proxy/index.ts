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

// El prompt pide un OBJETO con la clave "objects" y no un array suelto porque
// la llamada usa response_format: { type: "json_object" }, que obliga al
// modelo a devolver un objeto en la raíz. Pedirle un array mientras se le
// prohíbe devolverlo dejaba el resultado a merced de qué nombre de clave
// eligiera el modelo para envolverlo: si no acertaba con "objects", el
// parseo caía al array vacío y el escaneo "no detectaba nada".
const OBJECT_DETECTION_PROMPT = `
Analiza esta fotografía de un espacio doméstico (cajón, estantería, caja o habitación).
Identifica cada objeto individual visible y claramente reconocible.
Responde ÚNICAMENTE con un JSON, sin texto adicional, con este formato exacto:
{
  "objects": [
    { "name": "Nombre del objeto", "category": "Una categoría breve", "confidence": 0.0-1.0 }
  ]
}
Si no reconoces ningún objeto, responde { "objects": [] }.
`.trim();

// Modo "consumables": identifica uno o varios productos domésticos en la
// misma foto (Haven IA, inventario inteligente). Mismo esquema de "envolver
// en un objeto con clave nombrada" que OBJECT_DETECTION_PROMPT, por el mismo
// motivo (response_format: json_object exige un objeto en la raíz).
const CONSUMABLES_SCAN_PROMPT = `
Analiza esta fotografía de uno o varios productos domésticos (por ejemplo:
detergente, papel higiénico, agua, leche, pasta, productos de limpieza,
champú, gel, pasta de dientes, comida, bebidas u otros productos de higiene
o del hogar). Identifica CADA producto individual visible, aunque haya
varios en la misma foto. Responde ÚNICAMENTE con un JSON, sin texto
adicional, con este formato exacto:
{
  "products": [
    {
      "name": "Nombre del producto",
      "brand": "Marca visible, o null si no se distingue",
      "category": "Una categoría breve (limpieza, higiene, alimentación...)",
      "isConsumable": true,
      "estimatedQuantity": 0,
      "unit": "percent",
      "visibleText": "Texto legible en el envase, o null",
      "sizeOrFormat": "Tamaño o formato si es legible, o null",
      "condition": "Estado aproximado (nuevo, usado, deteriorado...)",
      "nearlyEmpty": false,
      "shouldRestock": false
    }
  ]
}

Reglas importantes:
- "estimatedQuantity" es una estimación aproximada de cuánto queda: si el
  producto se mide por nivel de llenado (detergente, champú, gel...) usa
  "unit": "percent" con un número de 0 a 100; si se cuenta por unidades
  (rollos de papel, botellas, paquetes...) usa "unit": "units" con el
  número de unidades visibles.
- "isConsumable" es false para objetos que no se consumen (un bote vacío
  decorativo, un utensilio reutilizable...).
- "nearlyEmpty" es true solo cuando el producto está visiblemente casi
  agotado (por debajo de ~15% o quedan muy pocas unidades).
- "shouldRestock" es true cuando, además de estar casi vacío, es un
  producto de uso habitual que normalmente se repone.
- Si no puedes determinar un dato con certeza, usa null en ese campo en vez
  de inventarlo.
- Si no reconoces ningún producto, responde { "products": [] }.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// El preflight se responde SIN cuerpo: 204 es un "null body status", así que
// `new Response(json, { status: 204 })` lanza TypeError por especificación.
// Como el preflight se atendía antes del try/catch, ese throw salía como un
// 500 sin cabeceras CORS y el navegador bloqueaba la llamada real.
function preflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Tamaño decodificado aproximado de un data URL base64, sin decodificarlo
// entero en memoria: basta con el largo de la parte base64 y su padding.
function estimateBase64DecodedBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64Part = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = base64Part.endsWith("==") ? 2 : base64Part.endsWith("=") ? 1 : 0;
  return Math.floor((base64Part.length * 3) / 4) - padding;
}

/** "data:image/jpeg;base64,AAAA..." -> { mimeType: "image/jpeg", base64Data: "AAAA..." } */
function splitDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  return match ? { mimeType: match[1], base64Data: match[2] } : { mimeType: "image/jpeg", base64Data: dataUrl };
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

// A-3: mismo orden de confianza que public._security_event_client_ip() (ver
// 20260831_079). Las dos primeras cabeceras no las puede fijar el cliente; de
// x-forwarded-for se toma SIEMPRE el último elemento, que es el que añade el
// borde -- el primero es justo el que inyectaría un atacante.
function clientIp(req: Request): string | null {
  const pick = (raw: string | null): string | null => {
    if (!raw) return null;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    let v = parts[parts.length - 1];
    const bracketed = v.match(/^\[(.+)\]:\d+$/); // [IPv6]:puerto
    if (bracketed) return bracketed[1];
    if (v.includes(".") && v.split(":").length === 2) v = v.split(":")[0]; // IPv4:puerto
    return v || null;
  };
  return pick(req.headers.get("sb-forwarded-for"))
    ?? pick(req.headers.get("cf-connecting-ip"))
    ?? pick(req.headers.get("x-forwarded-for"))
    ?? pick(req.headers.get("x-real-ip"));
}

// Reutiliza public._is_ip_blocked() en vez de duplicar la consulta: una sola
// fuente de verdad para lo que significa "IP bloqueada". Falla en abierto,
// igual que la función de Postgres.
async function isIpBlocked(
  admin: ReturnType<typeof createClient>,
  ip: string | null
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

async function callOpenAI(prompt: string, systemMessage: string, image: string, apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: Deno.env.get("OPENAI_VISION_MODEL") || "gpt-4.1-mini",
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
  return completion.choices?.[0]?.message?.content ?? "{}";
}

// Sección 12 del pedido ("no acoplar Haven a un único proveedor de IA"):
// mismo contrato de entrada/salida que callOpenAI (prompt + imagen -> texto
// JSON crudo), así que el resto de la función no sabe ni le importa cuál de
// los dos se usó. El modelo es configurable por env var porque los nombres
// de modelo de Gemini cambian con más frecuencia que los de OpenAI; si el
// que viene por defecto deja de existir, basta con fijar GEMINI_VISION_MODEL
// en los secretos de la función, sin tocar código.
async function callGemini(prompt: string, systemMessage: string, image: string, apiKey: string): Promise<string> {
  const model = Deno.env.get("GEMINI_VISION_MODEL") || "gemini-3.6-flash";
  const { mimeType, base64Data } = splitDataUrl(image);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${systemMessage}\n\n${prompt}` },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini respondió ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

// Mismo contrato que callOpenAI/callGemini. Claude no tiene un "modo JSON"
// forzado como OpenAI o Gemini, así que se apoya por completo en el propio
// prompt (que ya pide "ÚNICAMENTE JSON") + parseJsonLoosely como red de
// seguridad si el modelo añadiera algo de texto alrededor.
async function callClaude(prompt: string, systemMessage: string, image: string, apiKey: string): Promise<string> {
  const model = Deno.env.get("CLAUDE_VISION_MODEL") || "claude-haiku-4-5-20251001";
  const { mimeType, base64Data } = splitDataUrl(image);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMessage,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude respondió ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  return data?.content?.[0]?.text ?? "{}";
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
    return preflightResponse();
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const { provider, image, mode } = await req.json();
    const requestedProvider = provider ? String(provider).toLowerCase() : null;
    const scanMode = String(mode || "object_detection");

    if (!image || typeof image !== "string") {
      return jsonResponse({ error: "Falta el campo image en base64 data URL" }, 400);
    }

    if (estimateBase64DecodedBytes(image) > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "La imagen supera el tamaño máximo permitido (5MB)" }, 413);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Sección 12 del pedido: sin proveedor explícito en la petición, se elige
    // automáticamente el que tenga clave configurada -- así el cliente
    // (aiService.callVisionProxy) no necesita saber ni decidir nunca cuál está
    // activo. El orden (openai > claude > gemini) solo mantiene el
    // comportamiento que ya había antes de añadir cada proveedor nuevo.
    let providerName = requestedProvider;
    if (!providerName) {
      if (openaiKey) providerName = "openai";
      else if (claudeKey) providerName = "claude";
      else if (geminiKey) providerName = "gemini";
    }

    if (!providerName) {
      return jsonResponse({ error: "No hay ningún proveedor de IA configurado (falta OPENAI_API_KEY, ANTHROPIC_API_KEY o GEMINI_API_KEY)." }, 500);
    }
    if (providerName !== "openai" && providerName !== "gemini" && providerName !== "claude") {
      return jsonResponse({ error: `Proveedor no soportado todavía en esta Edge Function: ${providerName}` }, 400);
    }

    const apiKey = providerName === "openai" ? openaiKey : providerName === "claude" ? claudeKey : geminiKey;
    if (!apiKey) {
      const missingVar = providerName === "openai" ? "OPENAI_API_KEY" : providerName === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
      return jsonResponse({ error: `${missingVar} no configurada en Supabase Edge Function` }, 500);
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

      // A-3: se comprueba ANTES de contar cuota y antes de llamar a OpenAI, para
      // que una IP bloqueada no llegue a gastar nada.
      if (await isIpBlocked(admin, clientIp(req))) {
        return jsonResponse({ error: "Acceso bloqueado desde esta red" }, 403);
      }

      const { data: currentCount, error: usageError } = await admin.rpc("increment_vision_proxy_usage", {
        p_user_id: userId,
      });
      if (!usageError && typeof currentCount === "number" && currentCount > DAILY_CALL_LIMIT) {
        return jsonResponse({ error: "Límite diario de escaneos alcanzado. Inténtalo mañana." }, 429);
      }
    }

    const isReceiptMode = scanMode === "receipt";
    const isConsumablesMode = scanMode === "consumables";
    const prompt = isReceiptMode
      ? RECEIPT_SCAN_PROMPT
      : isConsumablesMode
      ? CONSUMABLES_SCAN_PROMPT
      : OBJECT_DETECTION_PROMPT;
    const systemMessage = isReceiptMode
      ? "Devuelve solo un JSON válido con un objeto, sin texto adicional."
      : isConsumablesMode
      ? "Devuelve solo un JSON válido con un objeto que tenga la clave \"products\", sin texto adicional."
      : "Devuelve solo un JSON válido con un objeto que tenga la clave \"objects\", sin texto adicional.";

    const rawText = providerName === "openai"
      ? await callOpenAI(prompt, systemMessage, image, apiKey)
      : providerName === "claude"
      ? await callClaude(prompt, systemMessage, image, apiKey)
      : await callGemini(prompt, systemMessage, image, apiKey);

    if (isReceiptMode) {
      const parsed = parseJsonLoosely(rawText, {});
      return jsonResponse(parsed);
    }

    if (isConsumablesMode) {
      const parsed = parseJsonLoosely(rawText, {});
      const products = Array.isArray(parsed) ? parsed : parsed?.products ?? [];
      return jsonResponse({ products: Array.isArray(products) ? products : [] });
    }

    // Se sigue aceptando un array suelto: es lo que devolvían las respuestas
    // anteriores a este cambio y no cuesta nada seguir tolerándolo.
    const parsed = parseJsonLoosely(rawText, {});
    const objects = Array.isArray(parsed) ? parsed : parsed?.objects ?? [];
    return jsonResponse(Array.isArray(objects) ? objects : []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("vision-proxy error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
