import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * Config mínima pero real: el objetivo de esta primera versión no es imponer
 * un estilo, es tener la RED DE SEGURIDAD que el proyecto no tenía —
 * sobre todo `react-hooks/rules-of-hooks` y `exhaustive-deps` (los
 * `// eslint-disable-next-line react-hooks/exhaustive-deps` que ya hay en el
 * código no los leía nadie hasta ahora) y detectar variables/imports sin usar.
 *
 * Arrancar con muchas reglas a "warn" en vez de "error" para no bloquear el
 * build con cientos de avisos de golpe; subirlas a "error" de forma
 * incremental a medida que se limpian.
 */
export default [
  { ignores: ["dist/**", "android/**", "ios/**", "node_modules/**", "supabase/functions/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "react/prop-types": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off",
    },
  },
];
