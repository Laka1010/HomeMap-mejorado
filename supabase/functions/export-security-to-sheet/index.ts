// Espejo append-only del Security Center a una Google Sheet.
//
// La llama EXCLUSIVAMENTE el cron de Postgres (ver
// 20260910_093_export_security_to_sheet.sql), nunca el cliente:
// verify_jwt = false y la autorización es el secreto compartido de la
// cabecera x-export-trigger-secret, comprobado contra EXPORT_TRIGGER_SECRET
// en tiempo constante. Un llamante sin el secreto correcto recibe 401 antes
// de que se toque la base de datos.
//
// Flujo por cada una de las 4 tablas de origen:
//   1. Lee la marca de agua de public.security_sheet_export_state.
//   2. Con el service_role, SELECT sobre la vista de forma
//      (security_sheet_*_v) de las filas con <ts> > marca, orden asc, tope
//      BATCH_LIMIT. Las vistas ya excluyen toda columna de IP.
//   3. POST del lote al Web App de Apps Script (SHEET_WEBAPP_URL), con
//      SHEET_WEBAPP_SECRET en el body.
//   4. Solo si Apps Script responde { ok: true }: avanza la marca de agua al
//      timestamp de la última fila del lote. Si algo falla, la marca no se
//      mueve y el siguiente tick del cron reintenta el mismo tramo.
//
// Nada de esto puede afectar al Security Center: es una función aparte que
// solo LEE las vistas y ESCRIBE su propia tabla de marcas de agua.

import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

type SourceSpec = {
  source: string;   // clave en security_sheet_export_state y nombre de pestaña
  view: string;     // vista de forma a leer
  ts: string;       // columna de marca de agua
  headers: string[]; // orden de columnas para la hoja
};

// El orden de `headers` fija el orden de columnas de cada pestaña y debe
// coincidir con las columnas de la vista correspondiente en la migración.
const SOURCES: SourceSpec[] = [
  {
    source: "security_events",
    view: "security_sheet_events_v",
    ts: "created_at",
    headers: [
      "event_id", "created_at", "event_type", "severity", "result",
      "user_id", "user_email", "user_display",
      "resource_type", "resource_id", "session_id", "metadata_json",
    ],
  },
  {
    source: "security_admin_audit_log",
    view: "security_sheet_audit_v",
    ts: "created_at",
    headers: [
      "id", "created_at", "action",
      "admin_id", "admin_email",
      "target_user_id", "target_user_email",
      "reason", "metadata_json",
    ],
  },
  {
    source: "security_ip_blocks",
    view: "security_sheet_ip_blocks_v",
    ts: "created_at",
    headers: [
      "id", "created_at", "reason", "severity",
      "created_by", "created_by_email",
      "expires_at", "unblocked_at", "unblocked_by", "unblocked_by_email",
    ],
  },
  {
    source: "account_security_state",
    view: "security_sheet_account_state_v",
    ts: "updated_at",
    headers: [
      "user_id", "user_email", "status", "status_reason",
      "status_set_by", "status_set_by_email", "status_set_at", "updated_at",
    ],
  },
];

// Filas por tabla y por tick. Con cadencia de 5 min esto drena hasta
// 6.000 filas/hora/tabla; si alguna vez se acumula más (ataque sostenido),
// se pone al día 500 por tick sin saturar Apps Script.
const BATCH_LIMIT = 500;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparación en tiempo constante: no filtra el secreto por timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function exportSource(
  supabase: SupabaseClient,
  spec: SourceSpec,
  webappUrl: string,
  webappSecret: string,
): Promise<Record<string, unknown>> {
  const { data: stateRow, error: stateErr } = await supabase
    .from("security_sheet_export_state")
    .select("last_exported_at")
    .eq("source_table", spec.source)
    .single();
  if (stateErr) throw new Error(`marca de agua: ${stateErr.message}`);

  const since: string = stateRow.last_exported_at;

  const { data: rows, error: rowsErr } = await supabase
    .from(spec.view)
    .select("*")
    .gt(spec.ts, since)
    .order(spec.ts, { ascending: true })
    .limit(BATCH_LIMIT);
  if (rowsErr) throw new Error(`lectura de ${spec.view}: ${rowsErr.message}`);
  if (!rows || rows.length === 0) return { ok: true, appended: 0 };

  const res = await fetch(webappUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({
      secret: webappSecret,
      sheet: spec.source,
      headers: spec.headers,
      rows,
    }),
  });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!body || body.ok !== true) {
    throw new Error(`Apps Script: ${(body && body.error) || "respuesta no ok"}`);
  }

  const maxTs = rows[rows.length - 1][spec.ts];
  const { error: updErr } = await supabase
    .from("security_sheet_export_state")
    .update({ last_exported_at: maxTs, updated_at: new Date().toISOString() })
    .eq("source_table", spec.source);
  if (updErr) throw new Error(`avance de marca: ${updErr.message}`);

  return {
    ok: true,
    appended: rows.length,
    watermark: maxTs,
    more: rows.length === BATCH_LIMIT,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const triggerSecret = Deno.env.get("EXPORT_TRIGGER_SECRET");
  if (!triggerSecret) return json({ error: "Configuración del servidor incompleta" }, 500);

  const received = req.headers.get("x-export-trigger-secret") || "";
  if (!timingSafeEqual(received, triggerSecret)) return json({ error: "No autorizado" }, 401);

  const webappUrl = Deno.env.get("SHEET_WEBAPP_URL");
  const webappSecret = Deno.env.get("SHEET_WEBAPP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webappUrl || !webappSecret || !supabaseUrl || !serviceKey) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: Record<string, unknown> = {};
  let anyError = false;
  for (const spec of SOURCES) {
    try {
      summary[spec.source] = await exportSource(supabase, spec, webappUrl, webappSecret);
    } catch (err) {
      anyError = true;
      summary[spec.source] = { ok: false, error: String(err instanceof Error ? err.message : err) };
    }
  }

  // 207-ish: se devuelve 200 si todo fue bien, 502 si alguna tabla falló
  // (para que quede en los logs de pg_net / net._http_response), pero las
  // tablas que sí exportaron ya avanzaron su marca y no se repetirán.
  return json({ ok: !anyError, summary }, anyError ? 502 : 200);
});
