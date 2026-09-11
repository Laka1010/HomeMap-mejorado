-- Migration: categoría de gasto por lista de la compra
-- Date: 2026-09-11
--
-- Al finalizar una compra (Modo compra) se crea automáticamente un gasto en
-- Movimientos (ver registerPurchaseExpense en App.jsx), pero siempre con
-- category = DEFAULT_CATEGORY ("Otros gastos") porque no había forma de
-- decirle a una lista de la compra a qué categoría de gasto pertenece
-- (p.ej. "Supermercado" -> Comida, "Farmacia" -> Salud). Esta columna guarda
-- esa categoría por lista, tomada del mismo catálogo que economy_categories
-- (kind='expense'); es texto libre, sin FK, igual que economy_expenses.category,
-- porque el catálogo de categorías es editable por hogar y no una tabla fija.

alter table public.shopping_lists
  add column if not exists category text;

-- EOF
