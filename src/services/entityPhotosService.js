import { supabase } from "../supabaseClient";
import { compressImage } from "./photoUtils.jsx";

/**
 * Servicio de fotos multi-imagen para objetos/habitaciones/cajas —
 * entity_photos + bucket privado 'entity-photos' en Supabase Storage (ver
 * supabase/migrations/20260731_018_entity_photos.sql). Cada foto se
 * comprime en el cliente antes de subirse (compressImage) para no acumular
 * fotos a resolución completa cuando una entidad tiene varias.
 */

const BUCKET = "entity-photos";

const uid = () => Math.random().toString(36).slice(2, 10);

function rowFromDb(row) {
  return { id: row.id, storagePath: row.storage_path, position: row.position };
}

export const entityPhotosService = {
  async listPhotos(entityType, entityId) {
    const { data, error } = await supabase
      .from("entity_photos")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data || []).map(rowFromDb);
  },

  /** Comprime, sube a Storage y registra la fila. Devuelve la foto creada. */
  async uploadPhoto(houseId, entityType, entityId, file, position = 0) {
    const compressed = await compressImage(file);
    const path = `${houseId}/${entityType}/${entityId}/${Date.now()}-${uid()}.jpg`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("entity_photos")
      .insert({ house_id: houseId, entity_type: entityType, entity_id: entityId, storage_path: path, position })
      .select()
      .single();
    if (error) throw error;
    return rowFromDb(data);
  },

  /** Borra tanto el archivo en Storage como la fila. */
  async deletePhoto(photo) {
    await supabase.storage.from(BUCKET).remove([photo.storagePath]);
    const { error } = await supabase.from("entity_photos").delete().eq("id", photo.id);
    if (error) throw error;
  },

  /** El bucket es privado: la URL de visualización se genera bajo demanda. */
  async getSignedUrl(storagePath, expiresInSeconds = 3600) {
    if (!storagePath) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data?.signedUrl || null;
  },
};
