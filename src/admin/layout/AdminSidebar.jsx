import { ADMIN_SECTIONS } from "../navigation/sections";

export function AdminSidebar({ activeSection, onNavigate }) {
  return (
    <nav className="admin-sidebar" aria-label="Admin Console">
      <div className="admin-sidebar-brand">
        Haven <span className="admin-sidebar-brand-tag">Admin</span>
      </div>
      <ul className="admin-sidebar-list">
        {ADMIN_SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={`admin-sidebar-item${activeSection === s.id ? " admin-sidebar-item--active" : ""}`}
              onClick={() => onNavigate(s.id)}
              aria-current={activeSection === s.id ? "page" : undefined}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .admin-sidebar {
          width: 220px;
          flex-shrink: 0;
          height: 100vh;
          overflow-y: auto;
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .admin-sidebar-brand {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: var(--ink);
          padding: 0 10px 18px;
        }
        .admin-sidebar-brand-tag {
          color: var(--accent);
        }
        .admin-sidebar-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .admin-sidebar-item {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          border-radius: 8px;
          padding: 9px 10px;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .admin-sidebar-item:hover { background: var(--surface-alt); color: var(--ink); }
        .admin-sidebar-item--active { background: var(--accent-soft); color: var(--accent); }
      `}</style>
    </nav>
  );
}
