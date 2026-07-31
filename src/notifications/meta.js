import { AlertTriangle, Calendar, Home, Info, ShoppingCart, TrendingUp, ClipboardList } from "lucide-react";

export const CATEGORY_META = {
  organizacion: { label: "Organización", icon: ClipboardList },
  compras: { label: "Compras", icon: ShoppingCart },
  finanzas: { label: "Finanzas", icon: TrendingUp },
  calendario: { label: "Calendario", icon: Calendar },
  hogar: { label: "Hogar", icon: Home },
};

export const PRIORITY_META = {
  critical: { label: "Crítica", icon: AlertTriangle, color: "var(--danger)", soft: "var(--danger-soft)" },
  important: { label: "Importante", icon: AlertTriangle, color: "var(--pin)", soft: "var(--pin-soft)" },
  info: { label: "Información", icon: Info, color: "var(--accent)", soft: "var(--accent-soft)" },
};

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.organizacion;
}

export function getPriorityMeta(priority) {
  return PRIORITY_META[priority] || PRIORITY_META.info;
}
