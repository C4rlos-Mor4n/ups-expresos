import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Rechaza solicitudes que cambian datos si no vienen del propio panel (defensa CSRF además de SameSite). */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbidden(message = "Solicitud no permitida") {
  return NextResponse.json({ message }, { status: 403 });
}

/** Rutas de la API que el panel puede usar a través del proxy. */
export function allowedApiPath(path: string): boolean {
  if (path.includes("..")) return false;
  return path === "auth/me" || path.startsWith("admin/");
}

/** Reenvía la respuesta de la API (JSON o vacía) al navegador. */
export async function relay(response: Response): Promise<NextResponse> {
  const text = await response.text();
  return new NextResponse(text || null, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
  });
}
