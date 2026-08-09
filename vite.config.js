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
