import { readdirSync, readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Guardia de deriva entre supabase/migrations/ y lo que hay REALMENTE aplicado
 * en la base de datos remota.
 *
 * Por qué existe: la auditoría de seguridad encontró que
 * 20260828_071_harden_invite_codes.sql llevaba tres días en el repositorio, con
 * su hallazgo dado por cerrado, sin haberse aplicado nunca a producción. El
 * agujero crítico (códigos de invitación de 4 caracteres hex, sin límite de
 * intentos) seguía abierto y nadie lo sabía porque el fichero estaba commiteado.
 * Un `git log` no distingue "escrito" de "desplegado". Este script sí.
 *
 * Cómo compara: por SLUG, no por versión. El timestamp de una migración
 * aplicada lo genera el servidor y no coincide con el prefijo del fichero
 * (20260828_071_harden_invite_codes.sql -> versión 20260831134738, nombre
 * "harden_invite_codes"), así que comparar versiones daría todo por distinto.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/assert-migrations-applied.js
 *   MIGRATIONS_FILE=applied.txt node scripts/assert-migrations-applied.js
 *
 * La segunda forma permite ejecutarlo sin credenciales: basta con volcar los
 * nombres aplicados (uno por línea, o el JSON de la API) a un fichero. Es
 * también la forma de probarlo en local.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "..", "supabase", "migrations");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "issxagrlwqubrzorahsn";

/**
 * Migraciones cuyo fichero existe con un nombre y se aplicaron con otro, en los
 * primeros días del proyecto. Están todas aplicadas de verdad -- sus objetos
 * (houses, economy_bills, rooms, tasks, la vista de moneda) existen en la base
 * de datos. Se listan aquí explícitamente para que el guardián no dé ruido, en
 * vez de bajar el listón de la comprobación.
 *
 * No añadas nada a esta lista para silenciar un aviso: si una migración nueva
 * aparece aquí, el aviso es REAL y lo que hay que hacer es aplicarla.
 */
const DIVERGENCIAS_HISTORICAS = new Set([
  "houses_members_roles",
  "economy_tables",
  "home_content",
  "tasks",
  "currency_view_fix",
]);

/** `20260828_071_harden_invite_codes.sql` -> `harden_invite_codes` */
function slugDeFichero(nombre) {
  return nombre.replace(/^\d{8}_\d{3}_/, "").replace(/\.sql$/, "");
}

function slugsDelRepo() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map(slugDeFichero);
}

/** Acepta tanto una línea por nombre como el JSON que devuelve la API. */
function parsearAplicadas(texto) {
  const limpio = texto.trim();
  if (limpio.startsWith("[") || limpio.startsWith("{")) {
    const datos = JSON.parse(limpio);
    const filas = Array.isArray(datos) ? datos : datos.migrations || [];
    return filas.map((m) => (typeof m === "string" ? m : m.name)).filter(Boolean);
  }
  return limpio.split("\n").map((l) => l.trim()).filter(Boolean);
}

async function aplicadasDesdeApi(token) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`La API de Supabase respondió ${res.status}: ${await res.text()}`);
  }
  return parsearAplicadas(await res.text());
}

async function obtenerAplicadas() {
  const fichero = process.env.MIGRATIONS_FILE;
  if (fichero) {
    if (!existsSync(fichero)) {
      throw new Error(`MIGRATIONS_FILE apunta a un fichero que no existe: ${fichero}`);
    }
    return parsearAplicadas(readFileSync(fichero, "utf8"));
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Falta cómo consultar las migraciones aplicadas.\n" +
        "  Define SUPABASE_ACCESS_TOKEN (token personal de Supabase), o\n" +
        "  define MIGRATIONS_FILE con un volcado de los nombres aplicados."
    );
  }
  return aplicadasDesdeApi(token);
}

/** Núcleo puro: separado de la E/S para poder probarlo sin red. */
export function compararMigraciones(repo, aplicadas) {
  const yaAplicadas = new Set(aplicadas);
  return repo
    .filter((slug) => !yaAplicadas.has(slug))
    .filter((slug) => !DIVERGENCIAS_HISTORICAS.has(slug))
    .sort();
}

async function main() {
  const repo = slugsDelRepo();
  const aplicadas = await obtenerAplicadas();
  const pendientes = compararMigraciones(repo, aplicadas);

  if (pendientes.length > 0) {
    console.error(
      `\n[migraciones] ABORTADO: ${pendientes.length} migracion(es) del repositorio ` +
        `NO están aplicadas en la base de datos:\n` +
        pendientes.map((s) => `  - ${s}`).join("\n") +
        `\n\nEsto es exactamente lo que dejó vivo el hallazgo crítico de los códigos\n` +
        `de invitación: el fichero estaba commiteado pero nunca se aplicó.\n` +
        `Aplícalas antes de desplegar.\n`
    );
    process.exit(1);
  }

  console.log(
    `[migraciones] OK: las ${repo.length} migraciones del repositorio están aplicadas ` +
      `(${DIVERGENCIAS_HISTORICAS.size} divergencias históricas de nombre, conocidas y verificadas).`
  );
}

main().catch((err) => {
  console.error(`\n[migraciones] No se pudo comprobar: ${err.message}\n`);
  process.exit(1);
});
