/**
 * Wrapper simple de pantalla completa centrada — usado para los estados de
 * carga, login y acceso denegado (los únicos que se renderizan antes de
 * que exista un AdminShell).
 */
export function AdminCenteredScreen({ children }) {
  return (
    <div className="admin-centered-screen">
      {children}
      <style>{`
        .admin-centered-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 24px;
          text-align: center;
          background: var(--bg);
        }
      `}</style>
    </div>
  );
}
