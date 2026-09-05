import { supabase } from "../../../supabaseClient";
import { logIfPermissionDenied, securityEventsService } from "../../../services/securityEventsService";

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

  /**
   * El espacio household de una casa (existe siempre, se crea con la casa).
   * `.single()` lanza PGRST116 ("0 rows") si RLS filtra la fila -- houseId
   * ajeno o acceso a Economía revocado a mitad de sesión son la única forma
   * de llegar aquí, ya que el resto de la app siempre pasa el houseId de la
   * propia casa actual del usuario.
   */
  async getHouseholdSpace(houseId) {
    const { data, error } = await supabase
      .from("my_financial_spaces")
      .select("*")
      .eq("type", "household")
      .eq("house_id", houseId)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        securityEventsService.logSecurityEvent("authz_cross_workspace_access", { resourceType: "house", resourceId: houseId });
      }
      throw error;
    }
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
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  /** Solo espacios shared: Personal y Household son permanentes. */
  async archiveSpace(spaceId) {
    const { error } = await supabase.rpc("archive_financial_space", { p_space_id: spaceId });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  /**
   * Borrado real (no archivo) de un espacio compartido y todo lo que
   * contiene — cuentas, movimientos, facturas, objetivos y transferencias.
   * Solo espacios shared: Personal y Household son permanentes.
   */
  async deleteSpace(spaceId) {
    const { error } = await supabase.rpc("delete_shared_financial_space", { p_space_id: spaceId });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  /**
   * Miembros de un espacio compartido, con su nombre desde profiles.
   * financial_space_members no tiene una FK directa a profiles (ambas
   * referencian auth.users por separado, igual que home_members — ver
   * houseService.getHouseMembers), así que se resuelven en dos consultas y
   * se combinan aquí en vez de usar el embed `profiles:user_id(...)` de
   * PostgREST, que falla porque no hay relación que inferir.
   */
  async listSpaceMembers(spaceId) {
    const { data: members, error: membersError } = await supabase
      .from("financial_space_members")
      .select("user_id, added_at")
      .eq("space_id", spaceId)
      .order("added_at", { ascending: true });
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
      profiles: profileMap.get(m.user_id) || null,
    }));
  },

  // --- Espacios "child": economía propia de un miembro niño, creada y
  // supervisada por el admin de la casa (ver
  // supabase/migrations/20260905_092_child_financial_spaces.sql). El niño es
  // 'contributor' de su espacio; el admin, 'viewer'. Toda mutación pasa por
  // RPCs SECURITY DEFINER gateadas con is_house_admin().

  /** El espacio child de `childUserId` en `houseId`, o null si aún no tiene. */
  async getChildSpaceFor(houseId, childUserId) {
    if (!houseId || !childUserId) return null;
    const { data, error } = await supabase
      .from("financial_spaces")
      .select("id, name, icon, owner_id, house_id, archived_at")
      .eq("type", "child")
      .eq("house_id", houseId)
      .eq("owner_id", childUserId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** `icon`: emoji, opcional (default '🧒' en la función de BD). */
  async createChildSpace(childUserId, houseId, name, icon) {
    const { data, error } = await supabase.rpc("create_child_financial_space", {
      p_child_user_id: childUserId,
      p_house_id: houseId,
      p_name: name,
      ...(icon ? { p_icon: icon } : {}),
    });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "house", resourceId: houseId });
      throw error;
    }
    return data;
  },

  /** Envía dinero (paga) desde una cuenta del adulto a la cuenta del niño. */
  async fundChildSpace(fromAccountId, childSpaceId, amount, note) {
    const { data, error } = await supabase.rpc("fund_child_financial_space", {
      p_from_account_id: fromAccountId,
      p_child_space_id: childSpaceId,
      p_amount: amount,
      ...(note ? { p_note: note } : {}),
    });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: childSpaceId });
      throw error;
    }
    return data;
  },

  async renameChildSpace(spaceId, name) {
    const { error } = await supabase.rpc("rename_child_financial_space", {
      p_space_id: spaceId,
      p_name: name,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  async archiveChildSpace(spaceId) {
    const { error } = await supabase.rpc("archive_child_financial_space", { p_space_id: spaceId });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  async addMember(spaceId, userId) {
    const { error } = await supabase.rpc("add_financial_space_member", {
      p_space_id: spaceId,
      p_user_id: userId,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  /** El propietario del espacio no se puede eliminar por esta vía. */
  async removeMember(spaceId, userId) {
    const { error } = await supabase.rpc("remove_financial_space_member", {
      p_space_id: spaceId,
      p_user_id: userId,
    });
    if (error) {
      logIfPermissionDenied(error, "authz_rpc_rejected", { resourceType: "financial_space", resourceId: spaceId });
      throw error;
    }
  },

  /** El usuario actual abandona un espacio compartido (el owner no puede: debe archivarlo). */
  async leaveSpace(spaceId) {
    const { error } = await supabase.rpc("leave_financial_space", { p_space_id: spaceId });
    if (error) throw error;
  },

  /**
   * Espacios Personales de los demás miembros de una casa concreta, visibles
   * gracias a la policy de "existencia" (financial_spaces_select deja ver la
   * fila con solo id/nombre/icono, nunca cuentas ni movimientos, sin
   * necesidad de que haya ningún acceso concedido — ver
   * economy_access_requests para quién puede además ENTRAR a leerla). Se
   * acota a `houseId` porque un espacio Personal no tiene house_id propio
   * (es del usuario, no de una casa); para saber "quién es compañero en
   * ESTA casa" hay que pasar por home_members. Se combinan con profiles
   * para el nombre del dueño, mismo patrón que listSpaceMembers.
   */
  async listHousematesPersonalSpaces(houseId) {
    if (!houseId) return [];
    const { data: { user } = {} } = await supabase.auth.getUser();

    const { data: members, error: membersError } = await supabase
      .from("home_members")
      .select("user_id")
      .eq("house_id", houseId);
    if (membersError) throw membersError;

    const ownerIds = (members || []).map((m) => m.user_id).filter((id) => id !== user?.id);
    if (ownerIds.length === 0) return [];

    const { data: spaces, error } = await supabase
      .from("financial_spaces")
      .select("id, name, icon, owner_id")
      .eq("type", "personal")
      .is("archived_at", null)
      .in("owner_id", ownerIds);
    if (error) throw error;
    if (!spaces || spaces.length === 0) return [];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ownerIds);
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return spaces.map((s) => ({
      ...s,
      ownerName: profileMap.get(s.owner_id)?.display_name || profileMap.get(s.owner_id)?.email || "",
    }));
  },
};
