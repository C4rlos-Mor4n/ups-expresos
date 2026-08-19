# Notas de Implementacion Frontend - UPS ExpresosApp API

Este documento contiene patrones de implementacion recomendados para los equipos de Web Admin (React) y App Movil (Expo).

---

## Para React / Next.js (Web Admin)

### Configuracion de TanStack Query (React Query)

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### Axios client con interceptores

```typescript
// lib/api-client.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request: agregar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de response: refresh automatico ante 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es 401 y no es un intento de refresh, intentar renovar
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          // Si el refresh falla, limpiar tokens y redirigir a login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);
```

### Hooks con TanStack Query

```typescript
// hooks/use-routes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface Route {
  id: string;
  name: string;
  description: string | null;
  direction: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Listar rutas
export function useRoutes(page = 1, limit = 20) {
  return useQuery<PaginatedResponse<Route>>({
    queryKey: ['admin-routes', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/admin/routes', {
        params: { page, limit },
      });
      return data;
    },
  });
}

// Detalle de ruta
export function useRoute(id: string) {
  return useQuery<Route>({
    queryKey: ['admin-route', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/routes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Crear ruta
export function useCreateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<Route, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/admin/routes', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
    },
  });
}

// Actualizar ruta
export function useUpdateRoute(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Route>) => {
      const { data } = await api.patch(`/admin/routes/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-route', id] });
    },
  });
}
```

### Manejo de sesion

```typescript
// hooks/use-auth.ts
import { create } from 'zustand';
import { api } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER';
  emailVerified: boolean;
  isActive: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, code: string) => {
    const { data } = await api.post('/auth/verify-code', { email, code });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { refreshToken });
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ isLoading: false });
    }
  },
}));
```

### Manejo de errores

```typescript
// lib/error-handler.ts
import axios from 'axios';
import { toast } from 'sonner';

export function handleApiError(error: unknown): void {
  if (!axios.isAxiosError(error)) {
    toast.error('Error inesperado');
    return;
  }

  const status = error.response?.status;
  const data = error.response?.data;

  switch (status) {
    case 400: {
      const messages = Array.isArray(data?.message)
        ? data.message
        : [data?.message || 'Datos invalidos'];
      messages.forEach((msg: string) => toast.error(msg));
      break;
    }
    case 401:
      toast.error('Sesion expirada. Inicia sesion nuevamente.');
      break;
    case 403:
      toast.error('No tienes permisos para esta accion');
      break;
    case 404:
      toast.error('Recurso no encontrado');
      break;
    case 409:
      toast.error('Este valor ya esta en uso');
      break;
    case 429:
      toast.error('Demasiados intentos. Espera 1 minuto.');
      break;
    default:
      toast.error('Error del servidor. Intenta mas tarde.');
  }
}
```

---

## Para Expo (App Movil)

### SecureStore para tokens

```typescript
// lib/secure-storage.ts
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ups_access_token';
const REFRESH_TOKEN_KEY = 'ups_refresh_token';

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
```

### API client con refresh automatico

```typescript
// lib/api-client.ts
import axios from 'axios';
import { secureStorage } from './secure-storage';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = 'http://localhost:3000'; // Usar variable de entorno

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Verificar si el token esta por expirar
function isTokenExpiringSoon(token: string, thresholdSeconds = 120): boolean {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    if (!decoded.exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now < thresholdSeconds;
  } catch {
    return true;
  }
}

// Refresh automatico
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

// Interceptor de request
api.interceptors.request.use(async (config) => {
  let accessToken = await secureStorage.getAccessToken();

  if (accessToken && isTokenExpiringSoon(accessToken)) {
    // Token por expirar, renovar antes de enviar
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          await secureStorage.setAccessToken(data.accessToken);
          await secureStorage.setRefreshToken(data.refreshToken);
          accessToken = data.accessToken;
          onRefreshed(accessToken);
        }
      } catch {
        await secureStorage.clearTokens();
        // Redirigir a login (navegacion depende de tu router)
      } finally {
        isRefreshing = false;
      }
    } else {
      // Ya se esta refrescando, esperar
      accessToken = await new Promise<string>((resolve) => {
        addRefreshSubscriber(resolve);
      });
    }
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Interceptor de response
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await secureStorage.clearTokens();
      // Redirigir a login
    }
    return Promise.reject(error);
  },
);
```

### Estado offline basico con TanStack Query

```typescript
// hooks/use-routes.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface Route {
  id: string;
  name: string;
  description: string | null;
  direction: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  isActive: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useMobileRoutes(page = 1, limit = 20) {
  return useQuery<PaginatedResponse<Route>>({
    queryKey: ['mobile-routes', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/mobile/routes', {
        params: { page, limit },
      });
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos (datos frescos)
    gcTime: 60 * 60 * 1000, // 1 hora (garbage collection)
  });
}
```

### Favoritos locales con AsyncStorage

```typescript
// lib/favorites.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'ups_favorite_routes';

export const favorites = {
  async getFavorites(): Promise<string[]> {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  },

  async addFavorite(routeId: string): Promise<void> {
    const current = await favorites.getFavorites();
    if (!current.includes(routeId)) {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...current, routeId]));
    }
  },

  async removeFavorite(routeId: string): Promise<void> {
    const current = await favorites.getFavorites();
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(current.filter((id) => id !== routeId)),
    );
  },

  async isFavorite(routeId: string): Promise<boolean> {
    const current = await favorites.getFavorites();
    return current.includes(routeId);
  },
};
```

---

## Variables de entorno

### Web (.env)

```bash
VITE_API_URL=http://localhost:3000
VITE_APP_NAME="UPS ExpresosApp Admin"
```

### Movil (app.config.ts o .env)

```typescript
export default {
  expo: {
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:3000',
    },
  },
};
```

---

## Tipos compartidos

Se recomienda generar tipos automaticamente desde el OpenAPI spec:

```bash
# Usando openapi-typescript
npx openapi-typescript ./docs/handoff/ups-expresosapp-openapi.json -o ./src/types/api.ts
```

Esto genera tipos TypeScript completos para todos los endpoints, request bodies y responses.

---

## Checklist de implementacion

### Web Admin
- [ ] Configurar Axios con interceptores de auth
- [ ] Configurar TanStack Query con QueryClient
- [ ] Implementar pantalla de login con OTP
- [ ] Implementar refresh automatico de tokens
- [ ] Implementar manejo centralizado de errores
- [ ] Crear hooks para cada endpoint admin
- [ ] Implementar tablas con paginacion
- [ ] Implementar formularios de creacion/edicion
- [ ] Validar formularios antes de enviar (Zod o similar)
- [ ] Implementar proteccion de rutas por rol

### App Movil
- [ ] Configurar SecureStore para tokens
- [ ] Configurar Axios con refresh automatico
- [ ] Implementar pantalla de login con OTP
- [ ] Implementar verificacion de expiracion de token
- [ ] Configurar TanStack Query con cache offline
- [ ] Crear hooks para endpoints mobile
- [ ] Implementar lista de rutas con filtros
- [ ] Implementar mapa con paradas
- [ ] Implementar tabla de horarios
- [ ] Implementar seccion de avisos
- [ ] Implementar formulario de feedback con estrellas
- [ ] Implementar favoritos locales con AsyncStorage
