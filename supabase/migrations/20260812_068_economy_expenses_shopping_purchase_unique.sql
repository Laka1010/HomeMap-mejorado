-- Migration: Unicidad de economy_expenses.shopping_purchase_id
-- Date: 2026-08-12
--
-- ============================================================================
-- CONTEXTO
-- ============================================================================
--
-- Compras -> Finanzas: al completar una compra con importe > 0, el cliente
-- (completeShoppingPurchase / saveScannedPurchase en src/App.jsx) crea ahora
-- automáticamente un economy_expenses con shopping_purchase_id apuntando a
-- esa compra. La aplicación ya garantiza que esto ocurre una única vez (un
-- solo punto de disparo, sin reintentos manuales del usuario), pero hasta
-- ahora nada lo impedía a nivel de base de datos: dos filas de
-- economy_expenses podían apuntar a la misma shopping_purchases sin que
-- Postgres se quejara.
--
-- Este índice único parcial es la última línea de defensa (doble clic,
-- reintento de red, o un futuro cambio de código que no respete la
-- invariante). Es parcial (where shopping_purchase_id is not null) porque
-- NULL es el valor normal y esperado para:
--   - cualquier gasto manual creado desde Movimientos (AddMovementModal),
--     que nunca rellena este campo;
--   - un gasto que quedó "huérfano" tras borrar su compra manteniendo el
--     gasto (la FK ya existente hace ON DELETE SET NULL).
-- Postgres nunca trata dos NULL como duplicados en un índice único, pero el
-- WHERE explícito documenta la intención igualmente.
-- ============================================================================

create unique index if not exists economy_expenses_shopping_purchase_id_uniq
  on public.economy_expenses(shopping_purchase_id)
  where shopping_purchase_id is not null;
