import { fileToBase64, getPhotoError, compressImage } from "../photoUtils.jsx";
import { callVisionProxy } from "./aiService";
import { premiumService } from "../premiumService";

/**
 * Analiza una foto de uno o varios productos domésticos (modo "consumables"
 * de vision-proxy) y devuelve el JSON crudo del modelo. La validación/
 * transformación a candidatos de consumible vive en consumablesAiService.js
 * -- este archivo solo sabe hablar con la Edge Function.
 */
export async function analyzeConsumablePhoto(imageFile) {
  const photoError = getPhotoError(imageFile);
  if (photoError) throw new Error(photoError);

  // Igual que en receiptService.js: comprimir antes de subir evita que una
  // foto de cámara a resolución completa (varios MB en base64) se quede a
  // medias en redes lentas.
  const compressed = await compressImage(imageFile);
  const base64 = await fileToBase64(compressed);
  const result = await callVisionProxy("consumables", base64);

  // El registro de uso nunca debe bloquear el resultado ya obtenido: si el
  // RPC falla (red, cuota interna...) el análisis ya se pagó y ya se tiene,
  // así que se ignora el error igual que logSecurityEvent.
  premiumService.recordAiUsage("ai_consumables").catch(() => {});

  return result;
}
