/**
 * openaiVision.js
 * -----------------------------------------------------------------------
 * Integración con OpenAI GPT-4.1 / GPT-5 Vision.
 *
 * IMPORTANTE — seguridad: la API key de OpenAI NUNCA debe vivir en este
 * archivo ni en ningún código que se ejecute en el navegador, porque
 * cualquier usuario podría extraerla e inspeccionarla. Por eso esta
 * función no llama a `api.openai.com` directamente: llama a un endpoint
 * propio de tu backend (p. ej. `/api/vision/openai`) que:
 *   1. Recibe la imagen del cliente.
 *   2. Añade la API key desde una variable de entorno del servidor.
 *   3. Llama a OpenAI y devuelve solo el resultado ya normalizado.
 *
 * Ejemplo de lo que haría ese endpoint en el servidor (Node/Express):
 *
 *   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *   const response = await client.chat.completions.create({
 *     model: "gpt-4.1", // o "gpt-5-vision" cuando esté disponible
 *     messages: [{
 *       role: "user",
 *       content: [
 *         { type: "text", text: OBJECT_DETECTION_PROMPT },
 *         { type: "image_url", image_url: { url: imageBase64DataUrl } },
 *       ],
 *     }],
 *     response_format: { type: "json_object" },
 *   });
 *
 * Este archivo solo se encarga de la parte cliente: preparar la imagen
 * y llamar a ese proxy.
 */

import { supabase } from "../../supabaseClient";
import { fileToBase64 } from "./imageUtils";

/**
 * @param {File|Blob} imageFile
 * @param {{onProgress?: (stage:string)=>void}} [options]
 * @returns {Promise<Array<{name:string, category:string, confidence:number}>>}
 */
export async function detectObjectsOpenAI(imageFile, options = {}) {
  options.onProgress?.("uploading");
  const imageBase64 = await fileToBase64(imageFile);

  options.onProgress?.("analyzing");
  const { data, error } = await supabase.functions.invoke("vision-proxy", {
    body: {
      provider: "openai",
      image: imageBase64,
    },
  });

  if (error) {
    throw new Error(`OpenAI Vision: ${error.message || "error al invocar la Edge Function"}`);
  }

  options.onProgress?.("classifying");
  return Array.isArray(data) ? data : data?.objects || [];
}
