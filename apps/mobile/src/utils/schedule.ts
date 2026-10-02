import type { DepartureSummary } from "@/types/operational";
import {
  formatOperationalTime,
  getGuayaquilCurrentTime,
  getGuayaquilToday,
  shiftCivilDate,
} from "@/utils/operational";

/** Reloj de Guayaquil en un instante dado: fecha civil y minutos desde medianoche. */
export interface GuayaquilClock {
  date: string;
  minutes: number;
}

export function getGuayaquilClock(now = new Date()): GuayaquilClock {
  return {
    date: getGuayaquilToday(now),
    minutes: clockToMinutes(getGuayaquilCurrentTime(now)),
  };
}

/** "HH:MM" o "HH:MM:SS" → minutos desde medianoche. */
export function clockToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
}

/** Días civiles entre dos fechas YYYY-MM-DD (b - a). */
function civilDayDiff(a: string, b: string): number {
  const ms =
    new Date(`${b}T12:00:00.000Z`).getTime() -
    new Date(`${a}T12:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Minutos que faltan para una hora de una fecha civil (negativo si ya pasó). */
export function minutesUntil(
  serviceDate: string,
  time: string,
  clock: GuayaquilClock,
): number {
  return (
    civilDayDiff(clock.date, serviceDate) * 1440 +
    clockToMinutes(time) -
    clock.minutes
  );
}

/** Texto corto y humano para el tiempo restante: "Ahora", "en 12 min", "en 1 h 05 min". */
export function formatTimeUntil(minutes: number): string {
  if (minutes <= 0) return "Ahora";
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 24) return "más adelante";
  return rest === 0
    ? `en ${hours} h`
    : `en ${hours} h ${String(rest).padStart(2, "0")} min`;
}

/** Etiqueta del día respecto a hoy: "Hoy", "Mañana" o "lunes 6 de octubre". */
export function formatRelativeDay(serviceDate: string, today: string): string {
  const diff = civilDayDiff(today, serviceDate);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  const date = new Date(`${serviceDate}T12:00:00.000Z`);
  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Hora relevante para el estudiante: la de paso por su parada si la eligió y la
 * salida pasa por ella; si no, la hora de salida.
 */
export function departureTimeAt(
  departure: DepartureSummary,
  stopId: string | null | undefined,
): { time: string; atStop: boolean } {
  if (stopId) {
    const stopTime = departure.stopTimes?.find((item) => item.stopId === stopId);
    if (stopTime) return { time: stopTime.time, atStop: true };
  }
  return { time: formatOperationalTime(departure.scheduledTime), atStop: false };
}

/** Separa salidas en próximas (orden ascendente) y pasadas, según el reloj. */
export function splitByClock<T extends DepartureSummary>(
  departures: T[],
  clock: GuayaquilClock,
  stopIdFor: (departure: T) => string | null | undefined = () => null,
): { upcoming: T[]; past: T[] } {
  const withTime = departures
    .map((departure) => ({
      departure,
      until: minutesUntil(
        departure.serviceDate,
        departureTimeAt(departure, stopIdFor(departure)).time,
        clock,
      ),
    }))
    .sort((a, b) => a.until - b.until);
  return {
    // Un bus "en curso" sigue siendo útil un par de minutos después de su hora.
    upcoming: withTime
      .filter((item) => item.until >= 0 || item.departure.state === "IN_PROGRESS")
      .map((item) => item.departure),
    past: withTime
      .filter((item) => item.until < 0 && item.departure.state !== "IN_PROGRESS")
      .map((item) => item.departure),
  };
}

/** Fechas civiles a consultar para encontrar la siguiente salida (mañana en adelante). */
export function nextServiceDates(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftCivilDate(today, index + 1));
}

/** Primer nombre para el saludo; null si no hay nombre real (no usa el correo). */
export function greetingName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
