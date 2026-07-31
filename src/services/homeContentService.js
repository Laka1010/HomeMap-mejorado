import { supabase } from "../supabaseClient";

/**
 * Servicio de contenido de la casa — rooms/zones/containers/objects en Supabase.
 * Única capa que conoce el mapeo snake_case (DB) <-> camelCase (JS). El resto
 * de la app sigue leyendo/escribiendo state.rooms/zones/containers/objects
 * exactamente como antes (ver src/App.jsx).
 */

function toNumericOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(value) {
  return value ? value : null;
}

function roomFromRow(row) {
  return { id: row.id, name: row.name, icon: row.icon, photo: row.photo };
}

function zoneFromRow(row) {
  return { id: row.id, roomId: row.room_id, name: row.name, icon: row.icon, photo: row.photo };
}

function containerFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    zoneId: row.zone_id,
    parentId: row.parent_id,
    color: row.color,
    photo: row.photo,
  };
}

function objectFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    notes: row.notes,
    photo: row.photo,
    roomId: row.room_id,
    zoneId: row.zone_id,
    containerId: row.container_id,
    price: row.price,
    purchaseDate: row.purchase_date,
    width: row.width,
    height: row.height,
    depth: row.depth,
    locationHistory: Array.isArray(row.location_history) ? row.location_history : [],
    favorite: row.favorite ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const homeContentService = {
  async fetchHomeContent(houseId) {
    const [roomsRes, zonesRes, containersRes, objectsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("house_id", houseId),
      supabase.from("zones").select("*").eq("house_id", houseId),
      supabase.from("containers").select("*").eq("house_id", houseId),
      supabase.from("objects").select("*").eq("house_id", houseId),
    ]);

    if (roomsRes.error) throw roomsRes.error;
    if (zonesRes.error) throw zonesRes.error;
    if (containersRes.error) throw containersRes.error;
    if (objectsRes.error) throw objectsRes.error;

    return {
      rooms: (roomsRes.data || []).map(roomFromRow),
      zones: (zonesRes.data || []).map(zoneFromRow),
      containers: (containersRes.data || []).map(containerFromRow),
      objects: (objectsRes.data || []).map(objectFromRow),
    };
  },

  async createRoom(houseId, room) {
    const { error } = await supabase.from("rooms").insert({
      id: room.id,
      house_id: houseId,
      name: room.name,
      icon: room.icon ?? null,
      photo: room.photo ?? null,
    });
    if (error) throw error;
  },

  async createZone(houseId, zone) {
    const { error } = await supabase.from("zones").insert({
      id: zone.id,
      house_id: houseId,
      room_id: zone.roomId,
      name: zone.name,
      icon: zone.icon ?? null,
      photo: zone.photo ?? null,
    });
    if (error) throw error;
  },

  async createContainer(houseId, container) {
    const { error } = await supabase.from("containers").insert({
      id: container.id,
      house_id: houseId,
      room_id: container.roomId,
      zone_id: container.zoneId ?? null,
      parent_id: container.parentId ?? null,
      name: container.name,
      color: container.color ?? null,
      photo: container.photo ?? null,
    });
    if (error) throw error;
  },

  objectToRow(houseId, object) {
    return {
      id: object.id,
      house_id: houseId,
      room_id: object.roomId ?? null,
      zone_id: object.zoneId ?? null,
      container_id: object.containerId ?? null,
      name: object.name,
      category: object.category ?? null,
      description: object.description ?? null,
      notes: object.notes ?? null,
      photo: object.photo ?? null,
      price: toNumericOrNull(object.price),
      purchase_date: toDateOrNull(object.purchaseDate),
      width: toNumericOrNull(object.width),
      height: toNumericOrNull(object.height),
      depth: toNumericOrNull(object.depth),
      location_history: Array.isArray(object.locationHistory) ? object.locationHistory : [],
      favorite: object.favorite ?? false,
    };
  },

  async createObject(houseId, object) {
    const { error } = await supabase.from("objects").insert(this.objectToRow(houseId, object));
    if (error) throw error;
  },

  async insertObjects(houseId, objects) {
    if (!objects.length) return;
    const { error } = await supabase.from("objects").insert(objects.map((o) => this.objectToRow(houseId, o)));
    if (error) throw error;
  },

  async updateObject(objectId, patch) {
    const row = {};
    if ("roomId" in patch) row.room_id = patch.roomId ?? null;
    if ("zoneId" in patch) row.zone_id = patch.zoneId ?? null;
    if ("containerId" in patch) row.container_id = patch.containerId ?? null;
    if ("name" in patch) row.name = patch.name;
    if ("category" in patch) row.category = patch.category;
    if ("description" in patch) row.description = patch.description;
    if ("notes" in patch) row.notes = patch.notes;
    if ("photo" in patch) row.photo = patch.photo;
    if ("price" in patch) row.price = toNumericOrNull(patch.price);
    if ("purchaseDate" in patch) row.purchase_date = toDateOrNull(patch.purchaseDate);
    if ("width" in patch) row.width = toNumericOrNull(patch.width);
    if ("height" in patch) row.height = toNumericOrNull(patch.height);
    if ("depth" in patch) row.depth = toNumericOrNull(patch.depth);
    if ("locationHistory" in patch) row.location_history = patch.locationHistory;
    if ("favorite" in patch) row.favorite = patch.favorite;

    const { error } = await supabase.from("objects").update(row).eq("id", objectId);
    if (error) throw error;
  },

  async deleteObject(objectId) {
    const { error } = await supabase.from("objects").delete().eq("id", objectId);
    if (error) throw error;
  },
};
