import { supabase } from "../supabaseClient";

/**
 * Perfil del propio usuario en el servidor (public.profiles). Hoy solo se
 * usa para `last_home_id`: la última casa que abrió, para entrar directo en
 * ella al arrancar la app desde cualquier dispositivo. Ver
 * supabase/migrations/20260830_077_profile_last_home.sql.
 */
export const profileService = {
  /** id de la última casa visitada, o null. `userId` es obligatorio: la
   *  policy profiles_select_self devuelve también filas de compañeros de
   *  casa, así que hay que acotar por id. */
  async getLastHomeId(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("last_home_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.last_home_id || null;
  },

  /** Guarda la última casa visitada. La RPC ignora en silencio una casa a la
   *  que el usuario ya no pertenece. */
  async setLastHome(homeId) {
    const { error } = await supabase.rpc("set_last_home", { p_home_id: homeId || null });
    if (error) throw error;
  },

  /**
   * Fija/corrige el nombre visible del usuario (profiles.display_name), y de
   * paso el nombre de su espacio personal. `profiles` no tiene policy de
   * UPDATE — el cliente no puede tocar la fila directamente — así que pasa
   * por la RPC set_display_name (ver
   * 20260901_087_handle_new_user_tolerates_missing_name.sql). Devuelve el
   * nombre ya recortado que quedó guardado.
   */
  async updateDisplayName(displayName) {
    const { data, error } = await supabase.rpc("set_display_name", { p_display_name: displayName });
    if (error) throw error;
    return data;
  },
};
