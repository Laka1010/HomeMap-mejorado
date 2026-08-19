-- Migration: textos de notificaciones traducibles
-- Date: 2026-08-19
--
-- Las reglas de src/notifications/rules/*.js montaban el título, el cuerpo y
-- la etiqueta del botón en español y guardaban ya ese texto en la fila. Como
-- la app se sirve en es/en, un usuario en inglés veía el centro de actividad
-- entero en español, y cambiar de idioma no reescribía lo ya generado.
--
-- Ahora la regla guarda ADEMÁS la clave i18n y sus variables, y la interfaz
-- monta el texto en el idioma activo en cada render. Las columnas title/body
-- se mantienen (y title sigue siendo NOT NULL) con el texto en español:
--   - las filas ya existentes no tienen claves y se siguen pintando con ellas,
--     así que no hace falta backfill ni se pierde nada;
--   - cualquier lector que no sea la interfaz (consultas de soporte, un
--     futuro envío por push/correo) sigue teniendo un texto legible.
-- Es decir: title/body pasan de ser la fuente de verdad a ser el respaldo.

alter table public.notifications
  add column if not exists title_key text,
  add column if not exists title_vars jsonb,
  add column if not exists body_key text,
  add column if not exists body_vars jsonb,
  add column if not exists action_label_key text;

comment on column public.notifications.title_key is
  'Clave i18n del título (src/i18n.js, grupo notifications.*). Null en filas anteriores a esta migración: en ese caso la interfaz usa la columna title.';
comment on column public.notifications.title_vars is
  'Variables {{...}} del título, p.ej. {"days": 3}.';
comment on column public.notifications.body_key is
  'Clave i18n del cuerpo. Null => usar la columna body.';
comment on column public.notifications.body_vars is
  'Variables {{...}} del cuerpo.';
comment on column public.notifications.action_label_key is
  'Clave i18n de la etiqueta del botón de acción. Null => usar action->>''label''.';

-- EOF
