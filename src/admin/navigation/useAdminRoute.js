import { useCallback, useEffect, useState } from "react";
import { ADMIN_SECTIONS, DEFAULT_SECTION_ID } from "./sections";

/**
 * Navegación propia de Admin Console basada en el hash de la URL
 * (admin.html#/users, admin.html#/security, ...), sin ninguna librería de
 * routing nueva.
 *
 * Se eligió hash-routing deliberadamente en vez de rutas de path real
 * (/admin/users) porque el hosting actual del proyecto no tiene ningún
 * archivo de rewrites (no existe vercel.json/netlify.toml) — con rutas de
 * path real, recargar la página en /admin/users devolvería un 404 del
 * servidor antes de que este código llegase a ejecutarse. El hash nunca
 * viaja al servidor, así que admin.html siempre se sirve igual
 * independientemente de la sección activa, y las secciones ya quedan
 * direccionables (compartibles, funcionan con atrás/adelante del
 * navegador) desde ahora. Migrar a rutas de path real es una evolución de
 * infraestructura de hosting, no de este código — documentado en el
 * informe de Fase 1.
 */
const VALID_SECTION_IDS = new Set(ADMIN_SECTIONS.map((s) => s.id));

function readSectionFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return VALID_SECTION_IDS.has(raw) ? raw : DEFAULT_SECTION_ID;
}

export function useAdminRoute() {
  const [section, setSection] = useState(readSectionFromHash);

  useEffect(() => {
    const onHashChange = () => setSection(readSectionFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((sectionId) => {
    if (!VALID_SECTION_IDS.has(sectionId)) return;
    window.location.hash = `/${sectionId}`;
  }, []);

  return { section, navigate };
}
