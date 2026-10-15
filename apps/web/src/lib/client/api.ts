"use client";

/** Cliente del panel: todas las llamadas pasan por el proxy BFF (/panel/api/proxy/...). */
const BASE = "/panel/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (response.status === 401) {
    window.location.href = "/panel/login";
    throw new ApiError(401, "Tu sesión expiró");
  }
  if (!response.ok) {
    const raw = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(response.status, Array.isArray(raw) ? raw.join(". ") : (raw ?? `Error ${response.status}`));
  }
  return data as T;
}

/** Fetcher de SWR: la clave es la ruta de la API, p. ej. `admin/vehicles?limit=100`. */
export async function fetcher<T>(path: string): Promise<T> {
  return parse<T>(await fetch(`${BASE}/proxy/${path}`, { cache: "no-store" }));
}

export async function send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(`${BASE}/proxy/${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function authCall<T>(path: "request-code" | "verify" | "logout", body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const raw = data.message;
    throw new ApiError(response.status, Array.isArray(raw) ? raw.join(". ") : (raw ?? "No se pudo completar"));
  }
  return data as T;
}
