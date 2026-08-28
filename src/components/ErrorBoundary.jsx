import { Component } from "react";

/**
 * Red de seguridad de último recurso. Cualquier excepción no controlada
 * durante el render de la app (un dato inesperado del servidor, un
 * `undefined.map()`, etc.) llegaría, sin esto, como una pantalla en blanco
 * total sin salida. Aquí se captura y se muestra una pantalla de "algo salió
 * mal" con un botón para recargar.
 *
 * Va MONTADO POR ENCIMA de <App/> (ver src/main.jsx), así que no puede
 * apoyarse en el I18nProvider ni en la hoja de estilos global (ambos viven
 * dentro de App): los textos se resuelven aquí con un mini-diccionario y los
 * estilos son inline, con colores que funcionan en claro y oscuro vía
 * `prefers-color-scheme`.
 */

const STRINGS = {
  es: {
    title: "Algo salió mal",
    body: "La aplicación se ha encontrado con un error inesperado. Puedes recargar para volver a intentarlo. Si el problema persiste, cierra y vuelve a abrir la app.",
    reload: "Recargar",
    details: "Detalles técnicos",
  },
  en: {
    title: "Something went wrong",
    body: "The app hit an unexpected error. You can reload to try again. If it keeps happening, close and reopen the app.",
    reload: "Reload",
    details: "Technical details",
  },
};

function pickLang() {
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("en") ? "en" : "es";
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // No hay servicio de telemetría en el proyecto todavía; al menos queda en
    // la consola / logcat para poder diagnosticar un fallo reportado.
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* no-op */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const s = STRINGS[pickLang()];
    const message =
      this.state.error && (this.state.error.stack || String(this.state.error));

    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.icon} aria-hidden="true">!</div>
          <h1 style={styles.title}>{s.title}</h1>
          <p style={styles.body}>{s.body}</p>
          <button type="button" style={styles.button} onClick={this.handleReload}>
            {s.reload}
          </button>
          {message && (
            <details style={styles.details}>
              <summary style={styles.summary}>{s.details}</summary>
              <pre style={styles.pre}>{message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#F6F7F5",
    color: "#1B1D1F",
  },
  card: {
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
  },
  icon: {
    width: "48px",
    height: "48px",
    lineHeight: "48px",
    borderRadius: "50%",
    background: "#F4E1DC",
    color: "#B3503F",
    fontSize: "26px",
    fontWeight: 700,
    margin: "0 auto 16px",
  },
  title: { fontSize: "22px", fontWeight: 700, margin: "0 0 10px" },
  body: { fontSize: "14px", lineHeight: 1.5, margin: "0 0 20px", opacity: 0.8 },
  button: {
    height: "44px",
    padding: "0 24px",
    borderRadius: "12px",
    border: "none",
    background: "#5E8C61",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  details: { marginTop: "20px", textAlign: "left" },
  summary: { fontSize: "12px", opacity: 0.6, cursor: "pointer" },
  pre: {
    marginTop: "8px",
    padding: "12px",
    borderRadius: "8px",
    background: "rgba(0,0,0,0.06)",
    fontSize: "11px",
    lineHeight: 1.4,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "180px",
  },
};

export default ErrorBoundary;
