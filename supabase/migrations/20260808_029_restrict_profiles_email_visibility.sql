-- Migration: restrict profiles visibility to housemates (was: any authenticated user)
-- Date: 2026-08-08
--
-- Security audit finding: profiles_select_authenticated used `using (true)`,
-- so any signed-up user -- even one belonging to zero houses -- could read
-- every user's email + display_name in the whole platform via
-- `select * from profiles`. The only real usages of this table
-- (houseService.getHouseMembers, financialSpacesService's member lookup)
-- only ever fetch profiles for user_ids drawn from home_members of houses
-- the caller already belongs to (shared financial spaces always have a
-- house_id and their members are always house members too -- see
-- create_shared_financial_space / add_financial_space_member). So the real
-- access rule is "see your own profile, or a profile of someone who shares
-- at least one house with you", not "any authenticated user".

drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_self" on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_housemates" on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.home_members hm1
      join public.home_members hm2 on hm2.house_id = hm1.house_id
      where hm1.user_id = auth.uid() and hm2.user_id = profiles.id
    )
  );

-- EOF
