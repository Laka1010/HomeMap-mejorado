import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { AdminCenteredScreen } from "./AdminCenteredScreen";

/**
 * Login mínimo de Admin Console — email + contraseña, mismo
 * supabase.auth.signInWithPassword que usa la app de consumo
 * (src/components/auth/AuthView.jsx).
 *
 * Deliberadamente NO reutiliza AuthView.jsx: ese componente depende de
 * I18nProvider/useTranslation (contexto de i18n que Admin Console no monta
 * en esta fase) y de ~15 clases CSS adicionales (.auth-*) para su panel de
 * signup/forgot-password/marketing. Nada de eso hace falta para el gate de
 * 3 estados pedido en esta fase (sin sesión / sin permiso / autorizado).
 * Este componente es un subconjunto deliberadamente más pequeño — solo
 * login, sin signup ni recuperación de contraseña (un administrador ya
 * tiene cuenta de Haven) — no una reimplementación paralela de AuthView.
 */
export function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) setError("Credenciales incorrectas.");
  };

  return (
    <AdminCenteredScreen>
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-title">Haven Admin</div>
        <p className="hm-empty-subtitle" style={{ margin: "0 0 18px" }}>
          Inicia sesión con tu cuenta de Haven.
        </p>

        {error && <div className="admin-login-error">{error}</div>}

        <label className="admin-login-label" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="hm-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="admin-login-label" htmlFor="admin-password">Contraseña</label>
        <input
          id="admin-password"
          className="hm-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="hm-btn hm-btn-primary hm-btn--full" disabled={loading} style={{ marginTop: 16 }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <style>{`
        .admin-login-card {
          width: 100%;
          max-width: 340px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-elev-2);
          padding: 28px 26px;
          text-align: left;
        }
        .admin-login-title { font-weight: 700; font-size: 20px; color: var(--ink); }
        .admin-login-label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-soft); margin: 12px 0 6px; }
        .admin-login-error {
          background: var(--danger-soft); color: var(--danger);
          border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 4px;
        }
      `}</style>
    </AdminCenteredScreen>
  );
}
