// Segmentos de primer nivel que requieren sesión (consumen endpoints autenticados).
const PRIVATE_SEGMENTS = new Set(["tabs", "route", "map", "stop"]);

// Normaliza el primer segmento (expo-router devuelve grupos con paréntesis).
function normalizeFirstSegment(segment: string | undefined): string {
  if (!segment) return "";
  return segment.replace(/^\(|\)$/g, "");
}

export function isPrivateRoute(segments: (string | undefined)[]): boolean {
  return PRIVATE_SEGMENTS.has(normalizeFirstSegment(segments[0]));
}
