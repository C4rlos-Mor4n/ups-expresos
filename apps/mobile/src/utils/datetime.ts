// Convierte una fecha ISO (el backend serializa DateTime como UTC, p. ej.
// "2026-08-27T12:00:00.000Z") a la hora LOCAL del dispositivo "HH:MM" (ej. "07:15").
// El dispositivo del estudiante se asume en la zona de Ecuador (UTC-5); para un
// dispositivo en otra zona la hora mostrada será la local de ese dispositivo.
// Devuelve null si la entrada es inválida o ausente.
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Convierte una fecha ISO a fecha local amigable "dd MMM yyyy" (ej. "27 ago 2026").
// Devuelve null si la entrada es inválida o ausente.
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}