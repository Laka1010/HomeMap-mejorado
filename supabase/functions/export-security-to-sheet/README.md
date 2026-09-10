# export-security-to-sheet

Espejo **append-only, en un solo sentido**, de las cuatro tablas del Security
Center a una Google Sheet. Lotes cada 5 min vía `pg_cron`. **Sin direcciones IP.**

```
pg_cron (*/5)
  └─ public._run_security_sheet_export()        [lee export_sheet_trigger_secret de Vault]
       └─ net.http_post  ──x-export-trigger-secret──▶  Edge Function (esta)
            ├─ SELECT security_sheet_*_v  (service_role)      ── filas nuevas por marca de agua
            ├─ POST  ──secret en body──▶  Apps Script Web App  ── append a la pestaña
            └─ UPDATE security_sheet_export_state              ── avanza la marca SOLO si 2xx
```

Migración que lo cablea: `supabase/migrations/20260910_093_export_security_to_sheet.sql`.

## Qué llega a cada pestaña

| Pestaña | Vista de origen | Marca de agua | Notas |
|---|---|---|---|
| `security_events` | `security_sheet_events_v` | `created_at` | sin `ip_address` |
| `security_admin_audit_log` | `security_sheet_audit_v` | `created_at` | sin `target_ip` |
| `security_ip_blocks` | `security_sheet_ip_blocks_v` | `created_at` | sin `ip` |
| `account_security_state` | `security_sheet_account_state_v` | `updated_at` | una fila nueva por cada cambio de estado (historial de transiciones) |

`metadata` viaja como texto JSON en una sola celda. `user_id`/`admin_id` van
como uuid **y** como email resuelto (vía `profiles`).

## Puesta en marcha

### 1. Google Sheet + Apps Script

1. Crea una Google Sheet nueva (una pestaña vacía cualquiera; el script crea
   las demás).
2. **Extensiones → Apps Script**. Borra el contenido y pega
   [`apps-script.gs`](./apps-script.gs).
3. Cambia `SECRET` por un valor aleatorio largo (guárdalo: es
   `SHEET_WEBAPP_SECRET`).
4. **Implementar → Nueva implementación → Aplicación web**
   - *Ejecutar como*: Yo
   - *Quién tiene acceso*: Cualquier usuario
5. Copia la URL que termina en `/exec` → es `SHEET_WEBAPP_URL`.

### 2. Secretos

Genera dos valores aleatorios distintos (p. ej. `openssl rand -hex 32`):

- `export_sheet_trigger_secret` — Postgres/cron ↔ Edge Function
- `sheet_webapp_secret` — Edge Function ↔ Apps Script (el `SECRET` del paso 1.3)

**Vault** (SQL editor del dashboard):

```sql
select vault.create_secret('<export_sheet_trigger_secret>', 'export_sheet_trigger_secret');
```

**Secrets de la Edge Function:**

```bash
supabase secrets set \
  EXPORT_TRIGGER_SECRET='<export_sheet_trigger_secret>' \
  SHEET_WEBAPP_URL='https://script.google.com/macros/s/AKfy.../exec' \
  SHEET_WEBAPP_SECRET='<sheet_webapp_secret>'
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase
automáticamente; no hay que ponerlos.

### 3. Desplegar

```bash
supabase functions deploy export-security-to-sheet
```

`config.toml` ya fija `verify_jwt = false` para esta función.

### 4. Aplicar la migración

```bash
supabase db push
```

A partir del siguiente minuto múltiplo de 5, el cron empieza a exportar lo
que llegue **desde ese momento**.

## Operación

**Comprobar a mano (sin esperar al cron):**

```sql
select public._run_security_sheet_export();
```

**Ver el resultado de las últimas llamadas:**

```sql
select id, status_code, content
from net._http_response
order by id desc
limit 5;
```

**Estado de las marcas de agua:**

```sql
select * from public.security_sheet_export_state;
```

**Backfill del histórico** (por defecto NO se exporta lo anterior al
despliegue): retrasa la marca de la tabla que quieras y el cron lo drena de
500 en 500.

```sql
update public.security_sheet_export_state
set last_exported_at = '2026-01-01'
where source_table = 'security_events';
```

**Pausar el espejo:** `select cron.unschedule('security_sheet_export_5min');`
o borra el secreto de Vault (`_run_security_sheet_export` se vuelve un no-op).

**Reanudar:** vuelve a programar el job (ver la migración) o recrea el secreto.

## Por qué está así

- **Lotes, no trigger por fila:** un `AFTER INSERT` "dispara y olvida" pierde
  filas si la hoja está caída en ese instante. Con marca de agua, un lote
  fallido se reintenta y el log no tiene huecos.
- **Sin IP:** la IP es dato personal con anonimización a 90 días y
  visibilidad por-admin (`security_admins.can_view_ip`) en Postgres; una
  Google Sheet compartida por enlace no tiene ninguna de las dos. Para
  investigar una IP se usa el Security Center. Para añadirla al espejo:
  columna en la vista correspondiente + entrada en `headers` de `index.ts`.
- **No invasivo:** ni triggers en las tablas de origen, ni cambios de RLS,
  ni funciones existentes modificadas. Revertir no toca ningún dato.
- **Segundo almacén con PII (email):** recuerda que esta hoja pasa a ser un
  sistema de datos más a efectos de RGPD (retención, borrado a petición).
