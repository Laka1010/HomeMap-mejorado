-- Migration: i18n key + params on house_activity
-- Date: 2026-08-30
--
-- house_activity.title guardaba la frase ya renderizada en el idioma del
-- autor ("Lucas creó la habitación Cocina."). Un miembro con la app en
-- inglés veía esas entradas en español porque el texto es un dato fijo de
-- la fila. Ahora guardamos ADEMÁS la clave i18n y sus parámetros para poder
-- renderizar el feed en el idioma de quien lo lee. `title` se mantiene como
-- copia de respaldo para filas antiguas y para clientes que aún no leen las
-- columnas nuevas.

alter table public.house_activity add column if not exists title_key text;
alter table public.house_activity add column if not exists title_params jsonb;

-- EOF
