/**
 * Estadística simple de hábitos, agregada a partir de timestamps que ya
 * existen en la app (no se instrumenta nada nuevo): a qué hora suele el
 * usuario registrar gastos, qué día de la semana suele terminar la compra.
 * Con pocos datos no se restringe nada ("datos insuficientes" = no gating);
 * esto es deliberadamente simple — el sitio donde una futura IA de hábitos
 * se conectaría sin cambiar el resto del motor.
 */

const MIN_SAMPLES = 3;

export function computeHourHistogram(timestamps) {
  const buckets = new Array(24).fill(0);
  timestamps.forEach((ts) => {
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    buckets[d.getHours()] += 1;
  });
  return buckets;
}

export function computeWeekdayHistogram(timestamps) {
  const buckets = new Array(7).fill(0);
  timestamps.forEach((ts) => {
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    buckets[d.getDay()] += 1;
  });
  return buckets;
}

function peakIndex(histogram) {
  let best = 0;
  for (let i = 1; i < histogram.length; i += 1) {
    if (histogram[i] > histogram[best]) best = i;
  }
  return best;
}

/** true si `hour` está dentro de `toleranceHours` de la franja habitual, o si aún no hay datos suficientes. */
export function isWithinActiveHours(histogram, hour, toleranceHours = 3) {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total < MIN_SAMPLES) return true;
  const peak = peakIndex(histogram);
  const diff = Math.min(Math.abs(hour - peak), 24 - Math.abs(hour - peak));
  return diff <= toleranceHours;
}

/** día de la semana (0=domingo) más habitual, o null si aún no hay datos suficientes. */
export function mostCommonWeekday(histogram) {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total < MIN_SAMPLES) return null;
  return peakIndex(histogram);
}
