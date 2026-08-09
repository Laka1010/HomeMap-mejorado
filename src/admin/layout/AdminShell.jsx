import { AdminSidebar } from "./AdminSidebar";

/**
 * AdminShell = Sidebar + Header + área de contenido, layout propio de
 * Admin Console (no reutiliza Sidebar/BottomNav/Modal de App.jsx — están
 * acoplados a HomeMapAppInner y pensados para el shell móvil de la app de
 * consumo, no para un panel de escritorio).
 */
export function AdminShell({ section, onNavigate, onLogout, userEmail, children }) {
  return (
    <div className="admin-shell">
      <AdminSidebar activeSection={section} onNavigate={onNavigate} />

      <div className="admin-shell-main">
        <header className="admin-header">
          <div className="admin-header-title">Admin Console</div>
          <div className="admin-header-user">
            {userEmail && <span className="admin-header-email">{userEmail}</span>}
            <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="admin-content hm-scroll">
          <div className="hm-fade-in" key={section}>
            {children}
          </div>
        </main>
      </div>

      <style>{`
        .admin-shell {
          display: flex;
          height: 100vh;
          background: var(--bg);
          overflow: hidden;
        }
        .admin-shell-main {
          flex: 1;
          min-width: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .admin-header {
          height: 60px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .admin-header-title {
          font-weight: 700;
          font-size: 15px;
          color: var(--ink);
        }
        .admin-header-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .admin-header-email {
          font-size: 13px;
          color: var(--ink-soft);
        }
        .admin-content {
          flex: 1;
          overflow-y: auto;
          padding: 28px 32px;
        }
      `}</style>
    </div>
  );
}
