/**
 * visionProviders/index.js
 * -----------------------------------------------------------------------
 * Registro de proveedores de IA de visión disponibles.
 *
 * Cada proveedor implementa la misma interfaz:
 *   { detectObjects(imageFile, options) => Promise<Array<{name, category, confidence}>> }
 *
* El flujo de scan NO debe caer nunca en un provider "mock" o simulado.
* Si no hay un proveedor real configurado, la app debe fallar de forma
* explícita para evitar respuestas inventadas.
*/
 
import { detectObjectsOpenAI } from "./openaiVision";
import { detectObjectsClaude } from "./claudeVision";
import { detectObjectsGemini } from "./geminiVision";
 
const PROVIDERS = {
  openai: { detectObjects: detectObjectsOpenAI },
  claude: { detectObjects: detectObjectsClaude },
  gemini: { detectObjects: detectObjectsGemini },
};
 
/**
 * Nombre del proveedor activo. Se lee de una variable de entorno inyectada
 * en build time (p. ej. Vite: import.meta.env.VITE_VISION_PROVIDER, o
 * Create React App: process.env.REACT_APP_VISION_PROVIDER).
 *
 * Si no está configurado, la app no debe usar un mock ni inventar detecciones.
 */
function readEnvProvider() {
  try {
    // Vite
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_VISION_PROVIDER) {
      return import.meta.env.VITE_VISION_PROVIDER;
    }
  } catch (_) { /* import.meta no disponible en este bundler, seguimos */ }
  try {
    // Create React App / Node
    if (typeof process !== "undefined" && process.env?.REACT_APP_VISION_PROVIDER) {
      return process.env.REACT_APP_VISION_PROVIDER;
    }
  } catch (_) { /* process no disponible en el navegador sin bundler */ }
  return "";
}
 
export function getActiveProvider() {
  const name = (readEnvProvider() || "").toLowerCase();
 
  if (!name) {
    throw new Error(
      "No hay un proveedor de visión configurado. Define VITE_VISION_PROVIDER=openai|claude|gemini en el entorno."
    );
  }
 
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Proveedor de visión no válido: "${name}". Usa "openai", "claude" o "gemini".`
    );
  }
 
  return provider;
}
