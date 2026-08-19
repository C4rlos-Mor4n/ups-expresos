import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileService } from '../services/mobile.service';
import { Route } from '../types/route';
import { PaginatedMeta } from '../types/api';
import { appendPage } from '../utils/pagination';
import { useAuth } from './AuthContext';

const PAGE_LIMIT = 20;

interface RoutesContextType {
  routes: Route[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refreshRoutes: () => Promise<void>;
  loadMoreRoutes: () => Promise<void>;
}

const RoutesContext = createContext<RoutesContextType>({
  routes: [],
  loading: true,
  loadingMore: false,
  hasMore: false,
  refreshRoutes: async () => {},
  loadMoreRoutes: async () => {},
});

const CACHE_KEY = '@ups_routes_cache';

export const RoutesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRoutes = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Intentamos cargar de caché primero para carga instantánea
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setRoutes(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Fetch de la primera página (revalidate)
      const response = await mobileService.getRoutes({ page: 1, limit: PAGE_LIMIT });
      const meta = response.meta;
      const { items, hasMore: more } = appendPage([], response.data, meta);

      setRoutes(items);
      setPage(meta.page);
      setHasMore(more);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Error fetching routes in context:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadMoreRoutes = useCallback(async () => {
    if (loadingMore || !hasMore || !isAuthenticated) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await mobileService.getRoutes({ page: nextPage, limit: PAGE_LIMIT });
      const meta: PaginatedMeta = response.meta;
      const { items, hasMore: more } = appendPage(routes, response.data, meta);

      setRoutes(items);
      setPage(meta.page);
      setHasMore(more);
    } catch (error) {
      console.error("Error loading more routes:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, isAuthenticated, page, routes]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRoutes();
    } else {
      setRoutes([]);
      setPage(1);
      setHasMore(false);
    }
  }, [fetchRoutes, isAuthenticated]);

  return (
    <RoutesContext.Provider
      value={{ routes, loading, loadingMore, hasMore, refreshRoutes: fetchRoutes, loadMoreRoutes }}
    >
      {children}
    </RoutesContext.Provider>
  );
};

export const useRoutes = () => useContext(RoutesContext);
