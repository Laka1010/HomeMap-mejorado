-- Migration: cerrar M-1 del análisis de la Fase 7 (Opción A, confirmada con
-- el usuario) — actividad no financiera (tareas, notas, listas y artículos
-- de compra, categorías, habitaciones/zonas/cajas/objetos, fotos de
-- entidad, notificaciones) seguía disponible para cuentas suspended/banned.
-- Date: 2026-08-08
--
-- Decisión de producto confirmada: Opción A ("bloquear todo"), no Opción B
-- ("solo bloquear escritura"). Motivo ya expuesto en la Fase 7: Opción B
-- exige partir las 12 políticas `FOR ALL` afectadas en 4 políticas
-- separadas por tabla (SELECT/INSERT/UPDATE/DELETE) -- la superficie de
-- cambio más grande de los cinco hallazgos, con su propio riesgo de dejar
-- un USING/WITH CHECK mal replicado. Opción A es, aquí, la más barata y de
-- menor riesgo técnico pese a ser la más restrictiva.
--
-- is_house_member(p_house_id) es el único punto que TODAS estas políticas
-- consultan (confirmado en pg_policies antes de tocar nada): las 12 tablas
-- con política FOR ALL combinada (categories, containers, entity_photos,
-- notes, notifications, objects, rooms, shopping_items, shopping_lists,
-- shopping_purchases, tasks, zones), más las políticas de solo lectura de
-- houses, home_members y house_activity, más house_activity_insert_own.
-- También es el único chequeo de create_shared_financial_space (confirmado
-- por grep sobre el historial de migraciones) -- crear un Workspace
-- compartido nuevo pasa a bloquearse también, coherente con "suspendido =
-- fuera de Haven".
--
-- Efecto colateral esperado, no un bug: al usar is_house_member también en
-- SELECT, una cuenta suspendida/baneada deja de poder leer sus propias
-- casas/miembros/actividad reciente, no solo escribir. Es exactamente lo
-- que pide la Opción A.
--
-- Sin problema de NULL/three-valued logic: mismo argumento que H-1/H-2/H-3.
--
-- Alcance: exactamente esta función. Ninguna RLS, tabla, trigger, RPC ni el
-- comportamiento de 'restricted' se modifican -- 'restricted' no se toca en
-- ningún punto de esta migración.

create or replace function public.is_house_member(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid()
  ) and not public._is_account_blocked();
$$;

-- EOF
