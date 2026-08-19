import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// ── Configuración de la API ────────────────────────────────────────────────
// La URL debe venir de configuración explícita. No hay fallback a túneles
// obsoletos: si falta la variable, fallamos claro en lugar de enviar tráfico
// de producción a un endpoint incorrecto.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL && __DEV__) {
  console.warn(
    "EXPO_PUBLIC_API_URL no está definida. Configúrala en apps/mobile/.env",
  );
}

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

export const API_BASE_URL = API_URL;

// ── Cliente HTTP único ─────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inyección del access token en todas las solicitudes.
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore no disponible en web: se envía sin token.
  }
  return config;
});

// ── Refresh de sesión ──────────────────────────────────────────────────────
// Notifica al AuthContext cuando una sesión deja de ser válida (refresh falló),
// para que limpie el estado React y navegue al flujo público.
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

// Único refresh en vuelo: si varios requests reciben 401 a la vez, comparten
// el mismo refresh en lugar de disparar N llamadas concurrentes.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const { data } = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 10000 },
    );

    if (data?.accessToken) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  onSessionExpired?.();
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isAuthRefresh =
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/auth/verify-code") ||
      original?.url?.includes("/auth/request-code");

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRefresh
    ) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      // El refresh falló: la sesión ya no es válida.
      await clearSession();
    }

    return Promise.reject(error);
  },
);

export default api;
