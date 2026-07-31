import { notificationsService } from "../services/notificationsService";
import { economyService } from "../modules/economy/services/economyService";
import { rules } from "./rules";
import { computeHourHistogram, isWithinActiveHours } from "./habits";

function buildHabits(expenses) {
  return {
    // Franja horaria en la que el usuario suele registrar gastos — usada
    // para no molestar con recordatorios de Finanzas fuera de esa franja
    // (p.ej. no avisar a las 9 de la mañana si el usuario registra de noche).
    financeHourHistogram: computeHourHistogram(expenses.map((e) => e.created_at || e.date)),
  };
}

function shouldSuppressByHabit(candidate, habits, now) {
  // Solo se restringen los avisos de "información" (los menos urgentes);
  // lo crítico/importante nunca se suprime por hábitos.
  if (candidate.priority !== "info") return false;
  if (candidate.category === "finanzas") {
    return !isWithinActiveHours(habits.financeHourHistogram, now.getHours());
  }
  return false;
}

function filterByVerbosity(candidates, level) {
  if (level === "onlyImportant") return candidates.filter((c) => c.priority === "critical");
  if (level === "importantAndReminders") return candidates.filter((c) => c.priority !== "info");
  return candidates; // "all" (por defecto)
}

/**
 * Evalúa todas las reglas registradas y sincroniza el resultado con la
 * tabla notifications: crea/actualiza las candidatas vigentes (por
 * dedupe_key, nunca duplica) y archiva automáticamente las que ya existían
 * pero cuya condición ha dejado de cumplirse. Pensado para llamarse desde
 * un efecto reactivo a `state` en App.jsx, no desde un cron — ver el
 * comentario de cabecera de notifications.js sobre el alcance de la v1.
 */
export async function evaluateNotifications({ state, houseId, userId, settings }) {
  if (!houseId) return;

  const today = new Date();
  const [expenses, bills] = await Promise.all([
    economyService.getAllExpenses(houseId, 200).catch((error) => { console.error("Error cargando gastos para notificaciones:", error); return []; }),
    economyService.getAllBills(houseId).catch((error) => { console.error("Error cargando facturas para notificaciones:", error); return []; }),
  ]);

  const habits = buildHabits(expenses);
  const context = { state, houseId, userId, today, expenses, bills, habits };
  const categorySettings = settings?.categories || {};
  const level = settings?.level || "all";

  for (const rule of rules) {
    if (categorySettings[rule.category] === false) {
      try {
        await notificationsService.resolveStale(houseId, rule.id, []);
      } catch (error) {
        console.error(`Error archivando notificaciones desactivadas ("${rule.id}"):`, error);
      }
      continue;
    }

    let candidates = [];
    try {
      candidates = rule.evaluate(context) || [];
    } catch (error) {
      console.error(`Error evaluando la regla de notificaciones "${rule.id}":`, error);
      continue;
    }

    candidates = filterByVerbosity(candidates, level).filter((c) => !shouldSuppressByHabit(c, habits, today));

    try {
      await notificationsService.resolveStale(houseId, rule.id, candidates.map((c) => c.dedupeKey));
      if (candidates.length > 0) {
        await notificationsService.upsertCandidates(houseId, candidates.map((c) => ({ ...c, userId: null })));
      }
    } catch (error) {
      console.error(`Error guardando notificaciones de la regla "${rule.id}":`, error);
    }
  }
}
