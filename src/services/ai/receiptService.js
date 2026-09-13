import {
  extractReceipt as extractReceiptRaw,
  normalizeStoreName, matchKnownProduct, uploadReceiptImage, getReceiptSignedUrl,
  RECEIPT_SCAN_STEPS, KNOWN_STORES, MOCK_MODE,
} from "../receiptService";
import { premiumService } from "../premiumService";

/**
 * Orquestación del escáner de tickets STANDALONE de Haven IA (sección 4/5
 * del pedido). Reutiliza por import toda la lógica de extracción/normalización
 * ya existente en ../receiptService.js -- ese archivo no se toca, sigue
 * siendo el que usa el flujo de Compras (ReceiptScanModal/saveScannedPurchase).
 * Esta capa solo añade lo que es específico de Haven IA: registrar el uso de
 * IA (sección 11) cada vez que se hace un análisis real (no en MOCK_MODE,
 * que no cuesta nada).
 */
export { normalizeStoreName, matchKnownProduct, uploadReceiptImage, getReceiptSignedUrl, RECEIPT_SCAN_STEPS, KNOWN_STORES };

export async function extractReceipt(imageFile, options) {
  const result = await extractReceiptRaw(imageFile, options);
  if (result && !MOCK_MODE) {
    premiumService.recordAiUsage("receipt_scanner").catch(() => {});
  }
  return result;
}
