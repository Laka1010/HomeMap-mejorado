-- Migration: Create roles, permissions, mappings and helpers for RBAC
-- Date: 2026-07-25

-- NOTES:
-- 1) This migration creates a roles/permissions model and a user_profiles table
--    that references auth.users(id). It does NOT modify auth.users (managed by Supabase).
-- 2) It seeds three roles (admin, adult, child) and a set of initial permissions.
-- 3) It provides helper functions app_has_permission(uid, perm_key) and
--    app_get_permissions(uid) to be used from SQL/RLS policies.
-- 4) It replaces existing economy RLS policies to require both house membership
--    and the appropriate permission (so children that are house members but
--    lack economy permission will be denied).
-- 5) Review seeds and adjust defaults (fallback role) to suit your business rules.

-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid() if needed

-- ============================================================================
-- ROLES / PERMISSIONS STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id serial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id serial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id int NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id int NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- USER PROFILES (role per user)
-- ============================================================================
-- Supabase manages auth.users; avoid altering it. Store role on a profile table
-- that references auth.users(id).

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.user_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_updated_at();

-- ============================================================================
-- SEED: Roles
-- ============================================================================
INSERT INTO public.roles (key, display_name)
  VALUES
    ('admin', 'Administrador'),
    ('adult', 'Adulto'),
    ('child', 'Niño')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: Permissions (initial set)
-- Add or remove keys here as needed for future roles
-- ============================================================================
INSERT INTO public.permissions (key, description)
VALUES
  ('canManageHouse', 'Manage houses (create, update metadata, link members)'),
  ('canInviteUsers', 'Invite users to houses'),
  ('canChangeRoles', 'Change roles for other users'),
  ('canManageEconomy', 'Access and manage economic module, overview'),
  ('canViewStatistics', 'View statistics across modules'),
  ('canRegisterExpenses', 'Create expense entries'),
  ('canRegisterIncome', 'Create income entries'),
  ('canPayBills', 'Mark/pay bills'),
  ('canManageObjects', 'Create/edit/move objects'),
  ('canManageTasks', 'Create/edit/assign tasks'),
  ('canManagePurchases', 'Create/edit purchases and shopping lists'),
  ('canFullConfig', 'Full application configuration access'),
  ('canDeleteData', 'Delete critical data / houses'),
  ('canManagePermissions', 'Manage roles and permissions mapping'),
  ('canConvertPurchaseToExpense', 'Convert a purchase into an expense'),
  ('canCreateInvoice', 'Create invoices'),
  ('canSearchObjects','Search objects'),
  ('canAddObject','Add objects'),
  ('canMoveObject','Move objects'),
  ('canCreateTask','Create tasks'),
  ('canCompleteTask','Complete tasks'),
  ('canAddToShoppingList','Add items to shopping list')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: Role -> Permission mappings
-- ============================================================================
-- Helper queries to map role keys to ids
WITH r AS (
  SELECT id, key FROM public.roles WHERE key IN ('admin','adult','child')
), p AS (
  SELECT id, key FROM public.permissions
)
-- Admin: give all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM r JOIN p ON 1=1 WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- Adult: subset (economy allowed but no permission management or destructive actions)
-- Map adult to a chosen set
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'canManageHouse', 'canInviteUsers', 'canManageEconomy', 'canViewStatistics',
  'canRegisterExpenses','canRegisterIncome','canPayBills',
  'canManageObjects','canManageTasks','canManagePurchases','canCreateInvoice'
)
WHERE r.key = 'adult'
ON CONFLICT DO NOTHING;

-- Child: limited non-economic permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'canManageObjects','canSearchObjects','canAddObject','canMoveObject',
  'canCreateTask','canCompleteTask','canAddToShoppingList','canManagePurchases'
)
WHERE r.key = 'child'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPERS: permission check functions
-- ============================================================================
-- Returns true if the user has that permission via their role. Admins (role_key = 'admin')
-- are treated as having all permissions by construction (they have role_permissions mapping),
-- but the function also falls back to treating an explicit 'admin' role_key as full-privilege.

CREATE OR REPLACE FUNCTION public.app_has_permission(p_user uuid, p_perm_key text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON r.key = up.role_key
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE up.user_id = p_user AND p.key = p_perm_key
    )
    OR (
      -- fallback: if user's profile role_key is 'admin'
      SELECT (up2.role_key = 'admin') FROM public.user_profiles up2 WHERE up2.user_id = p_user
    )
  );
$$;

-- Return a JSONB object with all permission keys and boolean values for the user
CREATE OR REPLACE FUNCTION public.app_get_permissions(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_object_agg(p.key, (app_has_permission(p_user, p.key))::text::boolean)
  FROM public.permissions p;
$$;

-- ============================================================================
-- UTILS: upsert helper to set a role for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_set_user_role(p_user uuid, p_role_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate role exists
  IF NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.key = p_role_key) THEN
    RAISE EXCEPTION 'role % does not exist', p_role_key;
  END IF;

  INSERT INTO public.user_profiles (user_id, role_key)
  VALUES (p_user, p_role_key)
  ON CONFLICT (user_id) DO UPDATE SET role_key = EXCLUDED.role_key, updated_at = now();
END;
$$;

-- ============================================================================
-- RLS POLICY ADJUSTMENTS FOR ECONOMY (example)
-- Replace the existing economy policies so they require both membership and permission
-- Note: this migration will drop and recreate the affected policies.
-- Review and adapt if you have different policy names.
-- ============================================================================

-- Drop known existing policies (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view bills from their houses' AND polrelid = 'public.economy_bills'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can view bills from their houses" ON public.economy_bills';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert bills in their houses' AND polrelid = 'public.economy_bills'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can insert bills in their houses" ON public.economy_bills';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view expenses from their houses' AND polrelid = 'public.economy_expenses'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can view expenses from their houses" ON public.economy_expenses';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert expenses in their houses' AND polrelid = 'public.economy_expenses'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can insert expenses in their houses" ON public.economy_expenses';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view income from their houses' AND polrelid = 'public.economy_income'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can view income from their houses" ON public.economy_income';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert income in their houses' AND polrelid = 'public.economy_income'::regclass) THEN
    EXECUTE 'DROP POLICY "Users can insert income in their houses" ON public.economy_income';
  END IF;
END$$;

-- Recreate policies that require both house membership and permission
-- Bills: SELECT
CREATE POLICY "economy_bills_select_only_members_with_permission" ON public.economy_bills
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.home_members hm WHERE hm.home_id = public.economy_bills.house_id AND hm.user_id = auth.uid()::uuid
      )
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- Bills: INSERT (create) allowed for house members that also have permission
CREATE POLICY "economy_bills_insert_members_with_permission" ON public.economy_bills
  FOR INSERT
  WITH CHECK (
    (
      NEW.house_id IN (SELECT home_id FROM public.home_members WHERE user_id = auth.uid()::uuid)
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- Expenses: SELECT
CREATE POLICY "economy_expenses_select_only_members_with_permission" ON public.economy_expenses
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.home_members hm WHERE hm.home_id = public.economy_expenses.house_id AND hm.user_id = auth.uid()::uuid
      )
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- Expenses: INSERT
CREATE POLICY "economy_expenses_insert_members_with_permission" ON public.economy_expenses
  FOR INSERT
  WITH CHECK (
    (
      NEW.house_id IN (SELECT home_id FROM public.home_members WHERE user_id = auth.uid()::uuid)
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- Income: SELECT
CREATE POLICY "economy_income_select_only_members_with_permission" ON public.economy_income
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.home_members hm WHERE hm.home_id = public.economy_income.house_id AND hm.user_id = auth.uid()::uuid
      )
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- Income: INSERT
CREATE POLICY "economy_income_insert_members_with_permission" ON public.economy_income
  FOR INSERT
  WITH CHECK (
    (
      NEW.house_id IN (SELECT home_id FROM public.home_members WHERE user_id = auth.uid()::uuid)
      AND public.app_has_permission(auth.uid()::uuid, 'canManageEconomy')
    )
  );

-- ============================================================================
-- UTILITY: view to simplify querying users with their role
-- ============================================================================
CREATE OR REPLACE VIEW public.users_with_role AS
SELECT u.id as user_id, u.email, up.role_key
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id;

-- ============================================================================
-- NOTES FOR OPERATORS
-- ============================================================================
-- 1) After running this migration, use public.app_set_user_role(<user_uuid>, 'admin'|'adult'|'child')
--    to assign roles to existing users.
-- 2) The front-end should request permissions via a server endpoint that calls
--    SELECT public.app_get_permissions(current_user_id) and return the map to the client.
-- 3) If you prefer storing a role directly on a different table, adapt the migrations.
-- 4) Test thoroughly on staging before applying to production.

-- EOF
