import {
  extractReceipt as extractReceiptRaw,
  normalizeStoreName, matchKnownProduct, uploadReceiptImage, getReceiptSignedUrl,
  RECEIPT_SCAN_STEPS, KNOWN_STORES, MOCK_MODE,
} from "../receiptService";

/**
 * Orquestación del escáner de tickets de Haven IA. Reutiliza por import toda
 * la lógica de extracción/normalización ya existente en ../receiptService.js
 * -- ese archivo no se toca, es el que de verdad habla con vision-proxy y
 * sube la imagen. Esta capa solo añade el requestId (para deduplicar un
 * futuro reintento automático; hoy cada llamada es un intento nuevo del
 * usuario). El registro de uso (sistema de límites Premium) lo hace la
 * propia Edge Function tras una respuesta correcta -- no aquí, para que no
 * sea saltable simplemente no llamando a esta función.
 */
export { normalizeStoreName, matchKnownProduct, uploadReceiptImage, getReceiptSignedUrl, RECEIPT_SCAN_STEPS, KNOWN_STORES, MOCK_MODE };

export async function extractReceipt(imageFile, options) {
  return extractReceiptRaw(imageFile, options);
}
