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

  const handleDelete = (idx) => {
    const copy = local.filter((_, i) => i !== idx);
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
    <section className="hm-card hm-card--p20" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, flexShrink: 0, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Tag size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("settings.categoriesTitle") || "Categorías"}</h2>
          <p style={{ marginTop: 6, color: "var(--ink-soft)", fontSize: 13 }}>{t("settings.categoriesDescription") || "Personaliza las categorías disponibles para tus objetos y compras."}</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {local.map((cat, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              {editingIndex === idx ? (
                <input className="hm-input" value={cat} onChange={(e) => handleEdit(idx, e.target.value)} />
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{cat}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {editingIndex === idx ? (
                <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={() => setEditingIndex(-1)}><Check size={14} /></button>
              ) : (
                <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setEditingIndex(idx)}><Edit3 size={14} /></button>
              )}
              <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => handleDelete(idx)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="hm-input" placeholder={t("settings.newCategoryPlaceholder") || "Nueva categoría"} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={handleAdd}><Plus size={14} /> {t("shopping.add")}</button>
        </div>
      </div>
    </section>
  );
}
