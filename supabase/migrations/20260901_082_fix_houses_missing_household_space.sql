-- Migration: crear el espacio financiero de hogar que le falta a alguna casa
-- Date: 2026-09-01
--
-- La revisión encontró 1 casa (con 2 miembros) sin espacio 'household'. Es una
-- anomalía anterior a 20260808_039, que fue la migración que hizo que
-- create_house creara siempre el espacio y su cuenta por defecto. Para esa
-- casa el módulo de Economía no funciona: can_manage_economy y
-- user_can_manage_economy resuelven sobre un espacio inexistente.
--
-- Se replica exactamente lo que hace create_house hoy: espacio 'household'
-- + cuenta por defecto "Cuenta Común" con la moneda de la casa. El propietario
-- es el admin de la casa.
--
-- Idempotente: recorre las casas a las que les falte, así que volver a
-- aplicarla no duplica nada. No borra ni modifica datos existentes.

do $$
declare
  h record;
  v_admin uuid;
  v_space_id uuid;
begin
  for h in
    select ho.id, ho.currency_code
    from public.houses ho
    where not exists (
      select 1 from public.financial_spaces s
      where s.house_id = ho.id and s.type = 'household'
    )
  loop
    select m.user_id into v_admin
    from public.home_members m
    where m.house_id = h.id
    order by (m.role = 'admin') desc, m.user_id
    limit 1;

    insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
    values ('household', 'house', 'Hogar', '🏠', v_admin, h.id, v_admin)
    returning id into v_space_id;

    insert into public.financial_accounts
      (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
    values
      (v_space_id, 'Cuenta Común', '🏦', '#6366F1', 'bank', coalesce(h.currency_code, 'EUR'), true, v_admin);
  end loop;
end $$;

-- EOF
