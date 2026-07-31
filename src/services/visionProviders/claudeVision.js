/**
 * claudeVision.js
 * -----------------------------------------------------------------------
 * Integración con Claude Vision (Anthropic).
 *
 * Igual que en openaiVision.js: la API key de Anthropic vive solo en el
 * backend. Este cliente llama a un endpoint propio, p. ej. `/api/vision/claude`,
 * que internamente haría algo como:
 *
 *   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const response = await client.messages.create({
 *     model: "claude-sonnet-5",
 *     max_tokens: 1024,
 *     messages: [{
 *       role: "user",
 *       content: [
 *         { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
 *         { type: "text", text: OBJECT_DETECTION_PROMPT },
 *       ],
 *     }],
 *   });
 *
 * y luego parsearía el bloque de texto JSON devuelto por el modelo.
 */

import { supabase } from "../../supabaseClient";
import { fileToBase64 } from "./imageUtils";

/**
 * @param {File|Blob} imageFile
 * @param {{onProgress?: (stage:string)=>void}} [options]
 * @returns {Promise<Array<{name:string, category:string, confidence:number}>>}
 */
export async function detectObjectsClaude(imageFile, options = {}) {
  options.onProgress?.("uploading");
  const imageBase64 = await fileToBase64(imageFile);

  options.onProgress?.("analyzing");
  const { data, error } = await supabase.functions.invoke("vision-proxy", {
    body: {
      provider: "claude",
      image: imageBase64,
    },
  });

  if (error) {
    throw new Error(`Claude Vision: ${error.message || "error al invocar la Edge Function"}`);
  }

  options.onProgress?.("classifying");
  return Array.isArray(data) ? data : data?.objects || [];
}
