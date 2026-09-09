# Haven

App para organizar el hogar (habitaciones, zonas, cajas y objetos) y lo que
pasa en él: compras, tareas, economía y calendario, en solitario o compartido
con la familia / compañeros de piso.

- **Frontend:** React 18 + Vite, sin router (navegación por estado).
- **Backend:** Supabase (Postgres + RLS + funciones `SECURITY DEFINER`, Auth, Storage).
- **Móvil:** Capacitor (Android / iOS).
- **Idiomas:** español, catalán, inglés (`src/i18n.js`).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

El dev server abre en la pantalla de login de Supabase; necesitas una cuenta
del proyecto para entrar.

## Scripts

| Script | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite, `--host`). |
| `npm run build` | Build de producción web (incluye la consola de admin). |
| `npm run build:capacitor` | Build para el envoltorio nativo (sin `admin.html`). |
| `npm run lint` | ESLint. |
| `npm test` | Tests unitarios (Vitest). |
| `npm run migrations:check` | Verifica que las migraciones SQL locales están aplicadas (necesita `SUPABASE_ACCESS_TOKEN`). |
| `npm run cap:sync` | Build capacitor + `cap sync` (con guardián de "sin admin en dist"). |
| `npm run android:bundle` | AAB firmado para Play Store. |

## Estructura

```
src/
  App.jsx              raíz: routing por estado, design system (GlobalStyle), modales
  main.jsx             entrada web + ErrorBoundary
  admin/               consola de administración (admin.html, nunca va al build nativo)
  components/          UI compartida, auth, onboarding, ajustes, wizards
  hooks/               useAuthSession, useHomesAndMembers, useTheme, useFocusTrap…
  modules/             dashboard, economy, shopping, tasks, notes, calendar, security, home
  i18n.js              catálogo de traducciones
supabase/migrations/   esquema versionado (fuente de verdad de la BD)
scripts/               utilidades de release (keystore, publicar docs legales, guardas de build)
```

## Documentación

- [`AUDITORIA_HAVEN_1.0.md`](AUDITORIA_HAVEN_1.0.md) — auditoría pre-1.0 (2026-08-02).
- [`PLAY_STORE_PREPARATION.md`](PLAY_STORE_PREPARATION.md) — pasos y checklist de publicación.
- [`docs/legacy/`](docs/legacy/) — documentación antigua (obsoleta, solo historial).
