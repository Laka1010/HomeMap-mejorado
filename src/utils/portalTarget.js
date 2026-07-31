/**
 * Nodo de destino para overlays de pantalla completa renderizados con
 * createPortal. Se usa `.hm-root` (no document.body) para que el overlay
 * siga heredando las variables CSS del tema (colores, modo oscuro/claro)
 * definidas ahí — pero sigue escapando de cualquier ancestro intermedio
 * (como `.hm-fade-in`, cuya animación con transform+fill-mode:both puede
 * convertirse en el "containing block" de un position:fixed y colapsarlo
 * a altura 0 en Safari/iOS).
 */
export function getPortalTarget() {
  return document.querySelector(".hm-root") || document.body;
}
