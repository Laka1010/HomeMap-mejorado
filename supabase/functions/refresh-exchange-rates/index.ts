// Actualiza public.exchange_rates con los tipos de cambio actuales contra EUR.
//
// La llama EXCLUSIVAMENTE el cron de Postgres (ver
// 20260916_108_exchange_rates.sql), nunca el cliente: verify_jwt = false y la
// autorización es el secreto compartido de la cabecera
// x-exchange-rates-trigger-secret, comprobado en tiempo constante contra
// EXCHANGE_RATES_TRIGGER_SECRET. Un llamante sin el secreto correcto recibe
// 401 antes de que se toque la base de datos.
//
// Flujo:
//   1. GET a la API pública de Frankfurter (datos del BCE, sin API key) con
//      base=EUR.
//   2. Se queda solo con las divisas que Haven conoce (CURRENCY_CODES, debe
//      coincidir con CURRENCIES en src/utils/currencyUtils.js).
//   3. Upsert en exchange_rates con el service_role.

import { createClient } from "npm:@supabase/supabase-js@2";

const CURRENCY_CODES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "MXN", "BRL", "ARS"];

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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const triggerSecret = Deno.env.get("EXCHANGE_RATES_TRIGGER_SECRET");
  if (!triggerSecret) return json({ error: "Configuración del servidor incompleta" }, 500);

  const received = req.headers.get("x-exchange-rates-trigger-secret") || "";
  if (!timingSafeEqual(received, triggerSecret)) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  let rates: Record<string, number>;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR");
    if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
    const body = await res.json();
    if (!body || typeof body.rates !== "object") throw new Error("Respuesta sin 'rates'");
    rates = body.rates;
  } catch (err) {
    return json({ error: `No se pudo leer la API de tipos de cambio: ${String(err instanceof Error ? err.message : err)}` }, 502);
  }

  // EUR no aparece en las rates de Frankfurter (es la propia base) — se fija a 1.
  const rows = CURRENCY_CODES.map((code) => ({
    currency_code: code,
    rate_to_eur: code === "EUR" ? 1 : rates[code],
    updated_at: new Date().toISOString(),
  })).filter((row) => typeof row.rate_to_eur === "number" && row.rate_to_eur > 0);

  if (rows.length === 0) return json({ error: "Ninguna divisa conocida en la respuesta de Frankfurter" }, 502);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("exchange_rates").upsert(rows, { onConflict: "currency_code" });
  if (error) return json({ error: `Upsert de exchange_rates: ${error.message}` }, 500);

  return json({ ok: true, updated: rows.length });
});
