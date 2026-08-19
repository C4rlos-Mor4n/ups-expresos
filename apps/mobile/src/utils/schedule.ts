import { DayOfWeek, Schedule } from "../types/route";

// JS Date.getDay(): 0 = Sunday ... 6 = Saturday
const DAY_INDEX: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

// Devuelve el horario más próximo (día + hora) respecto a `now`.
// Considera el día de la semana y la hora local; si el horario de hoy ya pasó,
// avanza a la siguiente ocurrencia (p. ej. domingo → lunes, fin de día → mañana).
export function getNextSchedule(schedules: Schedule[], now: Date): Schedule | null {
  if (schedules.length === 0) return null;

  let best: Schedule | null = null;
  let bestTime = Infinity;

  for (const schedule of schedules) {
    const [hh, mm] = schedule.departureTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    const targetDay = DAY_INDEX[schedule.dayOfWeek];
    const candidate = new Date(now);
    candidate.setHours(hh, mm, 0, 0);

    // Distancia en días hasta el próximo día objetivo (>= hoy).
    const diff = (targetDay - now.getDay() + 7) % 7;
    candidate.setDate(now.getDate() + diff);

    // Si el horario del día objetivo ya pasó (mismo día con hora anterior),
    // avanzar a la semana siguiente.
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }

    if (candidate.getTime() < bestTime) {
      bestTime = candidate.getTime();
      best = schedule;
    }
  }

  return best;
}
