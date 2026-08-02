import { supabase } from "../../../supabaseClient";

/**
 * Servicio de Financial Spaces - capa de acceso a datos para el contenedor
 * unificado de Economía (personal / shared / household). Ningún método de
 * este archivo construye pantallas: es la base de datos + RPCs de
 * supabase/migrations/20260803_022_financial_spaces.sql expuesta como
 * funciones JS, lista para que un futuro store/hook la consuma.
 *
 * A diferencia de economyService.js (que traga errores), este servicio
 * sigue el contrato `throw` de taskService/notesService/economyGoalsService.
 */
export const financialSpacesService = {
  /** Todos los espacios accesibles por el usuario actual (los 3 tipos). */
  async listMySpaces() {
    const { data, error } = await supabase
      .from("my_financial_spaces")
      .select("*")
      .order("type", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** El único espacio personal del usuario actual. */
  async getPersonalSpace() {
    const { data, error } = await supabase
      .from("my_financial_spaces")
      .select("*")
      .eq("type", "personal")
      .single();
    if (error) throw error;
    return data;
  },

  /** El espacio household de una casa (existe siempre, se crea con la casa). */
  async getHouseholdSpace(houseId) {
    const { data, error } = await supabase
      .from("my_financial_spaces")
      .select("*")
      .eq("type", "household")
      .eq("house_id", houseId)
      .single();
    if (error) throw error;
    return data;
  },

  /** Espacios compartidos visibles del usuario, opcionalmente filtrados por casa. */
  async listSharedSpaces(houseId) {
    let query = supabase.from("my_financial_spaces").select("*").eq("type", "shared");
    if (houseId) query = query.eq("house_id", houseId);

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** `icon`: emoji, opcional (default '❤️' en la función de BD). */
  async createSharedSpace(name, houseId, icon) {
    const { data, error } = await supabase.rpc("create_shared_financial_space", {
      p_name: name,
      p_house_id: houseId,
      ...(icon ? { p_icon: icon } : {}),
    });
    if (error) throw error;
    return data;
  },

  async renameSpace(spaceId, name) {
    const { error } = await supabase.rpc("rename_financial_space", {
      p_space_id: spaceId,
      p_name: name,
    });
    if (error) throw error;
  },

  /** Solo espacios shared: Personal y Household son permanentes. */
  async archiveSpace(spaceId) {
    const { error } = await supabase.rpc("archive_financial_space", { p_space_id: spaceId });
    if (error) throw error;
  },

  /** Miembros de un espacio compartido, con su nombre desde profiles. */
  async listSpaceMembers(spaceId) {
    const { data, error } = await supabase
      .from("financial_space_members")
      .select("user_id, added_at, profiles:user_id(display_name, email)")
      .eq("space_id", spaceId)
      .order("added_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addMember(spaceId, userId) {
    const { error } = await supabase.rpc("add_financial_space_member", {
      p_space_id: spaceId,
      p_user_id: userId,
    });
    if (error) throw error;
  },

  /** El propietario del espacio no se puede eliminar por esta vía. */
  async removeMember(spaceId, userId) {
    const { error } = await supabase.rpc("remove_financial_space_member", {
      p_space_id: spaceId,
      p_user_id: userId,
    });
    if (error) throw error;
  },

  /** El usuario actual abandona un espacio compartido (el owner no puede: debe archivarlo). */
  async leaveSpace(spaceId) {
    const { error } = await supabase.rpc("leave_financial_space", { p_space_id: spaceId });
    if (error) throw error;
  },
};
