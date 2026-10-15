import "server-only";
import { cookies, headers } from "next/headers";

/**
 * Sesión del panel (patrón Backend-for-Frontend): los tokens de la API viven en cookies httpOnly
 * del dominio del panel; el navegador nunca los ve ni los guarda en localStorage.
 */
export const ACCESS_COOKIE = "upsgo_admin_at";
export const REFRESH_COOKIE = "upsgo_admin_rt";
const COOKIE_PATH = "/panel";

export const API_URL = (process.env.API_INTERNAL_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface ApiSession {
  accessToken: string;
  refreshToken: string;
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim() === "https";
}

export async function saveSession(session: ApiSession): Promise<void> {
  const jar = await cookies();
  const secure = await isHttps();
  const base = { httpOnly: true, sameSite: "lax" as const, secure, path: COOKIE_PATH };
  jar.set(ACCESS_COOKIE, session.accessToken, { ...base, maxAge: 15 * 60 });
  jar.set(REFRESH_COOKIE, session.refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
}

export async function readSession(): Promise<Partial<ApiSession>> {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value,
    refreshToken: jar.get(REFRESH_COOKIE)?.value,
  };
}

const PRIVATE_IP = /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|fc|fd|::ffff:(10|127|172|192)\.)/i;

/**
 * IP real del administrador para el rate limiting de la API: la IP pública más a la derecha de
 * X-Forwarded-For (las entradas de la izquierda las puede inventar el cliente).
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (!PRIVATE_IP.test(chain[i]!)) return chain[i]!;
  }
  return chain[0] ?? null;
}

async function forwardHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const ip = await clientIp();
  return { "Content-Type": "application/json", ...(ip ? { "X-Forwarded-For": ip } : {}), ...extra };
}

/** Llama a la API como el administrador; si el access token venció, renueva una vez con el refresh. */
export async function apiFetch(path: string, init: { method?: string; body?: string } = {}): Promise<Response> {
  const session = await readSession();
  const call = (token?: string) =>
    forwardHeaders(token ? { Authorization: `Bearer ${token}` } : {}).then((h) =>
      fetch(`${API_URL}/${path}`, { method: init.method ?? "GET", body: init.body, headers: h, cache: "no-store" }),
    );

  let response = await call(session.accessToken);
  if (response.status === 401 && session.refreshToken) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: await forwardHeaders(),
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: "no-store",
    });
    if (refreshed.ok) {
      const tokens = (await refreshed.json()) as ApiSession;
      await saveSession(tokens);
      response = await call(tokens.accessToken);
    } else {
      await clearSession();
    }
  }
  return response;
}

export async function apiPublic(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}/${path}`, {
    method: "POST",
    headers: await forwardHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
