-- Migration: entity_type / entity_id on house_activity
-- Date: 2026-07-30
--
-- Permite enlazar una notificación (que ya guarda entity_ref: {type, id} en
-- notifications.entity_ref) con la entrada de actividad que la originó
-- ("Lucas creó la tarea X" <-> notificación "tarea atrasada" de esa misma
-- tarea), sin fusionar ambos feeds: cada uno sigue siendo independiente,
-- esto solo añade el dato necesario para que uno pueda referenciar al otro.

alter table public.house_activity add column if not exists entity_type text;
alter table public.house_activity add column if not exists entity_id text;

create index if not exists house_activity_entity_idx
  on public.house_activity(house_id, entity_type, entity_id);

-- EOF
