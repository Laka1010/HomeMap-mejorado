import { invokeEdgeFunction } from "../../../services/ai/aiService";

/**
 * Cliente del asistente conversacional de Haven IA. Manda el historial
 * completo de la conversación (sin memoria persistente entre sesiones --
 * ver sección 15 del pedido) y la casa activa; toda la orquestación real
 * (llamada al modelo, bucle de tool-calling, ejecución de tools contra
 * Supabase con permisos del propio usuario) vive en la Edge Function
 * ai-assistant, nunca aquí.
 *
 * @param {{role: "user"|"assistant", content: string}[]} messages
 * @param {string} houseId
 * @param {string} [requestId] Id del intento (uno por mensaje enviado), para deduplicar en el servidor si algún día hay reintento automático.
 * @returns {Promise<{ reply: string, toolCalls: {name: string, argsSummary?: string}[] }>}
 */
export async function sendAssistantMessage(messages, houseId, requestId) {
  return invokeEdgeFunction("ai-assistant", { messages, houseId, requestId });
}
