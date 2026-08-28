import { supabase } from "../supabaseClient";
import { logIfPermissionDenied } from "./securityEventsService";

/**
 * Máximo de casas que un usuario puede crear (no aplica a casas a las que
 * simplemente se une). El límite real vive en la función `create_house` de
 * la base de datos (ver supabase/migrations/20260731_016_max_houses_per_user.sql);
 * esta constante solo se usa en el cliente para desactivar el botón de
 * "crear casa" con antelación, en vez de esperar a que el RPC falle.
 */
export const MAX_HOMES_PER_USER = 2;

/**
 * Servicio de Casas — capa de acceso a houses / home_members / profiles.
 * Toda escritura sobre houses/home_members pasa por RPCs (ver
 * supabase/migrations/20260726_001_houses_members_roles.sql) para que la
 * validación de permisos viva en un único lugar (la base de datos), no en
 * el cliente.
 */
export const houseService = {
  /** Crea una casa nueva; el creador queda como admin. `photo` es opcional (data URL base64). */
  async createHouse(name, photo = null) {
    const { data, error } = await supabase.rpc("create_house", { p_name: name, p_photo: photo });
    if (error) throw error;
    return data;
  },

  /** Se une a una casa existente por código de invitación; entra como 'adult'. */
  async joinHouseByCode(code) {
    const { data, error } = await supabase.rpc("join_house_by_code", { p_code: code });
    if (error) throw error;
    return data;
  },

  /**
   * Rota el código de invitación de una casa y devuelve el nuevo. Solo el
   * admin puede llamarlo (validado en la RPC). Se usa para invalidar un
   * código que ya se compartió — por ejemplo uno de los antiguos de 4
   * caracteres, o si alguien ajeno se ha colado.
   */
  async regenerateInviteCode(houseId) {
    const { data, error } = await supabase.rpc("regenerate_invite_code", { p_house_id: houseId });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
    return data;
  },

  /** Lista las casas del usuario actual, con su rol y nº de miembros. */
  async listMyHouses() {
    const { data, error } = await supabase
      .from("my_houses")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Miembros de una casa con su nombre público (profiles). home_members no
   * tiene una FK directa a profiles (ambas referencian auth.users por
   * separado), así que se resuelven en dos consultas y se combinan aquí.
   */
  async getHouseMembers(houseId) {
    const { data: members, error: membersError } = await supabase
      .from("home_members")
      .select("house_id, user_id, role, joined_at, economy_role")
      .eq("house_id", houseId)
      .order("joined_at", { ascending: true });
    if (membersError) throw membersError;
    if (!members || members.length === 0) return [];

    const userIds = members.map((m) => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return members.map((m) => ({
      ...m,
      name: profileMap.get(m.user_id)?.display_name || profileMap.get(m.user_id)?.email || "Miembro",
      email: profileMap.get(m.user_id)?.email || "",
    }));
  },

  /** Cambia el rol de otro miembro ('adult' | 'child'); solo el admin puede llamarlo. */
  async setMemberRole(houseId, userId, role) {
    const { error } = await supabase.rpc("set_member_role", {
      p_house_id: houseId,
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
  },

  /**
   * Fija el rol de Economía de un miembro en el Workspace Household:
   * `null` = automático (según su rol de casa), o uno explícito
   * ('none'/'contributor'/'manager'). Solo el admin puede llamarlo.
   */
  async setMemberEconomyAccess(houseId, userId, role) {
    const { error } = await supabase.rpc("set_member_economy_access", {
      p_house_id: houseId,
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
  },

  /** Elimina a un miembro de la casa (o te quita a ti mismo). */
  async removeMember(houseId, userId) {
    const { error } = await supabase.rpc("remove_member", {
      p_house_id: houseId,
      p_user_id: userId,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
  },

  /** Transfiere la propiedad de la casa a otro miembro; solo el admin actual puede llamarlo. */
  async transferOwnership(houseId, newOwnerUserId) {
    const { error } = await supabase.rpc("transfer_house_ownership", {
      p_house_id: houseId,
      p_new_owner_user_id: newOwnerUserId,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_permission_bypass_attempt", { resourceType: "house", resourceId: houseId });
      throw error;
    }
  },

  /** Renombra una casa; solo el admin puede llamarlo. */
  async renameHouse(houseId, name) {
    const { data, error } = await supabase.rpc("rename_house", {
      p_house_id: houseId,
      p_name: name,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
    return data;
  },

  /** Cambia la moneda de una casa; solo el admin puede llamarlo. */
  async setHouseCurrency(houseId, currencyCode) {
    const { data, error } = await supabase.rpc("set_house_currency", {
      p_house_id: houseId,
      p_currency_code: currencyCode,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
    return data;
  },

  /**
   * Elimina la casa por completo (habitaciones, objetos, tareas, compras,
   * notas, Economía...) — todas las tablas cuelgan de house_id con
   * `on delete cascade`, así que un solo delete en `houses` limpia todo el
   * árbol. Irreversible; solo el admin puede llamarlo.
   */
  async deleteHouse(houseId) {
    const { error } = await supabase.rpc("delete_house", { p_house_id: houseId });
    if (error) {
      logIfPermissionDenied(error, "authz_unauthorized_write", { resourceType: "house", resourceId: houseId });
      throw error;
    }
  },
};
