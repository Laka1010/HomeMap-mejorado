import { Search, Package, ShoppingCart, TrendingUp, Plus, Calendar, CheckSquare } from "lucide-react";

/**
 * Metadatos de presentación por tool, para pintar los indicadores "🔎
 * Buscando objetos..." en el chat a partir de los `toolCalls` que devuelve
 * la Edge Function. NUNCA ejecuta nada -- la lógica real de cada tool
 * (consultas a Supabase con los permisos del usuario) vive solo en
 * supabase/functions/ai-assistant/, por seguridad (ver sección 21 del
 * pedido: la IA no debe tener acceso directo a Supabase desde el cliente).
 */
export const ASSISTANT_TOOL_DISPLAY = {
  search_objects: { icon: Search, labelKey: "assistant.tool.searchObjects" },
  search_objects_all_homes: { icon: Search, labelKey: "assistant.tool.searchObjectsAllHomes" },
  search_consumables: { icon: Package, labelKey: "assistant.tool.searchConsumables" },
  search_shopping_items: { icon: ShoppingCart, labelKey: "assistant.tool.searchShoppingItems" },
  create_shopping_item: { icon: Plus, labelKey: "assistant.tool.createShoppingItem" },
  create_task: { icon: CheckSquare, labelKey: "assistant.tool.createTask" },
  create_calendar_event: { icon: Calendar, labelKey: "assistant.tool.createCalendarEvent" },
  search_expenses: { icon: TrendingUp, labelKey: "assistant.tool.searchExpenses" },
  search_income: { icon: TrendingUp, labelKey: "assistant.tool.searchIncome" },
  get_financial_summary: { icon: TrendingUp, labelKey: "assistant.tool.getFinancialSummary" },
};
