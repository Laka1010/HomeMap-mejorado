import { normalizeText } from "../../../utils/textMatch";

/**
 * Palabras clave (normalizadas, sin acentos) que delatan una pregunta
 * relacionada con Haven, en es/ca/en. Deliberadamente generosa: un falso
 * positivo aquí solo hace que el mensaje llegue a Gemini como antes (que ya
 * tiene su propia instrucción de rechazo educado), pero un falso negativo
 * bloquearía una pregunta legítima del usuario sin darle opción a reformular.
 */
const ON_TOPIC_KEYWORDS = [
  "objeto", "objecte", "object", "cosa", "coses", "taladro",
  "habitacion", "habitacio", "room", "zona", "zone", "caja", "capsa", "box",
  "contenidor", "cajon", "armario", "armari", "garaje", "garatge", "garage",
  "cocina", "cuina", "kitchen", "salon", "living", "dormitorio", "bedroom",
  "bany", "bano", "bathroom", "casa", "house", "home", "llar", "hogar",
  "consumible", "consumable", "nevera", "fridge", "despensa", "rebost", "pantry",
  "compra", "compres", "shopping", "comprar", "buy", "carrito", "carret", "cart",
  "tarea", "tasca", "task", "pendiente", "pendent",
  "calendario", "calendari", "calendar", "evento", "esdeveniment", "event",
  "cita", "recordatori", "recordatorio", "reminder",
  "economia", "economy", "gasto", "despesa", "expense", "ingreso", "ingres",
  "income", "presupuesto", "pressupost", "budget", "factura", "rebut", "bill",
  "precio", "preu", "price", "cuesta", "costa", "cost", "cuanto", "quant",
  "donde", "where", "busca", "cerca", "search", "encuentra", "troba", "find",
  "tengo", "tinc", "queda", "falta", "manca", "haven",
];

/** Mensajes muy cortos (saludos, "sí", "vale", respuestas a una pregunta del asistente) se dejan pasar siempre. */
const SHORT_MESSAGE_WORD_LIMIT = 3;

/**
 * Filtro heurístico de cliente: evita gastar una llamada a Gemini en
 * preguntas claramente ajenas a Haven. No es una barrera de seguridad (es
 * solo un ahorro de coste/latencia) ni sustituye a la instrucción de rechazo
 * del system prompt del edge function, que sigue actuando como red de
 * seguridad para lo que este filtro deje pasar.
 */
export function isLikelyOnTopic(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= SHORT_MESSAGE_WORD_LIMIT) return true;
  return ON_TOPIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
