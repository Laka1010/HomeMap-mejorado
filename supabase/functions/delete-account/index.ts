import { createClient } from "npm:@supabase/supabase-js@2";

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

// El gateway de Supabase ya verificó la firma del JWT antes de invocar esta
// función (verify_jwt = true), así que confiar en el "sub" del payload aquí
// es seguro. Solo se usa para borrar la propia cuenta del llamante -- nunca
// se acepta un user_id por parámetro.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 204);
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const userId = getUserIdFromAuthHeader(req);
  if (!userId) {
    return jsonResponse({ error: "No autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // A-3: una IP bloqueada en el Security Center no puede borrar cuentas.
  if (await isIpBlocked(admin, clientIp(req))) {
    return jsonResponse({ error: "Acceso bloqueado desde esta red" }, 403);
  }

  try {
    // Bloquear el borrado si el usuario es propietario ('admin') de alguna
    // casa con más miembros: houses.created_by tiene ON DELETE CASCADE hacia
    // auth.users, así que borrar esta cuenta borraría también esa casa
    // entera -- destruyendo los datos compartidos del resto de la familia
    // sin que ellos lo pidan ni lo sepan. Mejor pedirle al usuario que
    // transfiera la propiedad o elimine/abandone la casa primero.
    const { data: ownedRows, error: ownedError } = await admin
      .from("home_members")
      .select("house_id")
      .eq("user_id", userId)
      .eq("role", "admin");

    if (ownedError) {
      return jsonResponse({ error: "No se pudieron verificar tus casas" }, 500);
    }

    for (const row of ownedRows ?? []) {
      const { count, error: countError } = await admin
        .from("home_members")
        .select("user_id", { count: "exact", head: true })
        .eq("house_id", row.house_id);

      if (countError) {
        return jsonResponse({ error: "No se pudieron verificar los miembros de tus casas" }, 500);
      }
      if ((count ?? 0) > 1) {
        return jsonResponse(
          {
            error: "blocked_owner",
            message:
              "Eres propietario de una casa con más miembros. Transfiere la propiedad o elimina la casa antes de borrar tu cuenta.",
          },
          409
        );
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return jsonResponse({ error: message }, 500);
  }
});
