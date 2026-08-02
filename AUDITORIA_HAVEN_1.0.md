# Auditoría definitiva — Haven v1.0 (pre-publicación)

**Fecha:** 2026-08-02
**Alcance:** revisión completa de código, arquitectura, base de datos, seguridad, navegación, UX/UI, estética, responsive y preparación para Google Play / App Store. Sin cambios de producto: solo se señalan defectos sobre lo ya construido.

**Metodología:** lectura completa del código fuente (124 archivos, ~19.500 líneas), de las 21 migraciones SQL locales + verificación en vivo contra el proyecto Supabase real (`issxagrlwqubrzorahsn`: esquema, RLS policies reales vía `pg_policies`, funciones `SECURITY DEFINER`, advisors de seguridad/rendimiento), build de producción real (`npm run build`), configuración nativa Android/iOS, y navegación en vivo de la pantalla de acceso en viewport móvil. Siete revisores especializados (arquitectura/código, rendimiento, base de datos/permisos, navegación/UX, estética/consistencia/accesibilidad, responsive/tiendas, seguridad) trabajaron en paralelo sobre el código real; cada hallazgo está verificado con archivo y línea, no es una suposición genérica.

---

## Resumen ejecutivo — lo que hay que arreglar antes de publicar

| # | Hallazgo | Fase | Severidad |
|---|---|---|---|
| 1 | Código de invitación de casa de solo 4 caracteres, sin rate limiting → cualquier usuario registrado puede fuerza-bruta unirse a una casa ajena con rol `adult` (acceso a Economía incluido) | BD (4) | 🔴 |
| 2 | La app no maneja el botón físico "atrás" de Android en ningún punto (falta el plugin `@capacitor/app`) → la app se minimiza/cierra con el primer toque en cualquier pantalla | Navegación (6) | 🔴 |
| 3 | No existe ningún `ErrorBoundary` — cualquier excepción de render deja al usuario con una pantalla en blanco total, sin recuperación | Play/App Store (13) | 🔴 |
| 4 | `profiles` expone email y nombre de **todos** los usuarios registrados en Haven a cualquier usuario autenticado, sin relación de casa | BD (4) | 🟠→🔴* |
| 5 | Resultado "miembro" del buscador global no hace nada (bug de un `return` faltante) | Navegación (6) | 🔴 |
| 6 | Versión de iOS en Xcode desincronizada (1.0/build 1) frente a Android/`package.json` (1.1.0) | Play/App Store (13) | 🔴 |
| 7 | `src/App.jsx` es un god-file de 4062 líneas que mezcla routing, estilos globales, ~40 funciones de negocio y ~25 componentes | Arquitectura (1) | 🔴 |
| 8 | `economyService` traga errores del servidor en vez de lanzarlos → un pago/gasto puede fallar en el servidor y la UI lo da por guardado | Código (2) | 🟠 |
| 9 | `house_activity`/`notifications` no filtran por rol la categoría "finanzas" a nivel de RLS (solo en cliente) — contradice la garantía de aislamiento documentada en el propio código | BD/Permisos (4-5) | 🟠 |
| 10 | Cascada de 8 fetches secuenciales al cargar una casa + motor de notificaciones con ~16 queries en cada cambio de estado | Rendimiento (3) | 🔴 |
| 11 | Sin safe-area (`env(safe-area-inset-*)`) pese a `viewport-fit=cover` → barra inferior y modales pueden solaparse con el gesto de inicio en iPhone | Responsive (9) | 🔴 |
| 12 | `WelcomeGate` (onboarding, 875 líneas) es un sistema de diseño paralelo completo, sin ninguna variable del design system y sin dark mode | Consistencia (10) | 🔴 |
| 13 | Sin ESLint ni tests automatizados en todo el proyecto | Código (2) | 🟠 |
| 14 | Contraste `--pin`/`--pin-soft` (breadcrumbs de ubicación en Hogar) en 2.42:1, muy por debajo de WCAG AA | Accesibilidad (12) | 🔴 |
| 15 | Ningún modal tiene `role="dialog"`/`aria-modal` ni gestión de foco | Accesibilidad (12) | 🔴 |

*(4) se valora 🟠 por el propio auditor de BD pero se eleva su visibilidad aquí por tratarse de una fuga de PII (email) a escala de toda la base de usuarios, no solo de una casa.*

No se encontró ningún secreto expuesto en el cliente, XSS explotable, inyección SQL ni bypass de autorización en las funciones RPC de gestión de casa — el diseño de fondo (RLS + RPC `SECURITY DEFINER`, Storage privado por `house_id`, sesión gestionada solo por el SDK oficial) es sólido. Los problemas críticos están concentrados en: **el código de invitación (puerta de entrada a los datos)**, **la ausencia total de manejo del botón atrás de Android**, y **la falta de red de seguridad ante errores en producción (ErrorBoundary, tests, linter)**.

---

## FASE 1 — Arquitectura

### 🔴 App.jsx es un god-file de 4062 líneas
Mezcla: hoja de estilos global completa en CSS-in-JS, mapas de iconos, un hook de persistencia con 8 llamadas a Supabase, ~15 funciones helper, ~25 componentes de UI/modales, y el componente raíz con +40 funciones de negocio (`src/App.jsx`). Cualquier cambio no relacionado obliga a tocar el mismo archivo que gobierna routing y modales; imposible testear unitariamente; alto riesgo de conflictos de merge.
**Solución:** extraer a hooks custom (`useHomeState`, `useNotificationsEngine`, `useModalStack`) y mover los formularios "quick add" a componentes propios, siguiendo el patrón que ya usan `AddShoppingModal`/`AddMovementModal`. **Riesgo:** alto si se hace de golpe; bajo-medio si es incremental, función por función.

### 🟠 Sistema de rutas dual e inconsistente ("cajas" fuera del pilar Hogar)
`NAV` (`App.jsx:2031`) solo define `inicio/hogar/organizacion/economia`, pero `goTo({tab:"cajas"})` (usado desde `MiCasa` y `GlobalSearchModal.jsx:34`) no pasa por el mapeo a pilares y cae en una rama "BACKWARDS COMPATIBILITY" (`App.jsx:3634`). Resultado: al entrar en una caja desde Hogar o desde el buscador, ninguna pestaña del `Sidebar`/`BottomNav` queda resaltada. Además, la rama viva de `Cajas` dentro de "Hogar" (`micasaView?.showCajas`) es código muerto verificado: nada activa ese flag, así que el listado general de cajas es inalcanzable por navegación normal.
**Solución:** hacer que `goTo({tab:"cajas"})` navegue al pilar `hogar` con el sub-estado correspondiente, eliminando la rama de compatibilidad. **Riesgo:** medio, toca navegación central.

### 🟠 Doble filosofía de manejo de errores entre servicios (bug real en Economía)
`taskService`, `notesService`, `shoppingService` siempre `throw` en error. `economyService.js` en cambio traga el error (`console.error` + `return null`) en `updateBill/updateExpense/updateIncome/deleteBill/deleteExpense/deleteIncome` (líneas 194-324). Consecuencia verificada: `BillsSection.jsx:98-121` (`markAsPaid`) y `MovementsSection.jsx:90-123` envuelven la llamada en `try/catch`, pero como el servicio nunca lanza, **el catch nunca se ejecuta** — si el guardado falla en el servidor (RLS, red), la UI cierra el modal como si hubiera ido bien y el usuario cree que una factura está pagada cuando no lo está en el servidor. El propio archivo `BillsSection.jsx` mezcla ambos estilos (`confirmRemoveBill` sí comprueba el booleano de retorno), confirmando que es un descuido, no una decisión de diseño.
**Solución:** unificar `economyService` al contrato `throw` del resto de servicios. **Riesgo:** medio — datos económicos reales; revisar los ~15 call-sites tras el cambio.

### 🟠 `EconomyOverview.jsx` consulta Supabase directamente, duplicando `economyService`/`useDashboardEconomy`
Repite las mismas queries de ingresos/gastos/facturas del mes que ya resuelve `useDashboardEconomy`, dejando `economyService.getMonthBalance/getExpensesByCategory/getNextBill` como código muerto (verificado por grep). Además, `EconomyModule.jsx:71` fuerza un `key={page:refreshToken}` que **remonta todo el módulo al cambiar de sub-pestaña** dentro de Economía, disparando una recarga de red completa de Overview → Estadísticas → Overview sin ningún caché.
**Solución:** unificar en un hook compartido de datos de Economía; sustituir el remount forzado por un refetch selectivo ligado solo a `refreshToken`. **Riesgo:** medio — el `key` actual corrige un bug real documentado ("factura no aparece"), no quitarlo sin sustituir la causa.

### 🟠 Manipulación directa del DOM (`document.getElementById`) en 5 modales de alta rápida
`addTask`, `editTask`, `addBill`, `addExpense`, `addIncome` (`App.jsx` ~3820-4025) leen valores con `document.getElementById(...).value` en vez de estado controlado, a diferencia de `AddShoppingModal`/`AddMovementModal`/`AddZoneModal` en el mismo proyecto. Anti-patrón de React e inconsistente dentro del mismo archivo.
**Solución:** convertir a componentes controlados como el resto. **Riesgo:** bajo, aislado a 5 formularios.

### 🟠 No hay ESLint configurado
Sin `.eslintrc*`/`eslint.config.js` ni dependencia en `package.json`. Existen 3 comentarios `// eslint-disable-next-line react-hooks/exhaustive-deps` que hoy no hacen nada porque no hay linter que los lea. Sin esta red de seguridad automática antes del 1.0, todo lo que este informe encontró a mano (dependencias de `useEffect` incorrectas, imports muertos) pasa desapercibido en cada nuevo cambio.
**Solución:** añadir `eslint` + `eslint-plugin-react-hooks`. **Riesgo:** bajo, solo tooling.

### 🟡 Otros hallazgos de arquitectura
- **Triplicación del mapeo icono-por-habitación** en `App.jsx`, `AddRoomWizard.jsx` y `StepLocation.jsx`, ya desincronizados entre sí (emojis distintos). Mover a `utils/roomIcons.js` único.
- **Triple envoltorio "passthrough"** en Dashboard y wrappers de un solo nivel en Compras/Tareas/Notas/Calendario sin transformar props — indirección sin valor, eliminar.
- **`WelcomeGate.jsx` no usa el theming de la app** (ver detalle completo en Fase 10, es el hallazgo más grave de consistencia de todo el informe).
- **Hoja de estilos global embebida como string JS** (`GlobalStyle`, ~270 líneas) en vez de un `.css` real importado por Vite — no aprovecha minificación/tree-shaking.
- **`getDaysUntil` duplicada de forma idéntica en 3 archivos** (`calendarUtils.js`, `BillsSection.jsx`, `EconomyOverview.jsx`).
- **~28 `useState` independientes** en `HomeMapAppInner` con transiciones acopladas entre sí — candidato a `useReducer`/hooks por dominio.
- 🟢 **Código muerto verificado:** `StatChip`, `FitCheckerModal` (nunca renderizados), `ReceiptScanModal.jsx` (295 líneas implementadas pero sustituidas por un placeholder "próximamente"), los 3 métodos muertos de `economyService` ya mencionados.

---

## FASE 2 — Calidad de código

### 🟠 Fallo silencioso en operaciones de Economía
Ver Fase 1 — mismo hallazgo, con impacto directo en la fiabilidad de la sección de Economía en producción.

### 🟠 Patrón "dispatch + notice + logActivity + closeModal + service.create().catch()" copiado ~15 veces
En `addRoom`, `addZone`, `addContainer`, `addObject`, `addShopping`, `addTask`, `addNote`, `addBill`, `addExpense`, `addIncome`, etc. (`App.jsx` 2940-3345). Ya hay divergencias entre copias (algunas llaman `logActivity`, otras no; algunas disparan el evento de onboarding y otras no, sin razón aparente).
**Solución:** factory `createOptimisticAction({...})` que genere estos handlers. **Riesgo:** medio, migrar de uno en uno con pruebas manuales.

### 🟡 `useEffect` de notificaciones con dependencia `state` completo
`App.jsx:2570-2578` — cualquier mutación de cualquier módulo dispara (con debounce de 1.5s) una reevaluación completa del motor de notificaciones. Ver detalle de coste real en Fase 3. **Solución:** derivar un contador de versión más granular como dependencia.

### 🟡 Falta de un hook `useAsyncData` compartido
`BillsSection`, `MovementsSection`, `StatisticsSection`, `GoalsSection`, `EconomyOverview` reimplementan cada uno manualmente el mismo esqueleto loading/error/try-catch. No es incorrecto, es la quinta repetición del mismo patrón.

### 🟢 Puntos positivos verificados
`src/currency.jsx`/`utils/currencyUtils.js` cachean correctamente instancias de `Intl.NumberFormat` con `useMemo`; el manejo de errores en el resto de servicios (tasks/notes/shopping) es correcto y consistente.

---

## FASE 3 — Rendimiento

### 🔴 Cascada de 8 fetches secuenciales al cargar cada casa
`useHomeMapState` (`App.jsx:481-584`) encadena 8 `await` en serie (tasks, notes, shopping lists/purchases/items, categories, activity) que no dependen entre sí. En una conexión móvil normal (150-250ms RTT) esto añade 1-2 segundos de latencia acumulada solo en la carga inicial, repetido en cada cambio de casa.
**Solución:** `Promise.allSettled` para los pasos 2-8. **Riesgo:** bajo-medio, revisar la lógica de "seeding" que hoy asume orden secuencial.

### 🔴 Motor de notificaciones: hasta ~16 queries secuenciales en cada cambio de estado, y cada 15 minutos sin comprobar visibilidad
`App.jsx:2570-2588` depende de `state` completo (cualquier cambio en cualquier módulo lo dispara tras 1.5s de debounce); dentro de `engine.js`, un `for` secuencial de 7 reglas hace hasta 14 queries adicionales una detrás de otra. El `setInterval` de 15 min tampoco pausa cuando la app está en segundo plano (`document.visibilityState`).
**Solución:** acotar la dependencia del efecto a las partes de `state` relevantes, paralelizar el `for` de reglas, pausar el intervalo si la pestaña no es visible. **Riesgo:** medio.

### 🔴 Campo `photo` legado sin comprimir, descargado en cada carga de casa
`StepPhoto.jsx`/`WelcomeGate.jsx` guardan fotos como base64 sin redimensionar (solo límite de 5MB) en la columna `photo` de `objects`/`rooms`, y `fetchHomeContent` la trae con `select("*")` en cada apertura de la app. Con 100 objetos con foto de cámara (2-4MB típico), la carga inicial podría transferir cientos de MB. El sistema *nuevo* (`entityPhotosService` + Storage) sí comprime correctamente (máx. 1600px, JPEG 0.82) — el problema es que el flujo de creación inicial (wizard, onboarding) sigue usando el campo legado.
**Solución:** migrar `StepPhoto`/`WelcomeGate` a `compressImage`/Storage, o al menos excluir `photo` del `select("*")` y cargarla bajo demanda. **Riesgo:** medio.

### 🔴 `HomeMapAppInner` sin `React.memo` en ningún componente del árbol
0 usos de `React.memo` en todo el proyecto. Cualquiera de los 53 `useState` re-renderiza `AppHeader`/`Sidebar`/`BottomNav`/el módulo activo. **Solución:** memoizar los componentes de shell persistente. **Riesgo:** bajo con memo simple.

### 🟠 Wizards de creación y `WelcomeGate` fuera del lazy-loading
Ya existe code-splitting parcial y bien hecho (`EconomyModule`, `ShoppingModule`, `TasksModule`, `CalendarModule`, `NotesModule`, `AccountHub`, etc. — confirmado en el build real, chunks entre 3-43KB). Pero `WelcomeGate.jsx` (875 líneas), los wizards `Add*Wizard` + sus `Step*` (~1400 líneas combinadas), `AuthView.jsx`, `OnboardingManager`/`FeatureGuide` y `GlobalSearchModal` siguen eager en el bundle principal (763KB minificados, 206KB gzip — Vite avisa explícitamente de chunks >500KB). Esto explica gran parte del peso del chunk principal.
**Solución:** aplicar `lazy()` con el mismo patrón ya usado y validado en el propio proyecto. **Riesgo:** bajo, patrón ya probado.

### 🟠 Otros
- `MovementsSection.jsx` relanza una query de red completa al cambiar el filtro de periodo aunque el filtrado sea 100% client-side (`period` no debería estar en las dependencias del efecto de red).
- Listas de objetos/cajas sin virtualizar — con 200+ objetos en un móvil gama baja, jank de scroll notable.
- `objectCountInContainer` recalcula con complejidad cuadrática en cada render sin `useMemo` (~140.000 iteraciones con 50 cajas/500 objetos).

### 🟢 Puntos fuertes verificados
Disciplina de cleanup de `useEffect` **correcta en el 100% de los 26 listeners/timers revisados** (incluida la suscripción a `auth.onAuthStateChange`, con flag `mounted`). No se usa Realtime de Supabase en ningún punto, así que no hay riesgo de fugas de canales. Los índices "unused" que reporta el advisor de Supabase son mayormente ruido esperable con 0-10 filas por tabla en desarrollo, no un problema de queries (excepción real: `zone_id`/`container_id`/`source_task_id` — el patrón "traer todo por house_id y filtrar en memoria" hace esos índices concretos innecesarios mientras no cambie ese patrón de acceso).

---

## FASE 4 — Base de datos

### 🔴 Código de invitación predecible sin rate limiting → acceso cruzado entre casas
`create_house` genera el código con `'HM-' || upper(substr(md5(...), 1, 4))` — solo **4 caracteres hex, 65.536 combinaciones**, permanente (no hay función para regenerarlo) y sin ningún límite de intentos en `join_house_by_code`. Cualquier usuario que registre una cuenta gratuita puede iterar el espacio completo en minutos/horas con una API REST simple y unirse automáticamente con rol **`adult`** (acceso de lectura/escritura a Economía incluido) a una casa ajena.
**Solución:** aumentar la entropía del código (8-10 alfanuméricos), añadir rate limiting real por `auth.uid()` sobre `join_house_by_code`, y una función `regenerate_invite_code` restringida a admin. **Riesgo:** bajo — cambia el formato del código, hay que comunicarlo a códigos ya compartidos.

### 🟠 `profiles` expone email y nombre de todos los usuarios registrados
La policy `profiles_select_authenticated` es `using (true)` — sin filtro de `house_id`. Cualquier usuario autenticado puede leer el email de todos los usuarios de Haven, no solo los de su propia casa.
**Solución:** restringir a usuarios que comparten al menos una casa (`exists (select 1 from home_members hm1 join home_members hm2 on hm1.house_id=hm2.house_id where hm1.user_id=auth.uid() and hm2.user_id=profiles.id)`), y considerar no exponer `email` en esta tabla en absoluto. **Riesgo:** medio, verificar que ninguna pantalla dependa de leer perfiles de no-housemates.

### 🟠 `houses.created_by ON DELETE CASCADE` + "Eliminar cuenta" que no borra nada
Si se borra el `auth.users` del creador de una casa, el cascade destruye **toda la casa para todos los miembros**, aunque tengan cuentas activas. Además, el botón "Eliminar cuenta" del cliente (`App.jsx:2729-2762`) hoy solo hace `localStorage.removeItem` + `signOut()` — no borra nada en Supabase, pese a mostrar el toast de confirmación (problema de cumplimiento RGPD: el usuario cree que se borró y no es así).
**Solución:** cambiar la FK a `ON DELETE SET NULL` (o exigir transferencia de propiedad antes de borrar), implementar el borrado real vía Edge Function con Admin API, y corregir el texto/flujo actual que miente sobre el resultado. **Riesgo:** medio, decisión de negocio sobre qué pasa con una casa sin creador vivo.

### 🟠 RLS de `house_activity`/`notifications` no filtra la categoría "finanzas" por rol
La policy solo exige `is_house_member`, sin mirar `category` ni `economy_override` — contradice el comentario propio de la migración que dice que estas categorías existen "porque los child no ven economía". Un `child` puede leer directamente vía API REST entradas de actividad/notificación categoría `finanzas` (hoy limitado en contenido, pero es una brecha de diseño real).
**Solución:** añadir `and (category is distinct from 'finanzas' or can_manage_economy(house_id))` a ambas policies. **Riesgo:** bajo.

### 🟡 Otros
- 4 migraciones aplicadas en producción (notes/shopping_items/categories/shopping_lists + hardening de índices) **no están en el repositorio** — el repo no es hoy la fuente de verdad completa del esquema. Traerlas con `supabase db pull`.
- `EXECUTE` de las 12 funciones `SECURITY DEFINER` sensibles nunca se revocó de `PUBLIC` (solo se concedió a `authenticated`) — no explotable hoy porque todas validan `auth.uid()`, pero es una capa de defensa ausente.
- "Leaked Password Protection" desactivada en Supabase Auth — activar en el dashboard, sin cambio de código.
- Sin `CHECK` de rango en `amount` de las tablas económicas (permite negativos por parte de un miembro ya autorizado).
- Sin validación de coherencia de `house_id` entre tablas relacionadas (`room_id`/`zone_id`/`container_id` podrían apuntar a otra casa sin que la RLS de lectura lo note, aunque no hay fuga de datos directa).

---

## FASE 5 — Permisos

### Verificado como correcto
Las 12 funciones `SECURITY DEFINER` sensibles (`set_member_role`, `remove_member`, `transfer_house_ownership`, `set_member_economy_access`, etc.) validan siempre la pertenencia real del llamante al `house_id` recibido, bloquean auto-edición/auto-expulsión del admin, y no hay ninguna policy de INSERT/UPDATE/DELETE directa sobre `home_members`/`houses` — toda escritura pasa por estas funciones. El rol `child` está denegado a nivel de RLS (no solo de UI) en las 4 tablas `economy_*` vía `can_manage_economy`, con el override individual (`economy_override`) correctamente implementado y auditado (solo el admin puede tocarlo, con auto-cambio bloqueado). **No se encontró ninguna vía de escalada de privilegios entre casas en la lógica de estas funciones** — el vector real de entrada es el código de invitación (Fase 4).

### 🟠 Notificaciones insertables libremente por cualquier rol, sin gating de categoría
El `with_check` de `notifications` solo exige `is_house_member` — cualquier miembro (incluido `child`) puede insertar directamente vía API REST una notificación con `category: 'finanzas', priority: 'critical'` y contenido inventado, visible para toda la casa como si fuera generada por el sistema.
**Solución:** mover la generación a un Edge Function con `service_role` (cambio mayor) o, como parche inmediato, exigir `can_manage_economy` para insertar `category='finanzas'` igual que en `house_activity`. **Riesgo:** alto si se mueve todo el motor a servidor; bajo si es solo el filtro de categoría.

### 🟡 Otros
- `join_house_by_code` siempre asigna rol `adult` (nunca `child`) — amplifica el impacto del hallazgo crítico de invitación: adivinar el código da acceso a Economía desde el primer segundo.
- `house_activity.actor_name` es texto libre no verificado contra el perfil real — un miembro podría atribuirse una acción con un nombre falso.

---

## Seguridad (OWASP / auditoría transversal)

Sin hallazgos 🔴 críticos (sin secretos expuestos al cliente, sin XSS explotable — 0 usos de `dangerouslySetInnerHTML`/`innerHTML`, sin inyección SQL, sin bypass de autorización en RPCs). El manejo de la API key de OpenAI (edge function `vision-proxy`), el aislamiento de Storage por `house_id` con URLs firmadas, y la gestión de sesión vía SDK oficial de Supabase están correctamente implementados.

### 🟠 `vision-proxy` sin autorización por casa/rol ni rate limiting
La edge function solo comprueba que `provider==="openai"` — cualquier usuario autenticado (incluso sin pertenecer a ninguna casa) puede invocarla ilimitadamente y consumir la cuota de pago de la API key de OpenAI. Tampoco valida tamaño de imagen ni restringe CORS (`Access-Control-Allow-Origin: "*"`).
**Solución:** validar pertenencia a casa/rol dentro de la función, añadir rate limiting por usuario/día, limitar tamaño de payload, restringir CORS al origen real de la app. **Riesgo:** bajo.

### 🟠 Enumeración de usuarios en el registro
`AuthView.jsx` traduce explícitamente el error "User already registered" a un mensaje de UI — permite comprobar si un email está registrado en Haven. El flujo de login sí es correcto (mensaje genérico). **Solución:** mensaje genérico también en registro. **Riesgo:** ninguno.

### 🟠 Datos económicos en `localStorage` no se purgan al cerrar sesión
`handleLogout` (`App.jsx:2715-2727`) solo borra la clave del perfil, no las claves `homemap-house-*` que contienen historial de compras e importes — persisten indefinidamente en el dispositivo tras cerrar sesión (sí se limpian, en cambio, al borrar la cuenta). Relevante en dispositivos compartidos, escenario plausible en una app familiar.
**Solución:** limpiar también esas claves en `handleLogout`. **Riesgo:** bajo.

### 🟡 Otros
- Sin `CHECK` de rango en `amount` (ver Fase 4, repetido aquí como hallazgo de integridad).
- Vite dev server (`npm run dev -- --host`) expuesto a la red — solo relevante si se ejecuta en una red no confiable; no afecta al build de producción empaquetado en Capacitor.
- "Leaked Password Protection" desactivada (ver Fase 4).

---

## FASE 6 — Navegación

### 🔴 Sin manejo del botón físico/gesto "atrás" de Android
`package.json` no incluye `@capacitor/app` (el plugin que expone el evento `backButton`); no hay ningún listener registrado. Al no usar React Router, la navegación no genera historial real en el WebView, así que el comportamiento por defecto de Capacitor es **salir de la app en el primer toque atrás**, en cualquier pantalla, con cualquier modal o wizard abierto a medias.
**Solución:** instalar `@capacitor/app` y registrar un listener que cierre, en orden: modal abierto → drill-down interno → detalle de objeto → pestaña activa a "inicio" → minimizar la app. **Riesgo:** bajo-medio. **Es el bug de navegación más grave del informe: afecta a todos los usuarios Android en cualquier pantalla.**

### 🔴 Resultado "miembro" del buscador global no hace nada
`GlobalSearchModal.jsx` línea 45-47: al seleccionar un miembro, llama a `onOpenMembers?.()` y, sin `return`, cae también en `onClose?.()` — ambos `setModal` se aplican en el mismo tick de React y el segundo pisa al primero, dejando `modal = null`. El usuario busca un miembro, lo pulsa, y no pasa nada.
**Solución:** `return` tras `onOpenMembers?.()`. **Riesgo:** muy bajo, una línea.

### 🟠 El flujo "crear habitación → retomar acción original" se rompe
El `dependencyGuard` promete (según su propio comentario) reabrir automáticamente la acción original tras crear el prerrequisito que faltaba, pero `AddRoomWizard.handleSave` llama a `onClose()` incondicionalmente después de `onSave()`, pisando la reapertura. El usuario crea la habitación y todo se cierra sin explicación, en vez de continuar donde estaba.
**Solución:** no cerrar incondicionalmente en el wizard; dejar que el padre decida. **Riesgo:** bajo, probar los 3 flujos que dependen de "room".

### 🟠 Listado general de "Cajas" inalcanzable + botón atrás no respeta la jerarquía anidada
El flag que mostraría el catálogo completo de cajas (`micasaView.showCajas`) nunca se activa desde ningún control — código muerto de navegación. Dentro de cajas anidadas, el botón atrás siempre vuelve al nivel superior absoluto en vez de subir un nivel.
**Solución:** decidir intencionalmente el acceso al listado de cajas; mantener una pila de `containerId` visitados para el atrás. **Riesgo:** bajo para el atrás, medio para la decisión de IA del listado.

### 🟠 Resultados del buscador navegan a rutas "viejas" sin resaltar ninguna pestaña
`GlobalSearchModal` usa claves de ruta previas a la reestructuración en 4 pilares (`micasa`, `cajas`, `tareas`, `compras`); el campo `oldKeys` pensado para este caso nunca se lee. Tras buscar una tarea/producto, ni el bottom-nav resalta nada ni aparece el selector de sub-pestañas de Organización.
**Solución:** navegar con las claves nuevas, o hacer que `Sidebar`/`BottomNav` resuelvan `oldKeys`. **Riesgo:** bajo-medio.

### 🟡 Otros
- `prevTab` es de un solo nivel (no hay pila de navegación real) — deuda de diseño, no bug hoy.
- Import muerto `DashboardOverview` en `App.jsx:47`.
- Modales/wizards se cierran sin confirmación al tocar fuera, incluso a mitad de un wizard de 6 pasos — riesgo real de pérdida de datos por toque accidental.

---

## FASE 7 — Estética

### 🔴 Tokens tipográficos definidos pero con 0% de adopción
`.hm-h1..hm-caption` están declarados en el design system pero **no se usan en ningún sitio** (verificado por grep) — cada pantalla reescribe el título a mano con `style={{fontSize,fontWeight}}`, y por eso Dashboard (28/700), módulos de Organización (26/600) y Perfil (24/700) tienen tamaños ligeramente distintos sin que nadie lo decidiera así.
**Solución:** sustituir los inline por las clases `.hm-h1`/`.hm-h2` ya existentes. **Riesgo:** bajo-medio, cambio mecánico pero de gran superficie.

### 🔴 Padding de card con 4-6 valores distintos, sobre todo en Economía
El sistema ya define `.hm-card--p12` … `.hm-card--p24`, pero solo `ObjectRow` (Hogar) los usa. Economía por sí sola mezcla 14/16/18/22px entre `EconomyOverview`, `StatisticsSection`, `GoalsSection`, `BillsSection`, `MovementsSection`.
**Solución:** mapear a 2-3 niveles estándar y sustituir los `style={{padding:N}}` inline. **Riesgo:** bajo técnicamente, alta superficie de cambio — hacerlo módulo a módulo con verificación visual.

### 🔴 3 botones "cerrar" de wizard duplicados en CSS, uno sin `aria-label`
`AddRoomWizard`, `AddObjectWizard`, `AddContainerWizard` redefinen cada uno su propia clase local en vez de reutilizar `.hm-modal-close` (ya global). Solo uno de los tres tiene hover propio; ninguno de los tres lleva `aria-label`, a diferencia de casi todos los demás botones de icono de la app.
**Solución:** usar `className="hm-modal-close"` + `aria-label` en los tres. **Riesgo:** bajo.

### 🟠 Colores hardcodeados fuera del sistema de tokens
8 hex en `ActionCenter.jsx` (uno de ellos literalmente duplica `--accent` a mano), paleta `BOX_COLORS` duplicada dos veces, `color="#fff"` sueltos en 8 archivos en vez de `var(--accent-ink)` (riesgo real de bajo contraste en dark mode si cambia el fondo). **Solución:** centralizar en tokens semánticos. **Riesgo:** bajo-medio.

### 🟠 Inputs/selectores con implementaciones divergentes
`.hm-role-select` (34px) y `.wg-input` de `WelcomeGate` (50px, paleta hex propia) no comparten ninguna propiedad con `.hm-input` (44px, el estándar del sistema). **Solución:** dar a ambos los mismos tokens de altura/radio/color.

### 🟡 Otros
- Iconos con tamaños "off-by-one" (13/14/15/16/18/20px) sin estandarizar a 2-3 valores.
- Truncamiento de texto (`text-overflow: ellipsis`) prácticamente ausente fuera de `HouseMembersSection` — nombres largos de objeto/tarea/nota rompen el alineado de filas de una línea.

---

## FASE 8 — UX

### 🟠 Onboarding de creación de hogar con hasta 5-6 pantallas secuenciales
`WelcomeGate.jsx`: nombre+foto → elegir modo de inicio → (si plantilla) galería → (si personalizado) constructor con 4 categorías de checkboxes → preview → crear. Es la fricción más alta de todo el producto, justo en el primer contacto.
**Solución:** fusionar "details" y "startMode" en una sola pantalla; saltar el preview cuando la plantilla es predefinida (no personalizada). **Riesgo:** medio, componente de onboarding central reutilizado también en el dependency-gate y en "crear 2ª casa" — probar los 3 sub-flujos.

### 🟠 Gestión de miembros duplicada en 2-3 sitios con comportamiento distinto
"Compartir casa" y "Miembros y roles" llevan ambos a `HouseMembersSection` (cambiar rol/expulsar **sin confirmación**); solo entrando al detalle desde "Miembros y roles" hay confirmación — el propio código reconoce esta inconsistencia en un comentario sin haberla resuelto del todo.
**Solución:** una única vía "fuente de la verdad" para gestión de roles; expulsar siempre con confirmación, sea inline o desde el detalle. **Riesgo:** bajo-medio.

### 🟠 Borrar un objeto no pide confirmación
A diferencia de borrar la cuenta o expulsar a un miembro desde su ficha (que sí usan `ConfirmDialog`), el icono de papelera en la ficha de un objeto lo borra inmediatamente en un solo toque.
**Solución:** envolver en `ConfirmDialog`, patrón ya existente en el mismo archivo. **Riesgo:** muy bajo.

### 🟡 Otros
- Opción "IA" visible pero permanentemente deshabilitada en el selector de modo de inicio del onboarding — mejor ocultarla que mostrarla rota.
- Habitaciones/zonas/cajas se pueden crear pero **no renombrar ni borrar** desde la UI — cualquier error de tecleo queda fijado para siempre.
- Validación inconsistente entre modales de alta rápida: unos deshabilitan el botón si el campo obligatorio está vacío (`AddShoppingModal`), otros crean el elemento igualmente con un nombre por defecto silencioso (`addTask`, `addBill`, `addExpense`...).
- `ConfirmDialog` tiene los textos "Cancelar"/"Confirmar" fijos en español, sin pasar por `t(...)`, rompiendo la coherencia si la app está en otro idioma — justo en las decisiones más delicadas (borrar cuenta, expulsar, transferir propiedad).

---

## FASE 9 — Responsive

### 🔴 Sin `env(safe-area-inset-*)` pese a declarar `viewport-fit=cover`
Afecta a la barra de navegación inferior flotante, el botón flotante de acciones y el padding inferior de los modales tipo bottom-sheet — en iPhones sin botón físico (todos los modelos actuales), estos elementos pueden solaparse con el gesto del home indicator.
**Solución:** sumar `env(safe-area-inset-bottom)` a los `bottom`/`padding-bottom` afectados. **Riesgo:** bajo, CSS aditivo, sin efecto en Android.

### 🟠 Fila de filtros de Lista de la compra puede desbordar en 320-360px
Con `flexWrap: "nowrap"` forzado, la suma de icono + select + 2 botones ("Favoritos", "Editar categorías") supera el ancho disponible en un iPhone SE; como el contenedor raíz tiene `overflow:hidden`, el botón queda simplemente inalcanzable, no hay scroll visible.
**Solución:** permitir wrap o mover los botones a una segunda fila en móvil. **Riesgo:** bajo.

### 🟡 Otros
- Breakpoints ad-hoc distintos por archivo (600/480/860/900px) sin sistema centralizado — no bloqueante, sí deuda de mantenibilidad.
- Tooltip de onboarding con ancho fijo (320px) que se sale del viewport en pantallas de 320px de ancho.
- Algunos grids usan columnas fijas (`repeat(2/3,1fr)`) en vez de `auto-fit`/`auto-fill` como el resto de la app — deja mucho espacio vacío en tablets grandes.
- 🟢 Truncamiento de texto correctamente gestionado en la mayoría de listas revisadas (única excepción, el punto anterior de "Editar categorías").

---

## FASE 10 — Consistencia

### 🔴 `WelcomeGate` es un sistema de diseño paralelo completo, sin dark mode
0 usos de variables `var(--...)` en las 875 líneas: fondo blanco fijo, grises hex propios, radios y alturas de botón/input distintos del resto de la app (48/50px frente a los 44px "unificados" que el propio código documenta como estándar). Al no responder a `.hm-root.dark`, se muestra siempre en claro aunque el usuario tenga el modo oscuro activado — parpadeo a blanco puro justo en la primera pantalla que ve cualquier usuario nuevo.
**Solución:** migrar los ~80 valores a los custom properties existentes, manteniendo la composición actual. **Riesgo:** medio, alto volumen de cambios en un archivo crítico — probar en claro y oscuro los 3 flujos que lo reutilizan (crear casa, unirse, dependency-gate).

### 🔴 `EmptyState` no exportado → 6 reimplementaciones manuales sin la insignia circular ni la animación
El componente compartido real (`App.jsx:859`) es local y no exportable; Tareas, Notas, Compras, Notificaciones y el buscador reconstruyen el mismo patrón a mano sin el chip circular de acento ni el fade-in.
**Solución:** mover a `src/modules/core/EmptyState.jsx`, exportar, importar en los 5-6 sitios. **Riesgo:** bajo, extracción de componente puro.

### 🟠 Mensajes de error: 3 tonos de rojo distintos para el mismo concepto
`AuthView`/`App.jsx` usan correctamente `var(--danger)`, pero `WelcomeGate` (`.wg-error`) usa un hex propio que ni coincide con el token del sistema — en el mismo flujo de login→onboarding, el rojo de error cambia de tono entre una pantalla y la siguiente.

### 🟠 Confirmaciones de borrado con tratamiento visual distinto entre Economía y Compras
Misma decisión de UX (confirmación inline), resuelta con una caja con fondo `--danger-soft` en Economía y un texto suelto sin caja en Compras — visible en la misma sesión de compra doméstica.
**Solución:** extraer un componente `InlineDeleteConfirm` compartido. **Riesgo:** bajo-medio.

---

## FASE 11 — Microdetalles

### 🔴 4 implementaciones de spinner distintas, con nombres de keyframe y duraciones distintas (0.8s vs 0.9s)
`hmSpin` está redefinido de forma duplicada en dos archivos por casualidad sin colisionar; `AuthView` y `WelcomeGate` usan cada uno su propio `@keyframes` con nombre distinto.
**Solución:** una única `@keyframes` en `GlobalStyle` + clase `.hm-spinner` parametrizable. **Riesgo:** bajo, puramente visual.

### 🟠 Botones de icono circulares con 5 tamaños coexistiendo (28/36/40/42/54px), ninguno usando el token oficial (44px)
Causa directa del salto visual en `AppHeader` (avatar 42px junto a búsqueda/notificaciones 36px en la misma fila).
**Solución:** 2 tamaños oficiales (36 para toolbar secundaria, 44 para acciones principales). **Riesgo:** bajo-medio, revisar solape con el badge de no-leídos.

### 🟡 Otros
- `box-shadow` con 3 valores hardcodeados en el mismo `AppHeader.jsx`, ninguno usando `--shadow-elev-1/2`.
- Transiciones con curvas/duraciones distintas para acciones equivalentes (0.14s del sistema vs 0.2s/0.15s en componentes locales).
- Riesgo de layout shift por falta de truncado (relacionado con Fase 7) — más notorio con datos reales que con los datos demo usados en desarrollo.

---

## FASE 12 — Accesibilidad

Cálculo de contraste WCAG real sobre los tokens del proyecto:

| Par | Uso | Ratio | AA (4.5:1) |
|---|---|---|---|
| `--pin` / `--pin-soft` (claro) | Breadcrumbs de ubicación en Hogar | **2.42:1** | 🔴 Falla incluso el umbral de texto grande |
| `#9b9b9b` / `#fff` (WelcomeGate) | "Cerrar sesión" / "quitar foto" | **2.78:1** | 🔴 Falla gravemente |
| `--accent-ink` / `--accent` (claro) | Botón primario (todos los CTA) | **3.89:1** | 🟠 Falla para texto normal |
| `--accent` / `--surface` (claro) | Iconos/enlaces en acento | **3.89:1** | 🟠 Solo pasa como texto grande |
| `--danger` / `--danger-soft`, `--success` / `--success-soft` (claro) | Errores, indicadores positivos | 4.03 / 4.21 | 🟠 Falla por poco |
| `--ink-soft` / `--bg` | Texto secundario general | 4.93–5.30 | 🟢 Cumple |
| Modo oscuro (todos los pares) | — | 5.3–15.4 | 🟢 Cumple ampliamente |

### 🔴 Breadcrumbs de Hogar por debajo de AA (2.42:1)
Elemento omnipresente en el módulo Hogar (ruta habitación→zona→contenedor). **Solución:** oscurecer `--pin` en modo claro. **Riesgo:** bajo, 1 valor de color.

### 🔴 Ningún modal tiene `role="dialog"`/`aria-modal`, ni gestión de foco
0 ocurrencias en todo el proyecto. El componente `Modal` compartido, usado por casi todos los formularios, no mueve el foco al abrir, no lo devuelve al cerrar, y no atrapa el Tab dentro del modal.
**Solución:** añadir `role="dialog"`/`aria-modal`/`aria-labelledby` + un hook de trampa de foco centralizado en `Modal`. **Riesgo:** medio, alto impacto por ser un componente muy reutilizado — probar bien tras el cambio.

### 🟠 Áreas táctiles por debajo de 44×44px en varios controles
Botón de icono circular (28px), cierres de modal/wizard (36px), botones de header (36px), selector de rol (34px de alto) — pese a que el propio token `--btn-height:44px` reconoce el estándar correcto.
**Solución:** ampliar el hit-area invisible manteniendo el icono visual pequeño donde aplique; subir cierres/header a 40-44px. **Riesgo:** bajo-medio.

### 🟢 Puntos positivos
`prefers-reduced-motion` respetado de forma consistente en 3 bloques distintos del sistema; cobertura razonable de `aria-label` en la mayoría de botones de icono (`FavoriteStar` es un ejemplo bien resuelto, con `aria-pressed` + `title`); ningún uso de `alert()`/`confirm()`/`prompt()` nativos.

---

## FASE 13 — Google Play / App Store

### 🔴 No existe ningún `ErrorBoundary` en toda la aplicación
0 coincidencias de `ErrorBoundary`/`componentDidCatch` en `src/`. Cualquier excepción no controlada durante el render (dato inesperado de Supabase, `undefined.map()`, etc.) deja al usuario con una **pantalla en blanco total**, sin mensaje ni recuperación. Sin ESLint ni TypeScript en el proyecto, el riesgo de que un error así llegue a producción es mayor de lo habitual.
**Solución:** envolver `&lt;App /&gt;` en un `ErrorBoundary` de clase con pantalla de "algo salió mal" + recarga. **Riesgo:** bajo. **Prioridad más alta de todo el informe junto con el botón atrás de Android.**

### 🔴 Versión de iOS desincronizada (1.0/build 1) frente a Android/`package.json` (1.1.0)
`ios/App/App.xcodeproj/project.pbxproj` nunca se actualizó al bump que sí se hizo en Android y en la propia UI de la app ("Acerca de" muestra 1.1.0). Subir así generaría confusión o conflicto con el histórico de versiones en App Store Connect.
**Solución:** actualizar `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` en Xcode antes de subir. **Riesgo:** bajo, solo metadata.

### 🟠 Permiso `CAMERA` de Android declarado sin uso real de la Camera API nativa
La captura de fotos se hace con `&lt;input type="file" capture="environment"&gt;` (delega en la app de cámara del sistema), que no requiere el permiso runtime `CAMERA`; no hay ningún plugin `@capacitor/camera` en `package.json`. Es un permiso "huérfano" de cara a la revisión de Play Console.
**Solución:** eliminar el permiso y el `FileProvider` asociado si de verdad no hay código nativo de cámara (confirmar antes en un build real). **Riesgo:** medio, probar el flujo de "tomar foto" tras quitarlo.

### 🟠 Service Worker cache-first agresivo, con `CACHE_NAME` fijo editado a mano
Si se olvida incrementar el nombre de caché en un release, usuarios que ya tenían la app instalada seguirán viendo assets de la versión anterior **incluso tras actualizar desde la tienda** — riesgo real de "la actualización no se aplicó", agravado por el propio hallazgo de versionado de iOS de arriba.
**Solución:** network-first o stale-while-revalidate para el shell; generar `CACHE_NAME` a partir del build hash; evaluar si el SW debe registrarse dentro del WebView nativo empaquetado. **Riesgo:** medio, probar bien el flujo de actualización.

### 🟡 Otros
- Enlaces a política de privacidad/términos con `target="_blank"` dentro del WebView de Capacitor — comportamiento no garantizado sin el plugin `@capacitor/browser`; verificar en dispositivo real.
- 🟢 Verificado correcto: `Info.plist` con descripciones de uso de cámara/fotos coherentes con el uso real; páginas legales con contenido real (no placeholders); sin `console.log`/`debugger` en producción; `network_security_config.xml` correcto (sin cleartext); splash screen puramente nativo sin dependencia de lógica JS que pueda colgarse.

---

## Verificación visual en vivo (con datos reales)

Tras el análisis estático, se navegó la app en el navegador con una sesión real (credenciales introducidas por el propio usuario, no por el asistente) en Inicio, Hogar, Economía y Organización. Esto confirma visualmente varios hallazgos ya documentados y añade tres defectos nuevos, solo detectables con datos reales:

### 🟠 Punto suelto sin conectar en la leyenda del gráfico de Economía (Resumen)
Con ingresos/gastos en 0,00 € (caso real de una casa recién creada), aparece un punto de color suelto y desalineado justo encima de la leyenda "Ingresos / Gastos" del gráfico circular de la pantalla Economía → Resumen, sin ningún texto asociado — un artefacto de renderizado del componente de gráfico en el caso límite de datos vacíos (probablemente un segmento SVG con `stroke-dasharray`/`circle` calculado para 0% que no se oculta correctamente).
**Cómo solucionarlo:** en el componente de gráfico circular de `EconomyOverview.jsx`, ocultar los marcadores/segmentos individuales cuando el valor correspondiente es 0, en vez de solo ocultar el arco. **Riesgo:** bajo, cambio acotado a la condición de renderizado. **Impacto:** visible para cualquier casa nueva sin movimientos — que es exactamente el estado en el que un usuario recién registrado ve esta pantalla por primera vez.

### 🟡 Confirmado visualmente: texto sin truncar en "Actividad reciente" del Dashboard
Con datos reales, los títulos largos ("Lucas añadió la factura Factura verificación refres...") se cortan exactamente en el borde de la tarjeta sin puntos suspensivos ni `overflow` controlado — confirma en vivo el hallazgo ya documentado en Fase 7/11 (ausencia de `text-overflow: ellipsis` en listas). Mismo defecto visible en los sufijos de tiempo ("hac...", por "hace X").

### 🟡 Textos sin pluralización correcta en español
`src/i18n.js:62` (`objects: "{{count}} objetos"`) y `src/i18n.js:1034` (`shoppingTitle: "{{count}} productos por comprar"`) están hardcodeados en plural sin lógica de singular/plural — confirmado en vivo: con 1 objeto en una habitación se lee "1 objetos", y con 1 producto pendiente, "1 productos por comprar". **Solución:** usar las claves de pluralización de i18next (`_one`/`_other`) que ya soporta la librería subyacente, o una condición simple `count === 1 ? "objeto" : "objetos"`. **Riesgo:** muy bajo. **Impacto:** cosmético pero muy visible (aparece en el Dashboard, la primera pantalla, con cualquier casa que tenga solo 1 elemento — caso común en cuentas nuevas).

### 🟢 Confirmado como correcto
Tema oscuro coherente en Inicio/Hogar/Economía/Organización (fuera de `WelcomeGate`, ya reportado); iconografía de navegación inferior consistente entre pestañas; botones primario/secundario con contraste de forma coherente entre pantallas; tarjetas de "Objetivos" y resumen económico con jerarquía visual clara.

---

## Valoración final

| Dimensión | Puntuación (0-10) | Motivo principal |
|---|---|---|
| Arquitectura | 6.0 | Modularización real en `src/modules` conviviendo con un god-file (`App.jsx`) que concentra la mayoría de la deuda |
| Código | 5.5 | Sin ESLint/tests; manejo de errores inconsistente entre servicios; patrones repetidos sin abstraer |
| Rendimiento | 6.0 | Buena disciplina de cleanup y code-splitting parcial ya validado, lastrado por fetches secuenciales y un motor de notificaciones caro |
| Seguridad | 6.5 | Sin vulnerabilidades de código (XSS/inyección/secretos) — los riesgos reales están en la capa de datos, no en el cliente |
| Base de datos | 4.0 | RLS sólida en el 90% del esquema, pero con una vía de entrada crítica (invite code) y una fuga de PII (`profiles`) |
| UX | 5.0 | Flujos correctos en el "camino feliz", pero con bugs de continuidad reales y confirmaciones inconsistentes en acciones destructivas |
| UI | 5.5 | Design system bien pensado pero con adopción muy desigual; onboarding fuera del sistema |
| Estética | 6.0 | Consistente dentro de cada módulo por separado, con derivas notables al comparar módulos entre sí (sobre todo Economía) |
| Consistencia | 5.0 | `WelcomeGate` como sistema paralelo es el hallazgo más grave de esta categoría |
| Escalabilidad | 5.5 | `house_id` como aislamiento funciona, pero patrones de "traer todo y filtrar en cliente" y fotos legacy sin comprimir no escalan bien más allá de cientos de objetos por casa |
| Preparación Google Play | 4.5 | Manifest/iconos/firma correctos, pero sin ErrorBoundary y sin manejo del botón atrás — ambos de alto impacto en la experiencia real en Android |
| Preparación App Store | 5.5 | Info.plist e iconos correctos; versión desincronizada y ausencia de safe-area son defectos visibles en la revisión manual de Apple |

---

## Veredicto

### ¿Publicarías Haven en su estado actual?

**Sí, pero corrigiendo primero los puntos críticos.**

**Justificación:** la base del producto es sólida — el aislamiento de datos por `house_id` funciona en la inmensa mayoría del esquema, las funciones de gestión de casa/roles están correctamente protegidas contra escalada de privilegios, no hay vulnerabilidades de código explotables (XSS, inyección, secretos filtrados), la disciplina de limpieza de efectos es ejemplar, y ya existe un design system y un patrón de code-splitting reales y bien ejecutados donde se aplican. Esto no es una app improvisada.

Pero hay un conjunto acotado de hallazgos 🔴 que, de publicarse tal cual, tendrían impacto directo y verificable en el primer contacto de cualquier usuario real:

1. **El botón atrás de Android no funciona** — en la plataforma con más usuarios potenciales, el gesto de navegación más usado cierra la app en vez de retroceder, en cualquier pantalla.
2. **Un código de invitación de 4 caracteres sin límite de intentos** convierte "adivinar un texto corto" en acceso de lectura/escritura a los datos económicos de una casa ajena — es el tipo de hallazgo que un usuario molesto o un investigador de seguridad encontraría en poco tiempo.
3. **No hay red de seguridad ante errores** (sin `ErrorBoundary`, sin ESLint, sin tests) en una app de 4000+ líneas en un único componente — el primer error no controlado en producción se traduce en pantalla en blanco sin recuperación.
4. **El buscador global tiene una función rota** (seleccionar un miembro) y **el onboarding no respeta ni el design system ni el modo oscuro de la propia app** — defectos visibles desde el primer minuto de uso.
5. La versión de iOS quedó desincronizada del resto del proyecto, un descuido de checklist que hay que corregir antes de subir a App Store Connect.

Ninguno de estos puntos requiere rediseñar la app ni añadir funcionalidad — son correcciones acotadas, la mayoría de riesgo bajo o medio, sobre código ya existente. El propio informe indica en cada caso una solución concreta y de alcance limitado. Con la lista de 🔴 críticos resuelta (y, si el calendario lo permite, los 🟠 de mayor impacto en Economía y en la RLS de actividad/notificaciones), Haven está en condiciones reales de publicarse como una v1.0 estable.
