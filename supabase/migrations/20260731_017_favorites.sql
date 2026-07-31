-- Migration: favorite flag on objects, tasks, shopping_items, economy_bills
-- Date: 2026-07-31
--
-- Puramente aditivo: una columna booleana con default false en cada tabla,
-- sin tocar ninguna policy ni función existente. Los cuatro servicios de
-- cliente (homeContentService, taskService, shoppingService, economyService)
-- ya pasan patches arbitrarios a sus updates, así que no requieren más
-- cambios de esquema que este.

alter table public.objects add column if not exists favorite boolean not null default false;
alter table public.tasks add column if not exists favorite boolean not null default false;
alter table public.shopping_items add column if not exists favorite boolean not null default false;
alter table public.economy_bills add column if not exists favorite boolean not null default false;

-- EOF
