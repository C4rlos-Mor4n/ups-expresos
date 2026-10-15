import type { LiveBus } from "@/types/operational";

/** "hace 12 s", "hace 3 min", "hace 1 h". */
export function formatAge(seconds: number): string {
  if (seconds < 60) return `hace ${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

export type LiveTone = "live" | "stale" | "muted";

export interface LiveStatusCopy {
  title: string;
  detail: string;
  tone: LiveTone;
}

/** Texto honesto del estado de ubicación: nunca presenta una posición vieja como "en vivo". */
export function liveStatusCopy(bus: LiveBus, audience: "student" | "driver" = "student"): LiveStatusCopy {
  const { status, position } = bus.tracking;
  if (status === "NO_DEVICE") {
    return {
      title: audience === "driver" ? "Este bus no tiene GPS vinculado" : "Ubicación no disponible",
      detail:
        audience === "driver"
          ? "La administración debe vincular el GPS de Hunter a este bus."
          : "Este bus aún no comparte su ubicación.",
      tone: "muted",
    };
  }
  if (status === "NOT_LIVE") {
    return {
      title: "Ubicación fuera de servicio",
      detail: "Se muestra desde 30 min antes de la salida.",
      tone: "muted",
    };
  }
  if (status === "NO_SIGNAL" || !position) {
    return {
      title: "Sin señal GPS",
      detail: "El bus no ha reportado su ubicación recientemente.",
      tone: "muted",
    };
  }
  const speed = position.speedKph >= 3 ? ` · ${Math.round(position.speedKph)} km/h` : " · detenido";
  if (position.freshness === "LIVE") {
    return { title: "En vivo", detail: `Actualizado ${formatAge(position.ageSeconds)}${speed}`, tone: "live" };
  }
  return {
    title: "Última ubicación conocida",
    detail: `Reportada ${formatAge(position.ageSeconds)}`,
    tone: "stale",
  };
}

export function phaseLabel(bus: LiveBus): string | null {
  if (bus.phase === "IN_PROGRESS") {
    return bus.startSource === "SYSTEM" ? "En recorrido · iniciado automáticamente" : "En recorrido";
  }
  if (bus.phase === "BEFORE_START") return "Aún no inicia el recorrido";
  return null;
}
