/**
 * imageUtils.js — utilidades compartidas por los proveedores de visión.
 */

/**
 * Convierte un File/Blob de imagen a una data URL base64
 * (formato "data:image/jpeg;base64,...."), tal y como lo esperan
 * las APIs de OpenAI, Claude y Gemini para envío de imágenes inline.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

/** Prompt común enviado a cualquier IA de visión para detectar objetos domésticos. */
export const OBJECT_DETECTION_PROMPT = `
Analiza esta fotografía de un espacio doméstico (cajón, estantería, caja o habitación).
Identifica cada objeto individual visible y claramente reconocible.
Responde ÚNICAMENTE con un array JSON, sin texto adicional, con este formato exacto:
[
  { "name": "Nombre del objeto", "category": "Una categoría breve", "confidence": 0.0-1.0 }
]
`.trim();
