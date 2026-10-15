/**
 * Frescura de una posición: la app nunca debe presentar una coordenada vieja como "en vivo".
 * - LIVE: el último reporte tiene menos de `liveSeconds`.
 * - STALE: entre `liveSeconds` y `staleSeconds` → "última ubicación hace X min".
 * - OFFLINE: más antiguo (o sin reportes) → no se muestra en el mapa.
 *
 * Los umbrales son configurables (TRACKING_LIVE_SECONDS / TRACKING_STALE_SECONDS) porque la
 * frecuencia real de reporte de Hunter aún debe confirmarse.
 */
export type TrackingFreshness = 'LIVE' | 'STALE' | 'OFFLINE';

export function positionAgeSeconds(occurredAt: Date, receivedAt: Date | null, now: Date): number {
  // Si el reloj del dispositivo va adelantado, se usa la hora de recepción.
  const reference = occurredAt.getTime() > now.getTime() ? (receivedAt ?? now) : occurredAt;
  return Math.max(0, Math.round((now.getTime() - reference.getTime()) / 1000));
}

export function classifyFreshness(
  ageSeconds: number | null,
  thresholds: { liveSeconds: number; staleSeconds: number },
): TrackingFreshness {
  if (ageSeconds === null) return 'OFFLINE';
  if (ageSeconds <= thresholds.liveSeconds) return 'LIVE';
  if (ageSeconds <= thresholds.staleSeconds) return 'STALE';
  return 'OFFLINE';
}

/**
 * Cuándo se muestra la ubicación de un bus a los estudiantes:
 * - IN_PROGRESS: siempre (recorrido en curso).
 * - Asignado sin iniciar: desde 30 min antes de la salida planificada hasta su fin planificado
 *   ("el bus aún no inicia el recorrido"), para que el estudiante vea que se acerca al origen.
 * - Completado / fuera de ventana: no se expone ubicación (posición ≠ estado operativo).
 */
export const PRE_DEPARTURE_WINDOW_MINUTES = 30;

export type LivePhase = 'IN_PROGRESS' | 'BEFORE_START' | 'NOT_LIVE';

export function liveBusPhase(
  assignment: {
    plannedStartAt: Date;
    plannedEndAt: Date;
    runStatus: 'IN_PROGRESS' | 'COMPLETED' | null;
  },
  now: Date,
): LivePhase {
  if (assignment.runStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (assignment.runStatus === 'COMPLETED') return 'NOT_LIVE';
  const opens = assignment.plannedStartAt.getTime() - PRE_DEPARTURE_WINDOW_MINUTES * 60_000;
  if (now.getTime() >= opens && now.getTime() <= assignment.plannedEndAt.getTime()) {
    return 'BEFORE_START';
  }
  return 'NOT_LIVE';
}
