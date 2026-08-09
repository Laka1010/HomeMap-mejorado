import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { securityAdminService } from "../modules/security/services/securityAdminService";
import { SecuritySpinner } from "../modules/security/SecuritySpinner";
import { AdminCenteredScreen } from "./layout/AdminCenteredScreen";
import { AdminLoginScreen } from "./layout/AdminLoginScreen";
import { AccessDeniedScreen } from "./layout/AccessDeniedScreen";
import { AdminShell } from "./layout/AdminShell";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SecurityPage } from "./pages/SecurityPage";
import { OverviewPage } from "./pages/OverviewPage";
import { useAdminRoute } from "./navigation/useAdminRoute";
import { ADMIN_SECTIONS } from "./navigation/sections";

/**
 * Raíz de Admin Console. Estado de sesión + estado de autorización son dos
 * cosas separadas, igual que en App.jsx/SecurityCenter.jsx:
 *
 *   session === undefined  -> resolviendo getSession() todavía
 *   session === null       -> sin sesión -> AdminLoginScreen
 *   session (objeto)       -> hay sesión -> se comprueba autorización
 *
 *   authzStatus 'checking' -> pidiendo am_i_security_admin()
 *   authzStatus 'denied'   -> RPC devolvió false (o lanzó error) -> AccessDeniedScreen
 *   authzStatus 'allowed'  -> se monta AdminShell + la página de la sección activa
 *
 * IMPORTANTE (mismo principio que SecurityCenter.jsx): este componente NO
 * es la autoridad de seguridad. am_i_security_admin() es una llamada RPC
 * que el servidor puede rechazar igual que cualquier otra; el único motivo
 * de que este estado exista en el cliente es evitar montar el árbol de
 * páginas mientras no se sabe si el usuario es admin. Cada página (en
 * particular SecurityPage, que sí hace llamadas reales) vuelve a depender
 * de RPCs que comprueban is_security_admin() de forma independiente en el
 * servidor — si este gate se saltara por completo, esas llamadas
 * seguirían siendo rechazadas.
 */
export function AdminApp() {
  const [session, setSession] = useState(undefined);
  const [authzStatus, setAuthzStatus] = useState("idle"); // idle | checking | denied | allowed
  const { section, navigate } = useAdminRoute();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) setSession(newSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAuthzStatus("idle");
      return;
    }
    let cancelled = false;
    setAuthzStatus("checking");
    securityAdminService
      .amISecurityAdmin()
      .then((isAdmin) => {
        if (!cancelled) setAuthzStatus(isAdmin ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setAuthzStatus("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  if (session === undefined) {
    return (
      <AdminCenteredScreen>
        <SecuritySpinner size={32} />
      </AdminCenteredScreen>
    );
  }

  if (session === null) {
    return <AdminLoginScreen />;
  }

  if (authzStatus === "checking" || authzStatus === "idle") {
    return (
      <AdminCenteredScreen>
        <SecuritySpinner size={32} />
      </AdminCenteredScreen>
    );
  }

  if (authzStatus === "denied") {
    return <AccessDeniedScreen onLogout={handleLogout} />;
  }

  const activeSection = ADMIN_SECTIONS.find((s) => s.id === section);

  return (
    <AdminShell section={section} onNavigate={navigate} onLogout={handleLogout} userEmail={session.user?.email}>
      {section === "overview" && <OverviewPage onNavigate={navigate} />}
      {section === "security" && <SecurityPage />}
      {section !== "overview" && section !== "security" && <PlaceholderPage section={activeSection} />}
    </AdminShell>
  );
}
