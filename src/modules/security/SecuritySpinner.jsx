/** hmSpin ya está definido globalmente en App.jsx (usado igual en la
 * pantalla de carga del wizard) — solo se reutiliza el keyframe, sin
 * volver a declararlo. */
export function SecuritySpinner({ size = 28 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        border: "3px solid var(--accent-soft)", borderTopColor: "var(--accent)",
        animation: "hmSpin 0.9s linear infinite",
      }}
    />
  );
}
