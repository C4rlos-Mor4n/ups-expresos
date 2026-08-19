import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";import * as SecureStore from 'expo-secure-store';
import { setOnSessionExpired } from "../api/client";
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

  // Registra el callback que el cliente HTTP invoca cuando una sesión ya no
  // puede refrescarse (refresh falló). Limpia el estado React; la navegación
  // la maneja el guard de rutas (isAuthenticated pasa a false).
  useEffect(() => {
    setOnSessionExpired(clearSessionState);
    return () => setOnSessionExpired(null);
  }, [clearSessionState]);

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
    } catch (error) {
      console.error("Error cargando sesión", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function login(
    access: string,
    refresh: string,
    authUser: AuthUser
  ) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser));

    setAccessToken(access);
    setRefreshToken(refresh);
    setUser(authUser);
  }

  const logout = useCallback(async () => {
    // 1. Revoca la sesión en el backend (el cliente HTTP inyecta el Bearer).
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // 2. Si el backend no está disponible, no dejar al usuario atrapado.
      console.log("Logout del backend falló, procediendo a cerrar sesión localmente.");
    }

    // 3. Limpia SecureStore y estado local siempre.
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, [refreshToken]);

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
    [user, accessToken, refreshToken, loading, logout]
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
