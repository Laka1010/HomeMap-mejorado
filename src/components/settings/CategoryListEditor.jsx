import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Check } from "lucide-react";
import { useTranslation } from "../../i18n";
import { objectCategoryEmoji } from "../../utils/categoryEmoji";

/**
 * Lista editable de categorías (nombres). Edición inline, borrar y añadir.
 * Genérico: sirve para las categorías de objetos y para las de Economía
 * (gastos / ingresos) — cada una pasa su propio `emojiFor`. La UI trabaja con
 * un array de nombres; `onChange` recibe el array completo tras cada cambio y
 * quien lo monta decide cómo persistirlo.
 *
 * El renombrado solo llama a `onChange` al CONFIRMAR (no en cada tecla): así
 * un cambio = una escritura, no una por pulsación — importa para las de
 * Economía, que persisten en Supabase.
 */
export function CategoryListEditor({ title, items = [], onChange, emojiFor = objectCategoryEmoji, addPlaceholder }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(items);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLocal(items || []);
    setEditingIndex(-1);
  }, [items]);

  // Sin duplicados (ignorando mayúsculas y espacios). `exceptIndex` deja fuera
  // la fila que se está renombrando para que "guardar sin cambios" no falle.
  const isDuplicate = (name, exceptIndex = -1) => {
    const key = name.trim().toLowerCase();
    return local.some((c, i) => i !== exceptIndex && (c || "").trim().toLowerCase() === key);
  };

  const commit = (next) => {
    setError("");
    setLocal(next);
    if (onChange) onChange(next);
  };

  const startEdit = (idx) => {
    setError("");
    setEditingIndex(idx);
    setDraft(local[idx]);
  };

  const confirmEdit = () => {
    const trimmed = (draft || "").trim();
    if (!trimmed || trimmed === local[editingIndex]) { setEditingIndex(-1); return; }
    if (isDuplicate(trimmed, editingIndex)) { setError(t("houseSettings.categoryDuplicate", { name: trimmed })); return; }
    setEditingIndex(-1);
    const copy = [...local];
    copy[editingIndex] = trimmed;
    commit(copy);
  };

  const handleDelete = (idx) => {
    if (editingIndex === idx) setEditingIndex(-1);
    commit(local.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    if (isDuplicate(trimmed)) { setError(t("houseSettings.categoryDuplicate", { name: trimmed })); return; }
    setNewName("");
    commit([...local, trimmed]);
  };

  return (
    <div>
      {title ? (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", margin: "0 0 8px 4px" }}>
          {title}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {local.map((cat, idx) => (
          <div key={idx} className="hm-card hm-card--p16" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", display: "grid", placeItems: "center", fontSize: 19, flexShrink: 0 }}
              aria-hidden="true"
            >
              {emojiFor(editingIndex === idx ? draft || cat : cat)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingIndex === idx ? (
                <input
                  className="hm-input"
                  autoFocus
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); if (error) setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") { setError(""); setEditingIndex(-1); } }}
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 14 }}>{cat}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {editingIndex === idx ? (
                <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={confirmEdit}><Check size={14} /></button>
              ) : (
                <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => startEdit(idx)}><Edit3 size={14} /></button>
              )}
              <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => handleDelete(idx)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        <div className="hm-card hm-card--p16" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="hm-input"
            placeholder={addPlaceholder || t("settings.newCategoryPlaceholder") || "Nueva categoría"}
            value={newName}
            onChange={(e) => { setNewName(e.target.value); if (error) setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <button className="hm-btn hm-btn-primary hm-btn--compact" onClick={handleAdd}><Plus size={14} /> {t("shopping.add")}</button>
        </div>

        {error && <div style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600, margin: "2px 4px 0" }}>{error}</div>}
      </div>
    </div>
  );
}
