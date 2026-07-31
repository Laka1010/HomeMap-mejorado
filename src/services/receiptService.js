import { supabase } from "../supabaseClient";
import { fileToBase64 } from "./photoUtils.jsx";
import { normalizeText } from "../utils/textMatch";

/**
 * Servicio de escaneo de tickets con IA.
 *
 * MOCK_MODE=true simula la extracción (sin coste ni necesidad de tener
 * vision-proxy desplegado con OPENAI_API_KEY). Cuando el proyecto tenga la
 * función desplegada en modo "receipt" (ver supabase/functions/vision-proxy),
 * cambia MOCK_MODE a false: extractReceipt ya está preparado para llamar al
 * mismo endpoint que usa detectObjects (visionService.js), solo que con
 * mode: "receipt" en vez de mode: "object_detection".
 */
export const MOCK_MODE = true;

export const KNOWN_STORES = [
  "Mercadona", "Lidl", "Carrefour", "Consum", "Aldi",
  "Dia", "Bonpreu", "Esclat", "Caprabo", "Alcampo",
];

/** Si el nombre detectado se parece a uno conocido, lo normaliza a su forma canónica. */
export function normalizeStoreName(detected) {
  if (!detected) return "";
  const target = normalizeText(detected);
  const match = KNOWN_STORES.find((s) => {
    const normalized = normalizeText(s);
    return target === normalized || target.includes(normalized);
  });
  return match || detected;
}

/**
 * Si `name` coincide (tras normalizar) con un producto ya conocido en esta
 * casa, devuelve ese nombre canónico; si no, null. Así "leche" reconoce que
 * ya existe "Leche" en el historial y no crea un duplicado con otra grafía.
 */
export function matchKnownProduct(name, knownNames = []) {
  const target = normalizeText(name);
  if (!target) return null;
  return knownNames.find((k) => normalizeText(k) === target) || null;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function itemsWithTotals(items) {
  return items.map((item) => ({ ...item, totalPrice: round2(item.quantity * item.unitPrice) }));
}

const MOCK_TEMPLATES = [
  {
    store: "Mercadona",
    items: [
      { name: "Leche entera", quantity: 2, unitPrice: 0.95 },
      { name: "Tomate frito", quantity: 1, unitPrice: 1.10 },
      { name: "Pan de molde", quantity: 1, unitPrice: 1.35 },
      { name: "Huevos L", quantity: 1, unitPrice: 2.20 },
      { name: "Detergente", quantity: 1, unitPrice: 5.95 },
    ],
    taxRate: 0.04,
    discount: 0.50,
  },
  {
    store: "Lidl",
    items: [
      { name: "Yogur natural", quantity: 1, unitPrice: 1.15 },
      { name: "Café molido", quantity: 1, unitPrice: 3.40 },
      { name: "Papel higiénico", quantity: 1, unitPrice: 4.50 },
      { name: "Manzanas", quantity: 1, unitPrice: 2.10 },
    ],
    taxRate: 0.04,
    discount: 0,
  },
];

function buildMockResult() {
  const template = MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)];
  const items = itemsWithTotals(template.items);
  const subtotal = round2(items.reduce((sum, item) => sum + item.totalPrice, 0));
  const discountAmount = round2(template.discount || 0);
  const taxAmount = round2((subtotal - discountAmount) * (template.taxRate || 0));
  const total = round2(subtotal - discountAmount + taxAmount);
  return {
    store: template.store,
    date: new Date().toISOString().slice(0, 10),
    items,
    taxAmount,
    discountAmount,
    total,
  };
}

/** Los 4 pasos que ve el usuario en la pantalla de análisis, en orden. */
export const RECEIPT_SCAN_STEPS = ["store", "items", "amount", "summary"];

/**
 * Extrae los datos de un ticket a partir de una foto.
 * @param {File|Blob} imageFile
 * @param {{ onProgress?: (step: string) => void, isCancelled?: () => boolean }} options
 */
export async function extractReceipt(imageFile, { onProgress, isCancelled } = {}) {
  if (MOCK_MODE) {
    for (const step of RECEIPT_SCAN_STEPS) {
      if (isCancelled?.()) return null;
      await new Promise((resolve) => setTimeout(resolve, 550));
      onProgress && onProgress(step);
    }
    const result = buildMockResult();
    return { ...result, raw: result };
  }

  onProgress && onProgress(RECEIPT_SCAN_STEPS[0]);
  const image = await fileToBase64(imageFile);
  const { data, error } = await supabase.functions.invoke("vision-proxy", {
    body: { mode: "receipt", image },
  });
  if (isCancelled?.()) return null;
  if (error) throw error;
  onProgress && onProgress(RECEIPT_SCAN_STEPS[RECEIPT_SCAN_STEPS.length - 1]);

  const items = itemsWithTotals(data.items || []);
  return {
    store: data.store || "",
    date: data.date || new Date().toISOString().slice(0, 10),
    items,
    taxAmount: data.taxAmount ?? null,
    discountAmount: data.discountAmount ?? null,
    total: data.total ?? round2(items.reduce((sum, item) => sum + item.totalPrice, 0)),
    raw: data,
  };
}

/** Sube la foto del ticket al bucket privado 'receipts' y devuelve la ruta (no una URL pública). */
export async function uploadReceiptImage(houseId, purchaseId, file) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${houseId}/${purchaseId}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

/** Genera una URL firmada temporal para ver la foto de un ticket (el bucket es privado). */
export async function getReceiptSignedUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data?.signedUrl || null;
}
