import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Guardia de refuerzo para cap:sync. La exclusión real de Admin Console del
 * build de Capacitor ya la hace vite.config.js (modo "capacitor" no incluye
 * admin.html como entrada de Rollup). Este script existe para el caso en
 * que alguien ejecute `npx cap sync` a mano después de un `npm run build`
 * normal (que sí incluye admin.html) sin pasar por `npm run cap:sync`: en
 * vez de dejar que Admin Console se cuele en el proyecto nativo en
 * silencio, el propio script de cap:sync falla explícitamente si detecta
 * dist/admin.html.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const adminHtmlPath = resolve(__dirname, "..", "dist", "admin.html");

if (existsSync(adminHtmlPath)) {
  console.error(
    "\n[cap:sync] ABORTADO: dist/admin.html existe todavia.\n" +
      "Admin Console no debe empaquetarse en Capacitor. Esto pasa si dist/\n" +
      "se generó con `npm run build` (bundle web, incluye admin.html) en vez\n" +
      "de `npm run build:capacitor` (usado automáticamente por cap:sync).\n" +
      "Borra dist/ y vuelve a ejecutar `npm run cap:sync`.\n"
  );
  process.exit(1);
}

console.log("[cap:sync] OK: dist/ no contiene admin.html.");
