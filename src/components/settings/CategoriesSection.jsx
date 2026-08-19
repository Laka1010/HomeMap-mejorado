import { useState, useEffect } from "react";
import { Tag, Plus, Trash2, Edit3, Check } from "lucide-react";
import { useTranslation } from "../../i18n";

export function CategoriesSection({ categories = [], onChange }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(categories);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newName, setNewName] = useState("");

  useEffect(() => setLocal(categories || []), [categories]);

  const update = (next) => {
    setLocal(next);
    if (onChange) onChange(next);
  };

  const handleEdit = (idx, value) => {
    const copy = [...local];
    copy[idx] = value;
    update(copy);
  };

  /**
   * Al borrar hay que recolocar `editingIndex`, que es una POSICIÓN y no un
   * identificador: borrar una categoría situada por encima de la que se está
   * editando dejaba el input abierto sobre otra categoría distinta (la que
   * pasa a ocupar ese índice), y borrar la que se editaba dejaba a la
   * siguiente en modo edición sin haberlo pedido.
   */
  const handleDelete = (idx) => {
    const copy = local.filter((_, i) => i !== idx);
    if (editingIndex === idx) setEditingIndex(-1);
    else if (editingIndex > idx) setEditingIndex(editingIndex - 1);
    update(copy);
  };

  const handleAdd = () => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    const copy = [...local, trimmed];
    setNewName("");
    update(copy);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 16 }}>
          <Tag size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{t("settings.categoriesTitle") || "Categorías"}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{t("settings.categoriesDescription") || "Personaliza las categorías disponibles para tus objetos y compras."}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {local.map((cat, idx) => (
          <div key={idx} className="hm-card hm-card--p16" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingIndex === idx ? (
                <input className="hm-input" value={cat} onChange={(e) => handleEdit(idx, e.target.value)} />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 14 }}>{cat}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {editingIndex === idx ? (
                <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => setEditingIndex(-1)}><Check size={14} /></button>
              ) : (
                <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setEditingIndex(idx)}><Edit3 size={14} /></button>
              )}
              <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => handleDelete(idx)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        <div className="hm-card hm-card--p16" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="hm-input" placeholder={t("settings.newCategoryPlaceholder") || "Nueva categoría"} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={handleAdd}><Plus size={14} /> {t("shopping.add")}</button>
        </div>
      </div>
    </div>
  );
}
