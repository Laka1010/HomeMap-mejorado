import OpenAI from "npm:openai";

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

    if (providerName !== "openai") {
      return jsonResponse({ error: `Proveedor no soportado todavía en esta Edge Function: ${providerName}` }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY no configurada en Supabase Edge Function" }, 500);
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
