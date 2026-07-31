-- Migration: category on house_activity
-- Date: 2026-07-30
--
-- Los miembros con rol 'child' no ven el módulo de economía, así que tampoco
-- deben ver entradas de actividad reciente sobre facturas/gastos/ingresos.
-- category es nullable y solo se rellena para eventos de economía (p.ej.
-- 'finanzas'); el resto de eventos (tareas, compras, notas...) se quedan sin
-- categoría y siempre son visibles.

alter table public.house_activity add column if not exists category text;

-- EOF
