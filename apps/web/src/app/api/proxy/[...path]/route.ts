import { type NextRequest } from "next/server";
import { apiFetch } from "@/lib/server/session";
import { allowedApiPath, forbidden, relay, sameOrigin } from "@/lib/server/guards";

type Context = { params: Promise<{ path: string[] }> };

/**
 * Proxy del panel hacia la API: agrega el token del administrador (cookie httpOnly) y solo permite
 * rutas /admin/* y /auth/me. La API sigue validando roles en cada endpoint.
 */
async function forward(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const target = path.map(encodeURIComponent).join("/");
  if (!allowedApiPath(target)) return forbidden("Ruta no permitida");
  if (request.method !== "GET" && !sameOrigin(request)) return forbidden();
  const query = request.nextUrl.search;
  const body = request.method === "GET" || request.method === "DELETE" ? undefined : await request.text();
  const response = await apiFetch(`${target}${query}`, { method: request.method, body: body || undefined });
  return relay(response);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
