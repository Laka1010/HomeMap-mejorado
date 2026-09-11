import { ArrowLeft } from "lucide-react";
import { useTranslation } from "../../i18n";
import { objectCategoryEmoji, objectCategoryLabel } from "../../utils/categoryEmoji";
import { categoryEmoji, categoryLabel } from "../../modules/economy/economyCategories";
import { CategoryListEditor } from "./CategoryListEditor";

/**
 * Editor de los dos tipos de categorías del hogar, en un cajón lateral (mismo
 * patrón que MemberDetailScreen — se engancha a la derecha sobre
 * Configuración de la casa, no es una ventana flotante):
 *  - Objetos del hogar (`state.categories`, tabla `categories`)
 *  - Economía: Gastos e Ingresos (`state.economyCategories`, tabla
 *    `economy_categories`)
 *
 * Cada lista es un `CategoryListEditor` (añadir / renombrar / borrar). Los
 * cambios se propagan al momento vía los `onChange*` que recibe de App, que
 * son quienes guardan en Supabase.
 */
export function CategoriesScreen({
  categories = [],
  onChangeCategories,
  economyCategories = { expense: [], income: [] },
  onChangeEconomyCategories,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div
        className="hm-drawer hm-scroll"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(100%, 520px)", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", borderRadius: "0" }}
      >
        <div style={{ padding: "28px 28px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t("houseSettings.categoriesModalTitle")}</div>
          <button className="hm-btn hm-btn-ghost hm-square-54 hm-justify-center" onClick={onClose} aria-label={t("common.close")}>
            <ArrowLeft size={20} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "grid", gap: 24, alignContent: "start" }}>
          <CategoryListEditor
            title={t("houseSettings.categoriesObjectsTab")}
            items={categories}
            onChange={onChangeCategories}
            emojiFor={objectCategoryEmoji}
            labelFor={(name) => objectCategoryLabel(name, t)}
          />
          <CategoryListEditor
            title={t("houseSettings.categoriesExpenseTab")}
            items={economyCategories.expense}
            onChange={(next) => onChangeEconomyCategories?.("expense", next)}
            emojiFor={categoryEmoji}
            labelFor={(name) => categoryLabel(name, t)}
          />
          <CategoryListEditor
            title={t("houseSettings.categoriesIncomeTab")}
            items={economyCategories.income}
            onChange={(next) => onChangeEconomyCategories?.("income", next)}
            emojiFor={categoryEmoji}
            labelFor={(name) => categoryLabel(name, t)}
          />
        </div>
      </div>
    </div>
  );
}
