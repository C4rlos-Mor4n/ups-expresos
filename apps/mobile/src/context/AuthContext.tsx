import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from 'expo-secure-store';
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

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);

      if (token && refresh && userJson) {
        setAccessToken(token);
        setRefreshToken(refresh);
        setUser(JSON.parse(userJson));
      }
    } catch (error) {
      console.error("Error cargando sesión", error);
    } finally {
      setLoading(false);
    }
  }

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

async function logout() {
  try {
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
  } catch (error) {
    console.log("Logout del backend falló, procediendo a cerrar sesión localmente.");
  }

  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);

  setUser(null);
  setAccessToken(null);
  setRefreshToken(null);
}

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
    [user, accessToken, refreshToken, loading]
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