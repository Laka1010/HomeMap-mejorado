import { TodayWidget } from "./widgets/TodayWidget";
import { RecentActivityWidget } from "./widgets/RecentActivityWidget";
import { ShoppingPreviewWidget } from "./widgets/ShoppingPreviewWidget";
import { UpcomingBillsWidget } from "./widgets/UpcomingBillsWidget";
import { EconomySummaryWidget } from "./widgets/EconomySummaryWidget";
import { HomeInsightsWidget } from "./widgets/HomeInsightsWidget";
import { MembersWidget } from "./widgets/MembersWidget";

/**
 * Los widgets de Inicio (además de la tarjeta Home Status, que va aparte por
 * ser siempre visible). Un array ordenado en vez de JSX fijo a propósito:
 * el día que se quiera dejar reordenar/ocultar/añadir widgets desde ajustes,
 * solo hace falta filtrar/reordenar esta lista (p.ej. por un array de ids
 * guardado en preferencias) — hoy no hay UI para eso, pero la lista ya está
 * lista para ello sin tocar DashboardOverview.
 *
 * Cada widget decide por sí mismo si tiene algo real que mostrar y devuelve
 * `null` si no, así que un widget "vacío" nunca dibuja un hueco: sencillamente
 * no aparece.
 */
export const DASHBOARD_WIDGETS = [
  { id: "today", Component: TodayWidget },
  { id: "recentActivity", Component: RecentActivityWidget },
  { id: "shoppingPreview", Component: ShoppingPreviewWidget },
  { id: "upcomingBills", Component: UpcomingBillsWidget },
  { id: "economySummary", Component: EconomySummaryWidget },
  { id: "homeInsights", Component: HomeInsightsWidget },
  { id: "members", Component: MembersWidget },
];
