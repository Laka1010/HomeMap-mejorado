-- Migration: fix am_i_security_admin() anon grant
-- Date: 2026-08-08
--
-- Advisor flagged am_i_security_admin() as executable by anon right after
-- 20260808_050_security_center.sql: se revocó de `public` pero no de `anon`
-- por separado. Este proyecto tiene privilegios por defecto que conceden
-- EXECUTE a anon/authenticated en cada función nueva (visto ya en
-- 20260808_033_harden_execute_grants_and_policy_roles.sql, que por eso
-- revoca de "public, anon" explícitamente en cada función) -- revocar solo
-- de `public` no basta. No era una fuga real (is_security_admin() con
-- auth.uid() nulo siempre da false), pero se corrige para quedar
-- consistente con el resto del esquema.

revoke all on function public.am_i_security_admin() from public, anon;
grant execute on function public.am_i_security_admin() to authenticated;

-- EOF
