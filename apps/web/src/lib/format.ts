/** Formatos y textos del panel (zona horaria de Guayaquil). */
const TZ = "America/Guayaquil";

export function todayGuayaquil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `hace ${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Estudiante",
  DRIVER: "Conductor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super administrador",
};

export const DIRECTION_LABEL: Record<string, string> = { IDA: "Ida al campus", RETORNO: "Retorno" };

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  MAINTENANCE: "Mantenimiento",
  ASSIGNED: "Asignado",
  CANCELLED: "Cancelado",
  IN_PROGRESS: "En recorrido",
  COMPLETED: "Finalizado",
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
  LIVE: "En vivo",
  STALE: "Señal atrasada",
  OFFLINE: "Sin señal",
};

/** Traduce los códigos de conflicto de la API a mensajes para el operador. */
export function friendlyError(message: string): string {
  if (message.includes("VEHICLE_CONFLICT")) return "Ese bus ya tiene otro servicio en ese horario.";
  if (message.includes("DRIVER_CONFLICT")) return "Ese conductor ya tiene otro servicio en ese horario.";
  if (message.includes("VEHICLE_ALREADY_TRACKED")) return "Ese bus ya tiene otro GPS vinculado.";
  if (message.includes("ASSIGNMENT_ALREADY_STARTED")) return "El recorrido ya inició; no se puede cancelar.";
  if (message.includes("DRIVER_ROLE_MANAGED")) return "El rol de conductor se asigna desde Conductores (vincular cuenta).";
  if (message.includes("own account")) return "No puedes modificar tu propia cuenta.";
  if (message.includes("Only a SUPER_ADMIN")) return "Solo un super administrador puede gestionar administradores.";
  return message;
}
