import type { Direction, OperationalState } from "@/types/operational";

const GUAYAQUIL_TIMEZONE = "America/Guayaquil";

const stateMeta: Record<
  OperationalState,
  {
    label: string;
    icon:
      | "calendar-outline"
      | "bus-outline"
      | "navigate-circle-outline"
      | "checkmark-circle-outline";
  }
> = {
  SCHEDULED: { label: "Programado", icon: "calendar-outline" },
  ASSIGNED: { label: "Asignado", icon: "bus-outline" },
  IN_PROGRESS: { label: "En recorrido", icon: "navigate-circle-outline" },
  COMPLETED: { label: "Finalizado", icon: "checkmark-circle-outline" },
};

export function getOperationalStateMeta(state: OperationalState) {
  return stateMeta[state];
}

export function getDirectionLabel(direction: Direction): string {
  return direction === "IDA" ? "Ida" : "Retorno";
}

export function formatOperationalTime(value: string): string {
  return value.slice(0, 5);
}

export function formatGuayaquilDate(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function formatGuayaquilDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horario no disponible";
  return date.toLocaleString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    day: "numeric",
    month: "short",
    timeZone: GUAYAQUIL_TIMEZONE,
  });
}

export function getGuayaquilToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GUAYAQUIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getGuayaquilCurrentTime(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GUAYAQUIL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

export function shiftCivilDate(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function getDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name?.trim()) return name.trim();
  if (email) return email.split("@")[0] ?? "Usuario UPS GO";
  return "Usuario UPS GO";
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

export function addMinutesToOperationalTime(
  baseTime: string,
  offsetMinutes: number,
): string {
  const parts = baseTime.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);

  const totalMinutes = hours * 60 + minutes + (offsetMinutes || 0);
  // Handle 24-hour wrap-around (modulo 1440 minutes in a day)
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const resultHours = Math.floor(normalizedMinutes / 60);
  const resultMins = normalizedMinutes % 60;

  const hStr = resultHours.toString().padStart(2, "0");
  const mStr = resultMins.toString().padStart(2, "0");
  return `${hStr}:${mStr}`;
}
