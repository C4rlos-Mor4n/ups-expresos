import type { Direction, OperationalState } from "@/types/operational";

const GUAYAQUIL_TIMEZONE = "America/Guayaquil";

const stateMeta: Record<OperationalState, { label: string; icon: "calendar-outline" | "bus-outline" | "navigate-circle-outline" | "checkmark-circle-outline" }> = {
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
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftCivilDate(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function getDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) return name.trim();
  if (email) return email.split("@")[0] ?? "Usuario UPS GO";
  return "Usuario UPS GO";
}
