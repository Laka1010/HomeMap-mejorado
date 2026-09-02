-- Migration: calendar_events (manual calendar events)
-- Date: 2026-09-02
--
-- Hasta ahora el Calendario (CalendarModule.jsx / buildLocalEvents.js) era
-- solo lectura: mostraba eventos DERIVADOS del estado de la casa (tareas con
-- fecha, facturas, compras). Esta tabla guarda eventos MANUALES que el
-- usuario crea desde el formulario "nuevo evento" (estilo Apple Calendar).
--
-- Mismo modelo que public.tasks (20260726_004): sin restricción de rol —
-- cualquier miembro (admin/adult/child) lee y escribe — y fecha/hora como
-- `date` + `text`, no `timestamptz`, para encajar con toDateKey() sin los
-- desfases de huso horario que documenta calendarUtils.js. Reutiliza
-- public.is_house_member(uuid) y el trigger public.economy_set_updated_at().

create table if not exists public.calendar_events (
  id text primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  title text not null,
  location text,
  all_day boolean not null default false,
  start_date date not null,
  start_time text,
  end_date date,
  end_time text,
  repeat text,
  alert text,
  notes text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_house_id_idx on public.calendar_events(house_id);

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.economy_set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_rw_members" on public.calendar_events;
create policy "calendar_events_rw_members" on public.calendar_events
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

grant select, insert, update, delete on public.calendar_events to authenticated;

-- EOF
