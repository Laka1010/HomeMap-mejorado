import { useCallback, useEffect, useState } from "react";
import { entityPhotosService } from "../services/entityPhotosService";

/**
 * Estado de la galería de fotos de una entidad (objeto/habitación/caja).
 * Combina las fotos nuevas (entity_photos + Storage) con la foto "legacy"
 * de la propia entidad (columna `photo`, base64) si existe, para que un
 * objeto creado antes de esta función no pierda su foto — se muestra como
 * la primera de la galería y se puede borrar igual que las demás.
 * `legacyPhoto`/`onClearLegacyPhoto` son opcionales: rooms/containers no
 * tienen fotos legacy reales (esa columna nunca se ha llegado a rellenar).
 */
export function useEntityPhotos({ houseId, entityType, entityId, legacyPhoto = null, onClearLegacyPhoto }) {
  const [rows, setRows] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const list = await entityPhotosService.listPhotos(entityType, entityId);
      setRows(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await entityPhotosService.getSignedUrl(p.storagePath).catch(() => null)])
      );
      setUrls(Object.fromEntries(entries));
    } catch (error) {
      console.error("Error loading photos:", error);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { refresh(); }, [refresh]);

  const photos = [
    ...(legacyPhoto ? [{ id: "legacy", url: legacyPhoto, isLegacy: true }] : []),
    ...rows.map((row) => ({ id: row.id, url: urls[row.id], isLegacy: false, raw: row })),
  ];

  const addPhotos = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0 || !houseId || !entityId) return;
    setUploading(true);
    try {
      let position = rows.length;
      for (const file of list) {
        // Secuencial a propósito: mantiene el orden de subida como orden de
        // posición sin tener que reordenar después.
        await entityPhotosService.uploadPhoto(houseId, entityType, entityId, file, position++);
      }
      await refresh();
    } catch (error) {
      console.error("Error uploading photos:", error);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (photo.isLegacy) {
      onClearLegacyPhoto?.();
      return;
    }
    try {
      await entityPhotosService.deletePhoto(photo.raw);
      await refresh();
    } catch (error) {
      console.error("Error deleting photo:", error);
    }
  };

  return { photos, loading, uploading, addPhotos, deletePhoto };
}
