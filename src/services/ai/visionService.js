import { fileToBase64, getPhotoError, compressImage } from "../photoUtils.jsx";
import { callVisionProxy } from "./aiService";

/**
 * Analiza una foto de uno o varios productos domésticos (modo "consumables"
 * de vision-proxy) y devuelve el JSON crudo del modelo. La validación/
 * transformación a candidatos de consumible vive en consumablesAiService.js
 * -- este archivo solo sabe hablar con la Edge Function.
 *
 * El registro de uso (sistema de límites Premium) lo hace la propia Edge
 * Function tras una respuesta correcta del proveedor -- no aquí, para que no
 * sea saltable simplemente no llamando a esta función. El requestId (nuevo
 * por cada foto) solo sirve para deduplicar si algún día hay reintento
 * automático; hoy cada llamada es un intento nuevo del usuario.
 */
export async function analyzeConsumablePhoto(imageFile) {
  const photoError = getPhotoError(imageFile);
  if (photoError) throw new Error(photoError);

  // Igual que en receiptService.js: comprimir antes de subir evita que una
  // foto de cámara a resolución completa (varios MB en base64) se quede a
  // medias en redes lentas.
  const compressed = await compressImage(imageFile);
  const base64 = await fileToBase64(compressed);
  return callVisionProxy("consumables", base64, crypto.randomUUID());
}
