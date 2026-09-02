/**
 * UUID v4 que también funciona fuera de un "secure context".
 *
 * `crypto.randomUUID()` solo está definido en https:// o en http://localhost.
 * Cuando la app se abre desde otro dispositivo por la IP de la red local
 * (p. ej. `http://192.168.1.50:5173`, lo habitual al probar en el móvil con
 * `vite --host`) ese método es `undefined` y llamarlo lanza un TypeError que
 * abortaba silenciosamente la acción (era el motivo de que "Añadir factura"
 * no hiciera nada en esos casos).
 *
 * `crypto.getRandomValues` sí está disponible en cualquier contexto, así que
 * se usa como respaldo para construir el UUID a mano; y si ni siquiera eso
 * existiera, se cae a `Math.random()` (no criptográfico, pero suficiente para
 * un id de fila).
 */
export function safeRandomUUID() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // sigue al respaldo de abajo
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  // versión 4 + variante RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
