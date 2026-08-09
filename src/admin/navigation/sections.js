/**
 * Única fuente de verdad de las secciones de Admin Console — usada por
 * AdminSidebar (navegación), useAdminRoute (parseo del hash) y AdminApp
 * (mapeo sección -> página). Añadir una sección aquí es lo único necesario
 * para que aparezca en el sidebar; la página en sí se implementa en fases
 * posteriores (PlaceholderPage se usa mientras tanto).
 */
export const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "houses", label: "Houses" },
  { id: "workspaces", label: "Workspaces" },
  { id: "finance", label: "Finance" },
  { id: "support", label: "Support" },
  { id: "security", label: "Security" },
  { id: "analytics", label: "Analytics" },
  { id: "system", label: "System" },
  { id: "settings", label: "Settings" },
];

export const DEFAULT_SECTION_ID = "overview";
