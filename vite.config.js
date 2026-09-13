import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // El build de Capacitor (npm run build:capacitor, usado por cap:sync)
  // NUNCA incluye admin.html como entrada — Rollup ni siquiera atraviesa
  // src/admin/** en ese modo, así que ningún archivo de Admin Console
  // llega a dist/ ni, por tanto, al proyecto nativo Android/iOS. Ver
  // scripts/assert-no-admin-in-dist.js para la comprobación de refuerzo.
  const isCapacitorBuild = mode === "capacitor";

  return {
    plugins: [react()],
    server: {
      // Permite probar el servidor de desarrollo desde el móvil vía un túnel
      // (p.ej. cloudflared trycloudflare.com) cuando no está en la misma
      // wifi que el ordenador -- Vite bloquea por defecto cualquier Host
      // que no sea localhost/IP local. Solo afecta a `npm run dev`, nunca
      // a `npm run build`.
      allowedHosts: [".trycloudflare.com"],
    },
    build: {
      rollupOptions: {
        input: isCapacitorBuild
          ? {
              main: resolve(__dirname, "index.html"),
            }
          : {
              main: resolve(__dirname, "index.html"),
              admin: resolve(__dirname, "admin.html"),
            },
      },
    },
  };
});
