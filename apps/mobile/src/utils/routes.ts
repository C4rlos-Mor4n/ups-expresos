export type MobileRole = "STUDENT" | "DRIVER" | "ADMIN" | "SUPER_ADMIN";

// Segmentos de primer nivel que requieren sesión (consumen endpoints autenticados).
const PRIVATE_SEGMENTS = new Set(["student", "driver", "unsupported-role"]);

// Normaliza el primer segmento (expo-router devuelve grupos con paréntesis).
function normalizeFirstSegment(segment: string | undefined): string {
  if (!segment) return "";
  return segment.replace(/^\(|\)$/g, "");
}

export function isPrivateRoute(segments: (string | undefined)[]): boolean {
  return PRIVATE_SEGMENTS.has(normalizeFirstSegment(segments[0]));
}

export function getRoleHome(role: MobileRole | undefined): "/(student)/(tabs)" | "/(driver)/(tabs)" | "/unsupported-role" {
  if (role === "STUDENT") return "/(student)/(tabs)";
  if (role === "DRIVER") return "/(driver)/(tabs)";
  return "/unsupported-role";
}

/**
 * Evita que un deep link abra visualmente el espacio de otro rol. El backend
 * conserva la autorización como fuente de verdad para cada endpoint.
 */
export function canAccessRoleRoute(role: MobileRole | undefined, segments: (string | undefined)[]): boolean {
  const segment = normalizeFirstSegment(segments[0]);
  if (segment === "student") return role === "STUDENT";
  if (segment === "driver") return role === "DRIVER";
  if (segment === "unsupported-role") return role !== "STUDENT" && role !== "DRIVER";
  return true;
}
