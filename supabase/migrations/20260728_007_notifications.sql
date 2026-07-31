-- Migration: centro de actividad / notificaciones inteligentes
-- Date: 2026-07-28
--
-- Cola de notificaciones derivadas (no mensajes sueltos): cada fila es el
-- resultado de una regla del motor en src/notifications/rules/ que detectó
-- que una condición real se cumple (tarea vencida, lista casi completa,
-- semana sin gastos, evento próximo...). dedupe_key evita que la misma
-- condición cree filas duplicadas en cada reevaluación; el motor resuelve
-- (archiva) automáticamente una notificación cuando la condición deja de
-- cumplirse. user_id null = visible para todos los miembros de la casa
-- (p.ej. una factura por vencer); user_id concreto = solo para ese miembro.
-- Reusa public.is_house_member(uuid) como el resto de tablas por-casa.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  category text not null check (category in ('organizacion', 'compras', 'finanzas', 'calendario', 'hogar')),
  type text not null,
  priority text not null default 'info' check (priority in ('critical', 'important', 'info')),
  dedupe_key text not null,
  title text not null,
  body text,
  action jsonb,
  entity_ref jsonb,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'dismissed')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  unique (house_id, dedupe_key)
);

create index if not exists notifications_house_id_idx on public.notifications(house_id);
create index if not exists notifications_status_idx on public.notifications(house_id, status);

alter table public.notifications enable row level security;

create policy "notifications_rw_members" on public.notifications
  for all to authenticated
  using (public.is_house_member(house_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_house_member(house_id) and (user_id is null or user_id = auth.uid()));

grant select, insert, update, delete on public.notifications to authenticated;

-- EOF
