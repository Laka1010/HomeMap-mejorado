import { ShoppingCart, ChevronRight } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { WidgetCard } from "./WidgetCard";

/** Primeros productos pendientes. Oculto si no hay nada pendiente que comprar. */
export function ShoppingPreviewWidget({ shoppingItems, goTo }) {
  const { t } = useTranslation();
  const pending = (Array.isArray(shoppingItems) ? shoppingItems : []).filter((i) => !i.completed);
  if (pending.length === 0) return null;

  const preview = pending.slice(0, 4);

  return (
    <WidgetCard icon={ShoppingCart} title={t("dashboardOverview.shoppingTitle", { count: pending.length })}>
      <div style={{ display: "grid", gap: 6 }}>
        {preview.map((item) => (
          <div key={item.id} style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            • {item.name}
          </div>
        ))}
      </div>
      <button
        className="hm-btn hm-btn-soft hm-btn--full"
        onClick={() => goTo({ tab: "compras" })}
        style={{ marginTop: 4 }}
      >
        {t("dashboardOverview.shoppingViewList")} <ChevronRight size={14} />
      </button>
    </WidgetCard>
  );
}
