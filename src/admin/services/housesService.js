import { supabase } from "../../supabaseClient";

/**
 * Envoltorio fino sobre security_admin_list_houses()/get_house_detail() —
 * mismo patrón que usersService.js/platformStatsService.js: la
 * autorización real vive en el servidor, este archivo no decide ni filtra
 * nada por su cuenta. No reutiliza src/services/houseService.js porque
 * ese servicio depende de RLS con alcance de usuario (my_houses,
 * .from("home_members")) — un Security Admin no es miembro de la casa
 * ajena que quiere consultar, así que esas mismas llamadas devolverían
 * vacío para él.
 */
export const housesService = {
  async listHouses({ query = null, limit = 25, offset = 0 } = {}) {
    const { data, error } = await supabase.rpc("security_admin_list_houses", {
      p_query: query || null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return {
      rows: data || [],
      totalCount: data && data.length > 0 ? Number(data[0].total_count) : 0,
    };
  },

  async getHouseDetail(houseId) {
    const { data, error } = await supabase.rpc("security_admin_get_house_detail", { p_house_id: houseId });
    if (error) throw error;
    return data;
  },
};
