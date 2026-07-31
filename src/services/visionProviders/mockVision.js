/**
 * mockVision.js
 * -----------------------------------------------------------------------
 * Proveedor "mock": simula una respuesta realista de una IA de visión
 * sin llamar a ningún servicio externo. Es el proveedor activo por
 * defecto, para poder desarrollar y hacer demos de ScanSpaceModal sin
 * necesidad de credenciales.
 *
 * Sustitúyelo por "openai", "claude" o "gemini" (ver ./index.js) cuando
 * tengas el backend/proxy de IA desplegado.
 */

const MOCK_CATALOG = [
  { name: "Cable HDMI", category: "Tecnología" },
  { name: "Ratón Logitech", category: "Tecnología" },
  { name: "Apple Watch", category: "Tecnología" },
  { name: "Auriculares Sony", category: "Tecnología" },
  { name: "Nintendo Switch", category: "Videojuegos" },
  { name: "Adaptador USB-C", category: "Tecnología" },
  { name: "Cargador inalámbrico", category: "Tecnología" },
  { name: "Cable Lightning", category: "Tecnología" },
];

function randomConfidence() {
  return Math.round((0.82 + Math.random() * 0.17) * 100) / 100;
}

/**
 * @param {File|Blob} _imageFile no se usa realmente, solo se simula latencia
 * @param {{onProgress?: (stage:string)=>void}} [options]
 */
export async function detectObjectsMock(_imageFile, options = {}) {
  options.onProgress?.("analyzing");
  await wait(700);
  options.onProgress?.("classifying");
  await wait(600);

  // Selecciona entre 3 y 6 objetos "detectados" al azar del catálogo simulado.
  const count = 3 + Math.floor(Math.random() * 4);
  const shuffled = [...MOCK_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((item) => ({
    ...item,
    confidence: randomConfidence(),
  }));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
