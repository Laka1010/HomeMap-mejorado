-- Migration: sin categorías de Economía duplicadas por hogar
-- Date: 2026-09-11
--
-- 1) Limpia duplicados exactos ya existentes: la siembra por defecto de la
--    migración 095 podía ejecutarse dos veces (StrictMode en dev vuelve a
--    invocar el efecto de carga; el seed hacía delete+insert y dos ejecuciones
--    concurrentes veían la tabla vacía e insertaban ambas). Se conserva una
--    fila por (house_id, kind, name).
-- 2) Índice único que impide que vuelva a pasar. El editor
--    (CategoryListEditor) y economyCategoriesService ya evitan duplicados en
--    el cliente (además ignorando mayúsculas); esto lo garantiza en la BD.

delete from public.economy_categories a
using public.economy_categories b
where a.ctid > b.ctid
  and a.house_id = b.house_id
  and a.kind = b.kind
  and a.name = b.name;

create unique index if not exists economy_categories_house_kind_name_idx
  on public.economy_categories (house_id, kind, name);

-- EOF
