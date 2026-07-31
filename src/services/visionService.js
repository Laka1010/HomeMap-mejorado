/**
 * visionService.js
 * -----------------------------------------------------------------------
 * Punto de entrada único para el reconocimiento de objetos por imagen.
 *
 * El resto de la app (p. ej. ScanSpaceModal) SOLO debe importar
 * `detectObjects` desde este archivo. Nunca debe hablar directamente
 * con OpenAI, Claude o Gemini: eso vive en ./visionProviders.
 *
 * Esto permite cambiar de proveedor de IA (o añadir uno nuevo) sin tocar
 * ni un solo componente de UI.
 *
 * NUNCA pongas claves de API aquí ni en ningún archivo del frontend.
 * Las claves deben vivir en un backend/proxy propio (variables de entorno
 * del servidor) que el frontend llama por HTTPS. Ver visionProviders/*.js
 * para más detalle sobre dónde encaja cada proveedor.
 */

import { getActiveProvider } from "./visionProviders";

/**
 * @typedef {Object} DetectedObject
 * @property {string} name        Nombre del objeto detectado, p. ej. "Cable HDMI"
 * @property {string} category    Categoría sugerida, p. ej. "Tecnología"
 * @property {number} confidence  Confianza del modelo, de 0 a 1
 */

/**
 * Analiza una imagen y devuelve los objetos detectados en ella.
 *
 * @param {File|Blob} imageFile Imagen capturada o subida por el usuario
 * @param {Object} [options]
 * @param {(stage: string) => void} [options.onProgress] callback opcional
 *   invocado con el nombre de la fase actual ("uploading" | "analyzing" | "classifying")
 * @returns {Promise<DetectedObject[]>}
 */
export async function detectObjects(imageFile, options = {}) {
  if (!imageFile) {
    throw new Error("detectObjects: se requiere una imagen (File o Blob).");
  }

  const provider = getActiveProvider();
  options.onProgress?.("uploading");

  const rawResults = await provider.detectObjects(imageFile, options);

  // Normalizamos la salida del proveedor a un formato estable, para que
  // dé igual qué IA se use por debajo: la UI siempre recibe lo mismo.
  return normalizeResults(rawResults);
}

function normalizeResults(rawResults) {
  if (!Array.isArray(rawResults)) return [];
  return rawResults
    .filter((r) => r && typeof r.name === "string" && r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      category: typeof r.category === "string" && r.category.trim() ? r.category.trim() : "Otros",
      confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.75,
    }));
}
