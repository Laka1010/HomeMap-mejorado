-- Migration: cerrar H-3 del análisis de la Fase 7 — un Security Admin
-- suspended/banned conservaba acceso administrativo completo al propio
-- Security Center.
-- Date: 2026-08-08
--
-- Decisión de producto confirmada con el usuario (ver conversación, 3
-- opciones presentadas en la Fase 7): suspender a un Security Admin debe
-- actuar como una "pausa" inmediata de su poder administrativo, sin
-- necesidad de invocar security_admin_revoke_admin (que sigue existiendo
-- como la vía para quitarle el rol de forma permanente).
--
-- Mismo patrón que H-1/H-2 (20260808_054, 20260808_055): is_security_admin()
-- es el único punto que las 22 RPCs del Security Center consultan como
-- gate. Añadir la comprobación aquí las cubre a todas sin modificarlas, sin
-- tocar RLS y sin tocar triggers. am_i_security_admin() (usada por el
-- frontend para decidir si mostrar la entrada al Security Center) llama a
-- is_security_admin() internamente, así que también queda cubierta sin
-- tocarla -- un admin suspendido deja de ver la entrada, no solo de poder
-- usarla si la fuerza por RPC directa.
--
-- Sin problema de NULL/three-valued logic: mismo argumento que H-1/H-2 --
-- exists() y _is_account_blocked() nunca devuelven NULL.
--
-- Riesgo residual aceptado (documentado, no corregido aquí): si el ÚNICO
-- Security Admin existente quedara suspendido, nadie podría reactivarlo vía
-- RPC (is_security_admin() para él mismo también sería false) -- haría
-- falta acceso directo a la base de datos, igual que para el bootstrap
-- inicial del primer admin (20260808_050_security_center.sql). Mismo tipo
-- de "break glass" que cualquier sistema de roles con un único
-- administrador; no se diseña una vía alternativa para este caso límite en
-- esta fase.
--
-- Alcance: exactamente esta función. Ninguna RLS, tabla, trigger, RPC ni el
-- comportamiento de 'restricted' se modifican.

create or replace function public.is_security_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.security_admins where user_id = auth.uid())
    and not public._is_account_blocked();
$$;

-- EOF
