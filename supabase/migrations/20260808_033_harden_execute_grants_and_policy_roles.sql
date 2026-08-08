-- Migration: defense-in-depth hardening flagged by Supabase's security advisor
-- Date: 2026-08-08
--
-- 1) Every SECURITY DEFINER function except delete_shared_financial_space
--    still had the default `GRANT EXECUTE ... TO PUBLIC` Postgres applies on
--    creation, meaning the `anon` role could call them via
--    /rest/v1/rpc/<name> without signing in. None of this was found to be
--    exploitable -- every function's logic keys off auth.uid(), which is
--    NULL for anon and fails every check closed -- but it's inconsistent
--    hardening flagged explicitly by the linter (anon_security_definer_
--    function_executable / authenticated_security_definer_function_
--    executable). Revoking from public/anon does not affect the explicit
--    `grant ... to authenticated` already in place from earlier migrations,
--    and does not affect trigger functions firing (trigger invocation is
--    not gated by the invoking session's EXECUTE privilege).
--
-- 2) Six RLS policies (on categories/notes/shopping_items/shopping_lists/
--    notifications/house_activity) were created without an explicit
--    `to authenticated`, so they apply to Postgres role `public` (anon +
--    authenticated). Safe today only because they all gate on
--    is_house_member(house_id), which resolves to false for anon's null
--    auth.uid() -- restricting the role list explicitly removes the
--    reliance on that null-handling behavior, matching every other policy
--    in the schema.

revoke execute on function public._execute_financial_transfer(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.add_financial_space_member(uuid, uuid, text) from public, anon;
revoke execute on function public.archive_financial_space(uuid) from public, anon;
revoke execute on function public.can_access_financial_space(uuid) from public, anon;
revoke execute on function public.can_contribute_financial_space(uuid) from public, anon;
revoke execute on function public.can_manage_economy(uuid) from public, anon;
revoke execute on function public.can_manage_financial_space(uuid) from public, anon;
revoke execute on function public.cleanup_financial_space_membership_on_leave() from public, anon;
revoke execute on function public.contribute_to_financial_space(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.create_house(text) from public, anon;
revoke execute on function public.create_house(text, text) from public, anon;
revoke execute on function public.create_shared_financial_space(text, uuid, text) from public, anon;
revoke execute on function public.delete_house(uuid) from public, anon;
revoke execute on function public.delete_shared_financial_space(uuid) from public, anon;
revoke execute on function public.economy_adjust_account_balance() from public, anon;
revoke execute on function public.economy_bills_validate_paid_from_account() from public, anon;
revoke execute on function public.economy_default_account_id() from public, anon;
revoke execute on function public.economy_sync_house_id() from public, anon;
revoke execute on function public.economy_validate_account_space() from public, anon;
revoke execute on function public.get_workspace_role(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.is_house_admin(uuid) from public, anon;
revoke execute on function public.is_house_member(uuid) from public, anon;
revoke execute on function public.is_workspace_owner(uuid) from public, anon;
revoke execute on function public.join_house_by_code(text) from public, anon;
revoke execute on function public.leave_financial_space(uuid) from public, anon;
revoke execute on function public.pay_bill_from_account(uuid, uuid) from public, anon;
revoke execute on function public.pay_bill_via_contribution(uuid, uuid) from public, anon;
revoke execute on function public.remove_financial_space_member(uuid, uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.rename_financial_space(uuid, text) from public, anon;
revoke execute on function public.rename_house(uuid, text) from public, anon;
revoke execute on function public.set_house_currency(uuid, text) from public, anon;
revoke execute on function public.set_member_economy_access(uuid, uuid, text) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_between_accounts(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.transfer_house_ownership(uuid, uuid) from public, anon;
revoke execute on function public.user_can_manage_economy(uuid, uuid) from public, anon;

alter policy "categories_rw_members" on public.categories to authenticated;
alter policy "notes_rw_members" on public.notes to authenticated;
alter policy "shopping_items_rw_members" on public.shopping_items to authenticated;
alter policy "shopping_lists_rw_members" on public.shopping_lists to authenticated;
alter policy "notifications_rw_members" on public.notifications to authenticated;
alter policy "house_activity_insert_own" on public.house_activity to authenticated;

-- EOF
