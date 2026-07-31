import { Check, Plus, Star, StickyNote, Trash2 } from "lucide-react";
import { notesService } from "../../services/notesService";
import { useTranslation } from "../../i18n";

export function NotesModule({ state, dispatch, openModal }) {
  const { t } = useTranslation();
  const notes = Array.isArray(state.notes) ? state.notes : [];

  const sorted = [...notes].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const togglePinned = (id) => {
    const note = notes.find((n) => n.id === id);
    const nextPinned = !note?.pinned;
    dispatch((current) => ({
      ...current,
      notes: (current.notes || []).map((n) => n.id === id ? { ...n, pinned: nextPinned } : n),
    }));
    notesService.updateNote(id, { pinned: nextPinned }).catch((error) => {
      console.error("Error updating note:", error);
    });
  };

  const toggleDone = (id) => {
    const note = notes.find((n) => n.id === id);
    const nextDone = !note?.done;
    dispatch((current) => ({
      ...current,
      notes: (current.notes || []).map((n) => n.id === id ? { ...n, done: nextDone } : n),
    }));
    notesService.updateNote(id, { done: nextDone }).catch((error) => {
      console.error("Error updating note:", error);
    });
  };

  const deleteNote = (id) => {
    dispatch((current) => ({
      ...current,
      notes: (current.notes || []).filter((n) => n.id !== id),
    }));
    notesService.deleteNote(id).catch((error) => {
      console.error("Error deleting note:", error);
    });
  };

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("notesModule.title")}</h1>
        </div>
        <button className="hm-btn hm-btn-primary" onClick={() => openModal && openModal("addNote")}><Plus size={15} /> {t("notesModule.newNote")}</button>
      </div>

      {sorted.length === 0 ? (
        <div className="hm-card hm-card--p24 hm-card--center">
          <StickyNote size={26} style={{ color: "var(--accent)", marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("notesModule.emptyTitle")}</div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 14 }}>{t("notesModule.emptySubtitle")}</div>
          <button className="hm-btn hm-btn-primary" onClick={() => openModal && openModal("addNote")}><Plus size={15} /> {t("notesModule.addNote")}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((note) => (
            <div
              key={note.id}
              className="hm-card"
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: note.done ? 0.6 : 1,
                borderLeft: note.pinned ? "3px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              <button
                className="hm-btn hm-btn-soft hm-btn--compact"
                onClick={() => toggleDone(note.id)}
                title={note.done ? t("notesModule.markPending") : t("notesModule.markRemembered")}
              >
                <Check size={14} />
              </button>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, textDecoration: note.done ? "line-through" : "none" }}>
                {note.text}
              </div>
              <button
                className="hm-btn hm-btn-ghost hm-btn--compact"
                style={{ color: note.pinned ? "var(--accent)" : "var(--ink-soft)" }}
                onClick={() => togglePinned(note.id)}
                title={note.pinned ? t("notesModule.unpin") : t("notesModule.markImportant")}
              >
                <Star size={14} fill={note.pinned ? "currentColor" : "none"} />
              </button>
              <button className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger" onClick={() => deleteNote(note.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
