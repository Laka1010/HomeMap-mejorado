# Migraciones archivadas (nunca aplicadas)

Estos tres archivos quedaron aquí el 2026-07-26 porque una consulta de introspección directa contra el proyecto Supabase real confirmó que **ninguna** de estas tablas/funciones existe todavía en la base de datos — nunca se aplicaron. No se borran por si sirven de referencia histórica, pero no deben ejecutarse:

- `001_create_economy_tables.sql` y `20240725_001_create_economy_tables.sql` son dos versiones conflictivas del mismo esquema de economía (columnas distintas entre sí). Fueron reemplazadas por `../20260726_002_economy_tables.sql`, que consolida el diseño y referencia la nueva tabla `houses`.
- `20260725_001_create_roles_permissions.sql` guardaba el rol de forma global por usuario (`user_profiles.role_key`), lo cual rompe si una persona pertenece a varias casas con roles distintos, y sus políticas RLS de `INSERT` usaban `NEW.house_id`, sintaxis inválida fuera de triggers (no habrían funcionado). Fue reemplazado por `../20260726_001_houses_members_roles.sql`, que guarda el rol por membresía (`home_members.role`).
