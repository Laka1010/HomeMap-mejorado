/**
 * geminiVision.js
 * -----------------------------------------------------------------------
 * Integración con Google Gemini Vision.
 *
 * Igual patrón que los demás proveedores: la API key de Google vive solo
 * en el backend. Este cliente llama a un endpoint propio, p. ej.
 * `/api/vision/gemini`, que internamente haría algo como:
 *
 *   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
 *   const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
 *   const result = await model.generateContent([
 *     OBJECT_DETECTION_PROMPT,
 *     { inlineData: { mimeType: "image/jpeg", data: base64Data } },
 *   ]);
 *
 * y luego parsearía el JSON de la respuesta de texto del modelo.
 */

import { supabase } from "../../supabaseClient";
import { fileToBase64 } from "./imageUtils";

/**
 * @param {File|Blob} imageFile
 * @param {{onProgress?: (stage:string)=>void}} [options]
 * @returns {Promise<Array<{name:string, category:string, confidence:number}>>}
 */
export async function detectObjectsGemini(imageFile, options = {}) {
  options.onProgress?.("uploading");
  const imageBase64 = await fileToBase64(imageFile);

  options.onProgress?.("analyzing");
  const { data, error } = await supabase.functions.invoke("vision-proxy", {
    body: {
      provider: "gemini",
      image: imageBase64,
    },
  });

  if (error) {
    throw new Error(`Gemini Vision: ${error.message || "error al invocar la Edge Function"}`);
  }

  options.onProgress?.("classifying");
  return Array.isArray(data) ? data : data?.objects || [];
}
