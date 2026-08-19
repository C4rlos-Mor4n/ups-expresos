import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileService } from '../services/mobile.service';
import { Route } from '../types/route';
import { useAuth } from './AuthContext';

interface RoutesContextType {
  routes: Route[];
  loading: boolean;
  refreshRoutes: () => Promise<void>;
}

const RoutesContext = createContext<RoutesContextType>({
  routes: [],
  loading: true,
  refreshRoutes: async () => {},
});

const CACHE_KEY = '@ups_routes_cache';

export const RoutesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      // Intentamos cargar de caché primero para carga instantánea
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setRoutes(JSON.parse(cached));
        setLoading(false); // Ya tenemos datos, quitamos el loader visual
      } else {
        setLoading(true);
      }

      // Hacemos el fetch en segundo plano (Revalidate)
      const response = await mobileService.getRoutes();
      const data = Array.isArray(response) ? response : (response?.data ?? []);
      
      // Actualizamos estado y caché si es exitoso
      setRoutes(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));

    } catch (error) {
      console.error("Error fetching routes in context:", error);
      // Si falla y no había caché, mostramos vacío
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRoutes();
    } else {
      setRoutes([]);
    }
  }, [fetchRoutes, isAuthenticated]);

  return (
    <RoutesContext.Provider value={{ routes, loading, refreshRoutes: fetchRoutes }}>
      {children}
    </RoutesContext.Provider>
  );
};

export const useRoutes = () => useContext(RoutesContext);
