import { ShieldAlert } from "lucide-react";
import { AdminCenteredScreen } from "./AdminCenteredScreen";

/**
 * Se renderiza cuando hay sesión válida pero am_i_security_admin() ha
 * devuelto false (o ha lanzado error). No es la protección real — es la
 * consecuencia visual de que el servidor ya rechazó a esta cuenta. El
 * mensaje es intencionadamente genérico: no confirma ni niega si la cuenta
 * "existe" como concepto administrativo, solo que esta sesión no tiene
 * acceso.
 */
export function AccessDeniedScreen({ onLogout }) {
  return (
    <AdminCenteredScreen>
      <div className="hm-empty-icon">
        <ShieldAlert size={26} />
      </div>
      <p className="hm-empty-title">Acceso no autorizado</p>
      <p className="hm-empty-subtitle" style={{ maxWidth: 340 }}>
        Esta cuenta no tiene permisos de administrador en Haven. El acceso se
        comprueba en el servidor, independientemente de cómo se haya llegado
        hasta aquí.
      </p>
      <button type="button" className="hm-btn hm-btn-secondary hm-btn--compact" onClick={onLogout}>
        Cerrar sesión
      </button>
    </AdminCenteredScreen>
  );
}
