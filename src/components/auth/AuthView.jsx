import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { BrandMark } from "../BrandMark";
import { useTranslation } from "../../i18n";
import { securityEventsService } from "../../services/securityEventsService";

export function AuthView({ onLogin }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage("");
    setNoticeMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        // Supabase devuelve 200 (sin error) tanto si la cuenta existe como si
        // no, para evitar enumeración -- por eso el "éxito" muestra un aviso
        // neutro. Cuando SÍ hay error es un fallo real (nunca revela
        // existencia de la cuenta) y hay que enseñarlo en vez de mentir con
        // "te hemos enviado un enlace":
        if (error) {
          // 429: demasiadas peticiones seguidas (límite de Supabase).
          if (error.status === 429) {
            setErrorMessage(t("auth.resetRateLimited"));
            return;
          }
          // Sin status o 5xx: el servicio de usuarios no respondió.
          if (!error.status || error.status >= 500) {
            setErrorMessage(t("auth.networkError"));
            return;
          }
          // Otros 4xx: email con formato inválido, redirect no permitida en la
          // config de Auth, SMTP mal configurado en el proyecto, etc.
          setErrorMessage(t("auth.resetEmailError"));
          return;
        }
        securityEventsService.logSecurityEvent("auth_password_reset_requested", { email });
        setNoticeMessage(t("auth.resetEmailSent"));
        return;
      }

      const result = isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim(), surname: surname.trim() } },
        });

      if (result.error) {
        if (isLogin) {
          securityEventsService.logSecurityEvent("auth_login_failure", { email });
        }
        setErrorMessage(getAuthErrorMessage(result.error));
        return;
      }

      if (!result.data.session) {
        setNoticeMessage(t("auth.accountCreatedNotice"));
        switchMode("login");
        return;
      }

      if (isLogin) {
        securityEventsService.logSecurityEvent("auth_login_success");
      }
      onLogin(result.data.user);
    } catch (error) {
      setErrorMessage(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const getAuthErrorMessage = (error) => {
    if (error?.message?.toLowerCase().includes("invalid login credentials")) {
      return t("auth.invalidCredentials");
    }
    if (error?.message?.toLowerCase().includes("user already registered")) {
      return t("auth.emailRegistered");
    }
    return error?.message || t("auth.authError");
  };

  const submitDisabled = isForgot
    ? loading || !email.trim()
    : loading || !email.trim() || !password.trim() || (!isLogin && (!name.trim() || !surname.trim()));

  return (
    <div className="auth-container">
      <div className="auth-card hm-pop">
        <div className="auth-header">
          <div className="auth-logo">
            <BrandMark size={32} />
          </div>
          <h1 className="hm-display auth-title">{isForgot ? t("auth.forgotPasswordTitle") : t("auth.title")}</h1>
          <p className="auth-subtitle">{isForgot ? t("auth.forgotPasswordSubtitle") : t("auth.subtitle")}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="auth-message auth-error" role="alert">{errorMessage}</div>}
          {noticeMessage && <div className="auth-message auth-notice" role="status">{noticeMessage}</div>}
          {!isLogin && !isForgot && (
            <>
              <div className="auth-input-group">
                <label className="hm-label">{t("auth.nameLabel")}</label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    className="hm-input auth-input"
                    placeholder={t("auth.namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="auth-input-group">
                <label className="hm-label">{t("auth.lastNameLabel")}</label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    className="hm-input auth-input"
                    placeholder={t("auth.lastNamePlaceholder")}
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="auth-input-group">
            <label className="hm-label">{t("auth.emailLabel")}</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="hm-input auth-input"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {!isForgot && (
            <div className="auth-input-group">
              <label className="hm-label">{t("auth.passwordLabel")}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="hm-input auth-input"
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {isLogin && (
            <button
              type="button"
              className="auth-forgot-btn"
              onClick={() => switchMode("forgot")}
            >
              {t("auth.forgotPassword")}
            </button>
          )}

          <button
            type="submit"
            className="hm-btn hm-btn-primary auth-submit-btn"
            disabled={submitDisabled}
          >
            {loading ? (
              <div className="spinner" />
            ) : (
              <>
                {isForgot ? t("auth.sendResetLink") : isLogin ? t("auth.login") : t("auth.signup")} <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isForgot ? (
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => switchMode("login")}
            >
              {t("auth.backToLogin")}
            </button>
          ) : (
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => switchMode(isLogin ? "signup" : "login")}
            >
              {isLogin ? t("auth.switchToSignup") : t("auth.switchToLogin")}
            </button>
          )}
        </div>
      </div>

      <div className="auth-visual-info">
        <div className="info-badge">
          <Sparkles size={14} /> {t("auth.newVersionBadge")}
        </div>
        <h2 className="hm-display info-title">{t("auth.infoTitle")}</h2>
        <p className="info-text">
          {t("auth.infoText")}
        </p>
      </div>

      <style>{AUTH_STYLES}</style>
    </div>
  );
}

/**
 * Pantalla mostrada cuando el usuario llega desde el enlace de recuperación
 * de contraseña del email (Supabase crea una sesión temporal de tipo
 * "recovery" y dispara el evento PASSWORD_RECOVERY -- ver App.jsx). No deja
 * pasar a la app hasta que se fija una contraseña nueva con updateUser.
 */
export function ResetPasswordView({ onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message || t("auth.authError"));
        return;
      }
      securityEventsService.logSecurityEvent("auth_password_change");
      onDone();
    } catch (error) {
      setErrorMessage(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card hm-pop">
        <div className="auth-header">
          <div className="auth-logo">
            <BrandMark size={32} />
          </div>
          <h1 className="hm-display auth-title">{t("auth.newPasswordTitle")}</h1>
          <p className="auth-subtitle">{t("auth.newPasswordSubtitle")}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="auth-message auth-error" role="alert">{errorMessage}</div>}

          <div className="auth-input-group">
            <label className="hm-label">{t("auth.newPasswordLabel")}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type="password"
                autoComplete="new-password"
                className="hm-input auth-input"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="hm-label">{t("auth.confirmPasswordLabel")}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type="password"
                autoComplete="new-password"
                className="hm-input auth-input"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="hm-btn hm-btn-primary auth-submit-btn"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? <div className="spinner" /> : <>{t("auth.updatePassword")} <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>

      <style>{AUTH_STYLES}</style>
    </div>
  );
}

const AUTH_STYLES = `
        .auth-container {
          height: 100dvh;
          overflow-y: auto;
          display: flex;
          align-items: safe center;
          justify-content: center;
          background: #f0f2f0;
          background: linear-gradient(135deg, #f6f7f5 0%, #eef0ec 100%);
          padding: 24px;
          gap: 60px;
        }
        .auth-card {
          background: var(--surface);
          width: 100%;
          max-width: 400px;
          padding: 40px 32px;
          border-radius: 24px;
          box-shadow: var(--shadow-elev-1);
          border: 1px solid var(--border);
        }
        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .auth-logo {
          width: 64px;
          height: 64px;
          background: #F3F4F6;
          border: 1px solid var(--border);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 10px 20px -5px var(--accent-soft);
        }
        .auth-title {
          font-size: 32px;
          margin: 0 0 8px;
          font-weight: 800;
          color: var(--ink);
        }
        .auth-subtitle {
          color: var(--ink-soft);
          font-size: 15px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .auth-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .auth-input-icon {
          position: absolute;
          left: 14px;
          color: var(--ink-soft);
        }
        .auth-input {
          padding-left: 42px !important;
          height: var(--input-height);
          font-size: 15px !important;
          background: var(--surface-alt) !important;
          border-color: var(--border) !important;
        }
        .auth-input:focus {
          background: var(--surface) !important;
          border-color: var(--accent) !important;
        }
        .auth-submit-btn {
          height: var(--btn-height);
          justify-content: center;
          font-size: 15px;
          border-radius: var(--radius);
          margin-top: 10px;
        }
        .auth-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-message {
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.4;
        }
        .auth-error { background: var(--danger-soft); color: var(--danger); }
        .auth-notice { background: var(--success-soft); color: var(--success); }
        .auth-forgot-btn {
          background: none;
          border: none;
          color: var(--ink-soft);
          font-size: 13px;
          text-align: right;
          cursor: pointer;
          padding: 0;
          margin-top: -8px;
          align-self: flex-end;
        }
        .auth-forgot-btn:hover {
          color: var(--accent);
          text-decoration: underline;
        }
        .auth-footer {
          margin-top: 24px;
          text-align: center;
        }
        .auth-switch-btn {
          background: none;
          border: none;
          color: var(--accent);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          opacity: 0.9;
          transition: opacity 0.2s;
        }
        .auth-switch-btn:hover {
          opacity: 1;
          text-decoration: underline;
        }
        .auth-visual-info {
          max-width: 380px;
          display: none;
        }
        .info-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--accent-soft);
          color: var(--accent);
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 24px;
        }
        .info-title {
          font-size: 44px;
          line-height: 1.1;
          margin-bottom: 20px;
        }
        .info-text {
          font-size: 18px;
          color: var(--ink-soft);
          line-height: 1.5;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: hmSpin 0.8s linear infinite;
        }

        @media (min-width: 900px) {
          .auth-visual-info { display: block; }
        }
        @media (max-width: 480px) {
          .auth-card { padding: 40px 24px; border-radius: 0; box-shadow: none; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
          .auth-container { padding: 0; background: white; }
        }
      `;
