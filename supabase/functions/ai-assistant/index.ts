import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// Haven IA Assistant -- asistente conversacional con tool-calling real.
//
// DECISIÓN DE SEGURIDAD CENTRAL (sección 21 del pedido): a diferencia de
// vision-proxy (que usa service_role para todo), esta función construye un
// cliente Supabase con la clave ANON + el header Authorization de la
// petición entrante REENVIADO TAL CUAL. Así, cada consulta que hace una tool
// pasa por las políticas RLS ya existentes (is_house_member,
// can_manage_economy...) exactamente igual que si la hiciera el propio
// navegador del usuario. Ningún house_id/user_id que mande el cliente o que
// "decida" el modelo se usa para autorizar nada -- la autorización real la
// hace siempre Postgres. Solo se usa un cliente service_role aparte, mínimo,
// para _is_ip_blocked (mismo patrón que vision-proxy) -- nunca para tools.
//
// El modelo NUNCA genera SQL ni recibe credenciales de Supabase: solo puede
// invocar las tools registradas en TOOLS, con los parámetros que declaran.
// ============================================================================

const MAX_TOOL_LOOP_ITERATIONS = 5;

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

function preflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// A-3: mismo orden de confianza que vision-proxy/index.ts (ver
// public._security_event_client_ip()).
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

// ============================================================================
// Búsqueda difusa y resolución de ruta -- portadas de src/utils/textMatch.js
// y de locationPath (App.jsx:878-888). No se pueden importar directamente:
// src/ es un bundle de navegador y esto es un programa Deno aislado (mismo
// motivo por el que vision-proxy tampoco importa nada de src/).
// ============================================================================

function normalizeText(text: string | null | undefined): string {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function fuzzyMatch(text: string | null | undefined, query: string): boolean {
  if (!query) return true;
  return normalizeText(text).includes(normalizeText(query));
}

function fuzzyMatchAny(fields: (string | null | undefined)[], query: string): boolean {
  return fields.some((f) => fuzzyMatch(f, query));
}

type Room = { id: string; name: string };
type Zone = { id: string; room_id: string; name: string };
type Container = { id: string; room_id: string | null; zone_id: string | null; parent_id: string | null; name: string };

/** Room -> Zone -> Container(s), de fuera hacia dentro. Mismo algoritmo que locationPath en App.jsx. */
function buildLocationPath(
  entity: { room_id: string | null; zone_id: string | null; container_id: string | null },
  rooms: Room[],
  zones: Zone[],
  containers: Container[]
): string[] {
  const path: string[] = [];
  const room = rooms.find((r) => r.id === entity.room_id);
  if (room) path.push(room.name);
  const zone = zones.find((z) => z.id === entity.zone_id);
  if (zone) path.push(zone.name);

  let containerId = entity.container_id;
  const chain: string[] = [];
  const seen = new Set<string>();
  while (containerId && !seen.has(containerId)) {
    seen.add(containerId);
    const container = containers.find((c) => c.id === containerId);
    if (!container) break;
    chain.unshift(container.name);
    containerId = container.parent_id;
  }
  return [...path, ...chain];
}

// ============================================================================
// Contexto pasado a cada tool. userClient respeta RLS (ver arriba); houseId
// es el que manda el cliente, pero nunca se usa como fuente de verdad de
// permisos -- si el usuario no es miembro de esa casa, RLS hace que todas
// las consultas devuelvan vacío, no un error revelador.
// ============================================================================
interface ToolContext {
  userClient: ReturnType<typeof createClient>;
  houseId: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

async function searchObjectsHandler(args: Record<string, unknown>, ctx: ToolContext) {
  const query = String(args?.query ?? "").trim();
  const { userClient, houseId } = ctx;

  const [roomsRes, zonesRes, containersRes, objectsRes] = await Promise.all([
    userClient.from("rooms").select("id, name").eq("house_id", houseId),
    userClient.from("zones").select("id, room_id, name").eq("house_id", houseId),
    userClient.from("containers").select("id, room_id, zone_id, parent_id, name").eq("house_id", houseId),
    userClient.from("objects").select("id, name, category, description, notes, price, purchase_date, room_id, zone_id, container_id").eq("house_id", houseId),
  ]);

  if (objectsRes.error) return { error: objectsRes.error.message };

  const rooms = (roomsRes.data ?? []) as Room[];
  const zones = (zonesRes.data ?? []) as Zone[];
  const containers = (containersRes.data ?? []) as Container[];
  const objects = objectsRes.data ?? [];

  const matches = objects
    .filter((o: any) => fuzzyMatchAny([o.name, o.description, o.notes, o.category], query))
    .slice(0, 5)
    .map((o: any) => ({
      id: o.id,
      name: o.name,
      category: o.category,
      description: o.description,
      price: o.price,
      purchaseDate: o.purchase_date,
      path: buildLocationPath(o, rooms, zones, containers),
    }));

  return { products: matches, totalObjectsInHouse: objects.length };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "search_objects",
    description:
      "Busca objetos guardados en la casa actual por nombre, categoría, descripción o notas, y devuelve dónde están (habitación, zona y cajas de fuera hacia dentro), además de su precio y fecha de compra si Haven los tiene guardados (si no, esos campos vienen null -- no los inventes). Úsala para preguntas como '¿dónde tengo el taladro?', 'busca las luces de Navidad' o '¿cuánto costó el cable HDMI?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Lo que el usuario está buscando, en pocas palabras (p.ej. 'taladro', 'luces de navidad')." },
      },
      required: ["query"],
    },
    handler: searchObjectsHandler,
  },
];

function toolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

// Las tools se declaran una sola vez arriba con el esquema "tipo Gemini"
// (mayúsculas: OBJECT/STRING), por ser el primer proveedor implementado.
// OpenAI (y mañana Claude) sí siguen JSON Schema estándar, así que este
// helper traduce el esquema al vuelo en vez de mantener dos copias de cada
// definición de tool.
function toJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...schema };
  if (typeof out.type === "string") out.type = (out.type as string).toLowerCase();
  if (out.properties && typeof out.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.properties as Record<string, unknown>)) {
      props[key] = toJsonSchema(value as Record<string, unknown>);
    }
    out.properties = props;
  }
  return out;
}

// ============================================================================
// Adaptadores de IA con tool-calling. Mismo contrato de entrada/salida que
// los adaptadores de vision-proxy (prompt/contexto -> texto), pero aquí es un
// bucle: el modelo puede pedir una tool, se ejecuta, se le devuelve el
// resultado, y puede volver a pedir otra hasta que dé una respuesta final en
// texto. El resto de la función no sabe ni le importa qué proveedor se usó.
// ============================================================================

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(nowIso: string): string {
  return `
Eres Haven IA, el asistente integrado en la aplicación Haven que ayuda a gestionar un hogar.
Fecha y hora actual (usa SIEMPRE esta, nunca inventes ni asumas otra): ${nowIso}.

Tu ámbito es EXCLUSIVAMENTE la gestión del hogar dentro de Haven: objetos guardados, consumibles, lista de la compra, tareas, calendario y economía doméstica. Si el usuario pregunta algo que no tiene nada que ver con eso (cultura general, noticias, programación, otra app, charla random, etc.), no lo respondas: dile brevemente y con amabilidad que solo puedes ayudar con la gestión de su hogar en Haven, sin sermonear ni repetirlo más de una vez seguida.

Reglas:
- Solo puedes actuar sobre la casa actualmente seleccionada por el usuario, salvo que pida explícitamente buscar en todas sus casas.
- Usa las herramientas disponibles para consultar o modificar datos reales de Haven -- nunca inventes objetos, cantidades, gastos ni fechas.
- Si una herramienta no encuentra nada, dilo con claridad ("No encuentro ningún objeto llamado...") en vez de inventar un resultado.
- Si hay varios resultados relevantes, muéstralos todos en vez de elegir uno al azar.
- Para acciones que crean o modifican datos: si la intención del usuario es inequívoca, ejecuta directamente; si hay ambigüedad real (por ejemplo, varias listas de la compra posibles, o una fecha/hora no aclarada), pregunta primero en una frase corta antes de ejecutar.
- Responde siempre en el mismo idioma que use el usuario, de forma breve y natural, como un asistente personal -- no como un chatbot genérico.
- Tu respuesta se muestra como texto plano en un chat, SIN renderizar markdown: no uses asteriscos para negrita/cursiva ni comillas invertidas para código ni almohadillas de títulos. Puedes usar emoji y saltos de línea para dar estructura (como en estos ejemplos): "🔎 He encontrado el taladro.\n📦 Caja de herramientas\n📍 Garaje → Zona de herramientas".
`.trim();
}

function messagesToGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

type NavigableObject = { id: string; name: string; path: string[] };
type ToolCallSummary = { name: string; argsSummary: string; objects: NavigableObject[] };

// El cliente pinta un botón "ir al objeto" por cada resultado con id que
// devuelva una tool de búsqueda -- se manda ya extraído y acotado (solo
// id/name/path) en vez del resultado crudo entero, para no filtrar más
// datos del objeto de los que la UI necesita para navegar.
function extractNavigableObjects(toolName: string, result: unknown): NavigableObject[] {
  if (toolName !== "search_objects" && toolName !== "search_objects_all_homes") return [];
  const products = (result as { products?: unknown[] })?.products;
  if (!Array.isArray(products)) return [];
  return products
    .filter((p: any) => p?.id)
    .map((p: any) => ({ id: p.id, name: p.name, path: p.path ?? [] }));
}

// Ejecuta una tool y registra su resumen en toolCalls -- compartido por
// todos los adaptadores para no duplicar el manejo de errores ni la
// extracción de objetos navegables.
async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  toolCalls: ToolCallSummary[]
): Promise<unknown> {
  const tool = toolByName(name);
  const result = tool
    ? await tool.handler(args ?? {}, ctx).catch((error: Error) => ({ error: error.message }))
    : { error: `Herramienta desconocida: ${name}` };

  toolCalls.push({
    name,
    argsSummary: JSON.stringify(args ?? {}).slice(0, 200),
    objects: extractNavigableObjects(name, result),
  });

  return result;
}

async function callGeminiWithTools(
  messages: ChatMessage[],
  ctx: ToolContext,
  apiKey: string
): Promise<{ reply: string; toolCalls: ToolCallSummary[] }> {
  const model = Deno.env.get("GEMINI_ASSISTANT_MODEL") || "gemini-3.6-flash";
  const systemPrompt = buildSystemPrompt(new Date().toISOString());
  const contents: any[] = messagesToGeminiContents(messages);
  const toolCalls: ToolCallSummary[] = [];

  const geminiTools = [{
    functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  }];

  for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          tools: geminiTools,
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gemini respondió ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const functionCallPart = parts.find((p: any) => p.functionCall);

    if (!functionCallPart) {
      const reply = parts.map((p: any) => p.text ?? "").join("").trim();
      return { reply: reply || "No he podido generar una respuesta.", toolCalls };
    }

    const { name, args } = functionCallPart.functionCall;
    const result = await runTool(name, args ?? {}, ctx, toolCalls);

    // Se reenvían los `parts` TAL CUAL los devolvió el modelo (no
    // reconstruidos a partir de name/args): las versiones recientes de la
    // API adjuntan un `thoughtSignature` dentro del part de functionCall y
    // lo exigen de vuelta en el siguiente turno para no degradar el
    // razonamiento del modelo; reconstruir el part a mano lo perdía.
    contents.push({ role: "model", parts });
    // La API actual de Gemini rechaza role: "function" (error 400: "Role
    // 'function' is not supported"); el propio mensaje de error lista los
    // roles válidos y no incluye ninguno específico para tools, así que la
    // respuesta de la tool se manda como un turno "user" más.
    contents.push({ role: "user", parts: [{ functionResponse: { name, response: { result } } }] });
  }

  return { reply: "He tardado demasiado intentando resolver esto -- ¿puedes reformular la pregunta?", toolCalls };
}

// Adaptador de OpenAI: mismo bucle que callGeminiWithTools pero con el
// formato de tool-calling de la Chat Completions API (mensajes con
// tool_calls, respuestas como turnos role:"tool" referenciando tool_call_id).
async function callOpenAIWithTools(
  messages: ChatMessage[],
  ctx: ToolContext,
  apiKey: string
): Promise<{ reply: string; toolCalls: ToolCallSummary[] }> {
  const model = Deno.env.get("OPENAI_ASSISTANT_MODEL") || "gpt-4.1-mini";
  const client = new OpenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(new Date().toISOString());
  const toolCalls: ToolCallSummary[] = [];

  const chatMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const openaiTools = TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: toJsonSchema(t.parameters) },
  }));

  for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
    const completion = await client.chat.completions.create({
      model,
      messages: chatMessages,
      tools: openaiTools,
    });

    const message = completion.choices?.[0]?.message;
    const calls = message?.tool_calls;

    if (!calls || calls.length === 0) {
      const reply = (message?.content ?? "").trim();
      return { reply: reply || "No he podido generar una respuesta.", toolCalls };
    }

    // El mensaje del asistente con sus tool_calls se reenvía tal cual lo
    // devolvió la API -- OpenAI exige verlo de vuelta en el historial antes
    // de aceptar los turnos "tool" que le responden.
    chatMessages.push(message);

    for (const call of calls) {
      const name = call.function.name;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* argumentos mal formados -> objeto vacío */ }

      const result = await runTool(name, args, ctx, toolCalls);

      chatMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { reply: "He tardado demasiado intentando resolver esto -- ¿puedes reformular la pregunta?", toolCalls };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const { messages, houseId } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "Falta el campo messages" }, 400);
    }
    if (!houseId || typeof houseId !== "string") {
      return jsonResponse({ error: "Falta el campo houseId" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    const requestedProvider = Deno.env.get("AI_ASSISTANT_PROVIDER");

    let providerName = requestedProvider;
    if (!providerName) {
      if (openaiKey) providerName = "openai";
      else if (claudeKey) providerName = "claude";
      else if (geminiKey) providerName = "gemini";
    }
    if (!providerName) {
      return jsonResponse({ error: "No hay ningún proveedor de IA configurado (falta OPENAI_API_KEY, ANTHROPIC_API_KEY o GEMINI_API_KEY)." }, 500);
    }
    if (providerName === "claude") {
      return jsonResponse({ error: `El asistente todavía no soporta Claude (proveedor activo: ${providerName}). Añade OPENAI_API_KEY o GEMINI_API_KEY, o fija AI_ASSISTANT_PROVIDER a "openai" o "gemini".` }, 400);
    }
    if (providerName !== "openai" && providerName !== "gemini") {
      return jsonResponse({ error: `Proveedor de IA no soportado: ${providerName}.` }, 400);
    }

    const apiKey = providerName === "openai" ? openaiKey : geminiKey;
    if (!apiKey) {
      const missingVar = providerName === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
      return jsonResponse({ error: `${missingVar} no configurada en Supabase Edge Function` }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      if (await isIpBlocked(admin, clientIp(req))) {
        return jsonResponse({ error: "Acceso bloqueado desde esta red" }, 403);
      }
    }

    // Cliente RLS-scoped: reenvía el JWT del propio usuario, nunca service_role.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const ctx: ToolContext = { userClient, houseId };
    const { reply, toolCalls } = providerName === "openai"
      ? await callOpenAIWithTools(messages as ChatMessage[], ctx, apiKey)
      : await callGeminiWithTools(messages as ChatMessage[], ctx, apiKey);

    // El registro de uso nunca debe bloquear una respuesta ya obtenida.
    try {
      await userClient.rpc("record_ai_usage_event", { p_feature_key: "ai_assistant" });
    } catch {
      // Ignorado a propósito, igual que el resto de Haven IA.
    }

    return jsonResponse({ reply, toolCalls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("ai-assistant error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
