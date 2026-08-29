import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";import * as SecureStore from 'expo-secure-store';
import { setOnSessionExpired, setOnTokensRotated } from "../api/client";
import { authService } from '../services/auth.service';

import { AuthUser } from "@/types/auth";

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  isAuthenticated: boolean;

  login: (
    accessToken: string,
    refreshToken: string,
    user: AuthUser
  ) => Promise<void>;

  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

interface Props {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  // Cuando el cliente HTTP rota los tokens (401 → refresh), actualiza el estado
  // React para que accessToken/refreshToken de useAuth reflejen los valores
  // vigentes de SecureStore, evitando tokens stale tras una renovación.
  const onTokensRotated = useCallback(
    (newAccess: string, newRefresh: string) => {
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
    },
    []
  );

  // Registra el callback que el cliente HTTP invoca cuando una sesión ya no
  // puede refrescarse (refresh falló). Limpia el estado React; la navegación
  // la maneja el guard de rutas (isAuthenticated pasa a false).
  useEffect(() => {
    setOnSessionExpired(clearSessionState);
    setOnTokensRotated(onTokensRotated);
    return () => {
      setOnSessionExpired(null);
      setOnTokensRotated(null);
    };
  }, [clearSessionState, onTokensRotated]);

  const loadSession = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);

      if (!token || !refresh) {
        setLoading(false);
        return;
      }

      // Restaura la sesión de forma optimista para evitar un flash de login.
      let storedUser: AuthUser | null = null;
      if (userJson) {
        try {
          storedUser = JSON.parse(userJson) as AuthUser;
        } catch {
          storedUser = null;
        }
      }
      setAccessToken(token);
      setRefreshToken(refresh);
      setUser(storedUser);

      // Valida contra el backend: si el access token expiró, el cliente HTTP
      // refresca automáticamente. Si el refresh falla, onSessionExpired limpia.
      try {
        const me = await authService.getMe();
        setUser(me);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
      } catch {
        // Error de red: se conserva la sesión optimista (onSessionExpired solo
        // se dispara en fallo real de refresh, no en problemas de conexión).
      }
    } catch {
      // Un fallo de almacenamiento local no debe exponer detalle técnico ni
      // impedir que el guard de rutas muestre el acceso público.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadSession();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [loadSession]);

  const login = useCallback(
    async (access: string, refresh: string, authUser: AuthUser) => {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser));

      setAccessToken(access);
      setRefreshToken(refresh);
      setUser(authUser);
    },
    []
  );

  const logout = useCallback(async () => {
    // El refresh token puede haberse rotado por el cliente HTTP (401 → refresh)
    // sin que el estado React se actualice. Leemos siempre el valor vigente de
    // SecureStore (fuente de verdad) para revocar la sesión actual, no el state
    // potencialmente stale.
    const currentRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    // 1. Revoca la sesión en el backend (el cliente HTTP inyecta el Bearer).
    try {
      if (currentRefreshToken) {
        await authService.logout(currentRefreshToken);
      }
    } catch {
      // 2. Si el backend no está disponible, no dejar al usuario atrapado.
    }

    // 3. Limpia SecureStore y estado local siempre.
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      isAuthenticated: !!accessToken,
      login,
      logout,
    }),
    [user, accessToken, refreshToken, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  }

  return context;
}
