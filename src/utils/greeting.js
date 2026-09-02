/** Franja horaria para el saludo del dashboard — clave i18n bajo "header.*". */
export function getGreetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "header.morning";
  if (hour < 20) return "header.afternoon";
  return "header.night";
}

/** Fecha larga localizada, p.ej. "jueves, 30 de julio" / "Thursday, July 30". */
export function formatLongDate(locale, date = new Date()) {
  const intlLocale = locale === "en" ? "en-US" : locale === "ca" ? "ca-ES" : "es-ES";
  const formatted = new Intl.DateTimeFormat(intlLocale, { weekday: "long", month: "long", day: "numeric" }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
