import { Plus } from "lucide-react";
import { useTranslation } from "../../i18n";
import { objectCategoryEmoji } from "../../utils/categoryEmoji";

export function StepCategory({ data, onChange, categories, onNext }) {
  const { t } = useTranslation();
  const selectCategory = (cat) => {
    onChange({ category: cat });
    onNext();
  };

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepCategoryTitle")}</h2>

      <div className="category-grid">
        {categories.map((cat) => (
          <button
            key={cat}
            role="button"
            tabIndex={0}
            className={`category-card hm-tap ${data.category === cat ? "selected" : ""}`}
            onClick={() => selectCategory(cat)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectCategory(cat); }}
            aria-pressed={data.category === cat}
          >
            <span className="category-emoji">{objectCategoryEmoji(cat)}</span>
            <span className="category-name">{cat}</span>
          </button>
        ))}

        <button className="category-card category-add hm-tap" onClick={() => {
          const newCat = prompt(t("wizard.stepCategoryPrompt"));
          if (newCat && newCat.trim()) { onChange({ category: newCat.trim() }); onNext(); }
        }}>
          <div className="category-add-icon">
            <Plus size={20} />
          </div>
          <span className="category-name">{t("wizard.stepCategoryNew")}</span>
        </button>
      </div>

      <style>{`
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 12px;
          width: 100%;
          max-width: 500px;
        }
        .category-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--ink);
        }
        .category-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
        }
        .category-card.selected {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--accent);
        }
        .category-emoji {
          font-size: 24px;
        }
        .category-name {
          font-weight: 600;
          font-size: 13px;
        }
        .category-add {
          border-style: dashed;
          color: var(--ink-soft);
        }
        .category-add-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
