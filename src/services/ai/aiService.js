import { supabase } from "../../supabaseClient";

/**
 * supabase-js lanza un FunctionsHttpError genérico ("Edge Function returned
 * a non-2xx status code") para cualquier fallo del lado servidor -- el
 * cuerpo real (`{ error: "..." }`) que sí escribe vision-proxy queda solo en
 * `error.context`, una Response sin leer. Sin esto, cualquier fallo (clave
 * no configurada, cuota, proveedor caído...) se veía siempre igual desde el
 * cliente, indistinguible entre sí.
 */
async function describeFunctionError(error) {
  const context = error?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error;
    } catch {
      // El cuerpo no era JSON (p.ej. un 502 de la infraestructura) -- se
      // sigue con el mensaje genérico en vez de fallar la lectura del error.
    }
  }
  return error?.message || "Error desconocido";
}

/**
 * Único punto de la app que invoca Edge Functions de IA (vision-proxy,
 * ai-assistant...). Cualquier servicio nuevo pasa por aquí en vez de llamar
 * a supabase.functions.invoke directamente, para no repetir el manejo de
 * errores y para poder cambiar de proveedor/transporte en el futuro sin
 * tocar cada servicio (ver sección 12 del pedido de Haven IA: "no acoplar
 * Haven directamente a un único proveedor de IA").
 */
export async function invokeEdgeFunction(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw new Error(await describeFunctionError(error));
  return data;
}

export async function callVisionProxy(mode, imageBase64) {
  return invokeEdgeFunction("vision-proxy", { mode, image: imageBase64 });
}
