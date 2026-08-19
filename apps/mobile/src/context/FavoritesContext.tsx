import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Route, RouteDetail } from "../types/route";
import { mobileService } from "../services/mobile.service";

const STORAGE_KEY = "favorite_routes";

interface FavoritesContextType {
  favoriteIds: string[];
  favoriteRoutes: RouteDetail[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (route: Route) => Promise<void>;
  getFavoriteDetail: (id: string) => RouteDetail | undefined;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

interface Props {
  readonly children: ReactNode;
}

export function FavoritesProvider({ children }: Props) {
  const [favoriteRoutes, setFavoriteRoutes] = useState<RouteDetail[]>([]);

  // Load persisted favorites on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const parsed: RouteDetail[] = JSON.parse(json);
          setFavoriteRoutes(parsed);
        } catch {
          // Corrupt data – reset
          setFavoriteRoutes([]);
        }
      }
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteRoutes.some((r) => r.id === id),
    [favoriteRoutes]
  );

  const getFavoriteDetail = useCallback(
    (id: string) => favoriteRoutes.find((r) => r.id === id),
    [favoriteRoutes]
  );

  const toggleFavorite = useCallback(async (route: Route) => {
    const isAlreadyFav = favoriteRoutes.some((r) => r.id === route.id);
    
    if (isAlreadyFav) {
      // Remove favorite
      setFavoriteRoutes((prev) => {
        const next = prev.filter((r) => r.id !== route.id);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      // Add favorite optimistically
      const basicDetail = { ...route, stops: [], schedules: [] } as RouteDetail;
      setFavoriteRoutes((prev) => {
        if (prev.some((r) => r.id === route.id)) return prev;
        const next = [...prev, basicDetail];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      // Fetch details in background
      try {
        const data = await mobileService.getRouteDetail(route.id);
        const responseData = data as any;
        const fullDetail = {
          ...route,
          stops: responseData.stops ?? [],
          schedules: responseData.schedules ?? []
        } as RouteDetail;
        
        setFavoriteRoutes((prev) => {
          // If it was removed while fetching, do nothing
          if (!prev.some((r) => r.id === route.id)) return prev;
          
          const next = prev.map(r => r.id === route.id ? fullDetail : r);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } catch (error) {
        console.error("Error fetching route detail for offline favorite:", error);
      }
    }
  }, [favoriteRoutes]);

  const value = React.useMemo(
    () => ({
      favoriteIds: favoriteRoutes.map((r) => r.id),
      favoriteRoutes,
      isFavorite,
      toggleFavorite,
      getFavoriteDetail,
    }),
    [favoriteRoutes, isFavorite, toggleFavorite, getFavoriteDetail]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  }
  return ctx;
}
