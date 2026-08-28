import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";

/**
 * Microinteracción de recompensa al cerrar una compra: un recibo sale de una
 * "impresora" y se celebra con un confeti breve.
 *
 * Solo pinta: no sabe nada de shopping_purchases ni de gastos. Quien la monta
 * (App) ya ha confirmado que el alta terminó bien, así que este componente
 * nunca puede aparecer sobre una operación fallida. Recibe los datos ya
 * resueltos (título, número de productos e importe YA formateado) porque vive
 * fuera del árbol donde se decide la moneda del hogar.
 *
 * Es puramente decorativo: `pointer-events: none` en toda la capa, de forma
 * que aunque el usuario navegue o pulse el toast mientras se reproduce, nada
 * queda bloqueado — y si el overlay se desmontara antes de tiempo, los timers
 * se limpian solos.
 */

/** Milisegundos. La secuencia completa dura HOLD + FADE. */
const TIMING = {
  printDelay: 120,
  printDuration: 820,
  confettiDelay: 900,
  hold: 1980,
  fade: 260,
};
/** Versión sin recorrido: solo aparecer, esperar y desaparecer. */
const TIMING_REDUCED = { hold: 1500, fade: 240 };

/**
 * Borde dentado inferior del ticket. Se genera como polígono (clip-path) en
 * vez de con máscaras cónicas o gradientes repetidos: polygon() es lo que
 * mejor se comporta en el WebView de Android que usa Capacitor.
 */
const ZIGZAG_TEETH = 14;
const ZIGZAG_CLIP = (() => {
  const points = ["0% 0%", "100% 0%"];
  for (let i = ZIGZAG_TEETH; i >= 0; i -= 1) {
    const x = ((i / ZIGZAG_TEETH) * 100).toFixed(3);
    points.push(`${x}% ${i % 2 === 0 ? "0%" : "100%"}`);
  }
  return `polygon(${points.join(",")})`;
})();

// Tokens del tema (el overlay se monta dentro de .hm-root, donde existen),
// con color de reserva por si alguna vez se montara fuera.
const CONFETTI_COLORS = [
  "var(--accent, #5E8C61)",
  "var(--success, #3F7857)",
  "var(--pin, #C98A3E)",
  "var(--chart-category, #1baf7a)",
  "var(--chart-warning, #fab219)",
];
const CONFETTI_COUNT = 16;

function buildConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    // Abanico hacia arriba (de -160° a -20°) para que salga de la impresora
    // en vez de caer directamente, con una caída posterior por la animación.
    const angle = (-160 + (140 * i) / (CONFETTI_COUNT - 1) + (Math.random() * 12 - 6)) * (Math.PI / 180);
    const distance = 92 + Math.random() * 68;
    return {
      id: i,
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${Math.sin(angle) * distance}px`,
      rot: `${Math.round(Math.random() * 540 - 270)}deg`,
      delay: `${Math.round(Math.random() * 140)}ms`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: 5 + Math.round(Math.random() * 3),
      height: 8 + Math.round(Math.random() * 4),
      radius: i % 3 === 0 ? "999px" : "1px",
    };
  });
}

export function PurchaseCompleteAnimation({ title, itemCount, amountText, onDone }) {
  const { t } = useTranslation();
  // onDone puede cambiar de identidad en cada render del padre; guardarlo en
  // una ref evita que el efecto de los timers se reinicie y la animación se
  // quede colgada sin cerrarse nunca.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [leaving, setLeaving] = useState(false);

  const confetti = useMemo(() => (reducedMotion ? [] : buildConfetti()), [reducedMotion]);

  useEffect(() => {
    const { hold, fade } = reducedMotion ? TIMING_REDUCED : TIMING;
    const timers = [
      setTimeout(() => setLeaving(true), hold),
      setTimeout(() => doneRef.current && doneRef.current(), hold + fade),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion]);

  const fadeMs = (reducedMotion ? TIMING_REDUCED : TIMING).fade;

  return (
    <div
      className={`pca-overlay${leaving ? " pca-overlay--leaving" : ""}${reducedMotion ? " pca-reduced" : ""}`}
      role="status"
      aria-live="polite"
      style={{ "--pca-fade": `${fadeMs}ms` }}
    >
      <div className="pca-stage">
        <div className="pca-printer">
          <div className="pca-printer-slot" />
        </div>

        {confetti.length > 0 && (
          <div className="pca-confetti">
            {confetti.map((piece) => (
              <span
                key={piece.id}
                className="pca-confetti-piece"
                style={{
                  "--pca-dx": piece.dx,
                  "--pca-dy": piece.dy,
                  "--pca-rot": piece.rot,
                  animationDelay: `calc(${TIMING.confettiDelay}ms + ${piece.delay})`,
                  background: piece.color,
                  width: piece.width,
                  height: piece.height,
                  borderRadius: piece.radius,
                }}
              />
            ))}
          </div>
        )}

        <div className="pca-clip">
          <div className="pca-receipt">
            <div className="pca-receipt-body">
              <div className="pca-receipt-title">
                <span className="pca-check">✓</span> {t("purchaseCelebration.title")}
              </div>
              {title && <div className="pca-receipt-store">{title}</div>}
              <div className="pca-divider" />
              <div className="pca-receipt-items">
                {t(itemCount === 1 ? "purchaseCelebration.itemsOne" : "purchaseCelebration.items", { count: itemCount })}
              </div>
              {amountText && (
                <>
                  <div className="pca-receipt-total-label">{t("purchaseCelebration.total")}</div>
                  <div className="pca-receipt-total">{amountText}</div>
                </>
              )}
              <div className="pca-divider" />
              <div className="pca-receipt-brand">{t("purchaseCelebration.brand")}</div>
            </div>
            <div className="pca-receipt-edge" />
          </div>
        </div>
      </div>

      <style>{`
        .pca-overlay {
          position: fixed;
          inset: 0;
          z-index: 1400;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Decorativo: nunca captura clics ni deja la interfaz bloqueada. */
          pointer-events: none;
          background: rgba(12, 14, 16, 0.26);
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
          opacity: 1;
          transition: opacity var(--pca-fade) ease;
        }
        .pca-overlay--leaving { opacity: 0; }

        .pca-stage {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          /* La animación empuja el recibo hacia abajo; subir el conjunto lo
             deja ópticamente centrado al terminar. */
          transform: translateY(-46px);
        }

        .pca-printer {
          position: relative;
          z-index: 2;
          width: 236px;
          max-width: 78vw;
          height: 14px;
          border-radius: 7px;
          /* Color fijo, no tokens del tema: el papel también es siempre
             claro, así que la "máquina" tiene que contrastar con él en
             claro y en oscuro por igual. */
          background: linear-gradient(180deg, #3A4046 0%, #23272C 100%);
          box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pcaPrinterIn 260ms cubic-bezier(.22,1,.36,1) both;
        }
        .pca-printer-slot {
          width: 78%;
          height: 3px;
          border-radius: 999px;
          background: #0C0E10;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.14);
        }

        .pca-clip {
          position: relative;
          z-index: 1;
          margin-top: -7px;
          /* El recibo nace detrás de la barra: el recorte lo oculta hasta que
             "sale". El hueco inferior es para que la sombra no se corte. */
          overflow: hidden;
          padding-bottom: 26px;
        }

        .pca-receipt {
          width: 212px;
          max-width: 72vw;
          filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.18));
          /* linear a propósito: cada tramo del keyframe lleva su propia
             curva, para que el papel avance a ritmo de máquina y el muelle
             quede solo al final. */
          animation: pcaPrint ${TIMING.printDuration}ms linear ${TIMING.printDelay}ms both;
        }
        .pca-receipt-body {
          background: #FDFDFB;
          color: #1B1D1F;
          border-radius: 3px 3px 0 0;
          padding: 16px 16px 12px;
          text-align: center;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
        }
        .pca-receipt-edge {
          height: 8px;
          background: #FDFDFB;
          clip-path: ${ZIGZAG_CLIP};
          -webkit-clip-path: ${ZIGZAG_CLIP};
        }
        .pca-receipt-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .pca-check { color: #3F7857; }
        .pca-receipt-store {
          margin-top: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: #45494B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pca-divider {
          margin: 12px 0;
          border-top: 1px dashed #C9CBC4;
        }
        .pca-receipt-items {
          font-size: 12.5px;
          color: #45494B;
        }
        .pca-receipt-total-label {
          margin-top: 12px;
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7A7F7A;
        }
        .pca-receipt-total {
          margin-top: 3px;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .pca-receipt-brand {
          font-family: 'Fraunces', serif;
          font-size: 12px;
          letter-spacing: 0.16em;
          color: #7A7F7A;
        }

        .pca-confetti {
          position: absolute;
          top: 7px;
          left: 50%;
          width: 0;
          height: 0;
          z-index: 3;
        }
        .pca-confetti-piece {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          opacity: 0;
          animation: pcaConfetti 1100ms cubic-bezier(.2,.6,.35,1) both;
        }

        @keyframes pcaPrinterIn {
          from { opacity: 0; transform: scaleX(.6); }
          to { opacity: 1; transform: scaleX(1); }
        }
        /* Salida del papel con un rebote corto al final (efecto muelle). */
        @keyframes pcaPrint {
          0% { transform: translateY(-100%); animation-timing-function: cubic-bezier(.42,.06,.38,.98); }
          76% { transform: translateY(2%); animation-timing-function: cubic-bezier(.33,0,.28,1); }
          88% { transform: translateY(-1%); animation-timing-function: cubic-bezier(.4,0,.3,1); }
          95% { transform: translateY(0.5%); animation-timing-function: ease-out; }
          100% { transform: translateY(0); }
        }
        @keyframes pcaConfetti {
          0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg) scale(.5); }
          12% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--pca-dx), calc(var(--pca-dy) + 78px), 0) rotate(var(--pca-rot)) scale(1); }
        }

        /* Versión sin movimiento: el recibo simplemente aparece. */
        .pca-reduced .pca-printer { animation: none; }
        .pca-reduced .pca-receipt { animation: pcaSoftIn 260ms ease both; }
        .pca-reduced .pca-clip { padding-bottom: 26px; }
        @keyframes pcaSoftIn { from { opacity: 0; } to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .pca-printer { animation: none; }
          .pca-receipt { animation: pcaSoftIn 260ms ease both; }
          .pca-confetti { display: none; }
        }
      `}</style>
    </div>
  );
}
