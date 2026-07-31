/**
 * Tiempo relativo con granularidad de minutos/horas, para el centro de
 * actividad (a diferencia del `timeAgo` de App.jsx, que solo distingue por
 * días y no sirve para notificaciones recién creadas).
 */
export function timeAgoShort(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
