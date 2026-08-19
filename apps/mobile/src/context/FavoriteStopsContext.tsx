import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FavoriteStop } from "../types/stop";

const STORAGE_KEY = "favorite_stops";

interface FavoriteStopsContextType {
  favoriteStops: FavoriteStop[];
  isFavoriteStop: (id: string) => boolean;
  toggleFavoriteStop: (stop: FavoriteStop) => void;
}

const FavoriteStopsContext = createContext<FavoriteStopsContextType | undefined>(undefined);

interface Props {
  readonly children: ReactNode;
}

export function FavoriteStopsProvider({ children }: Props) {
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const parsed: FavoriteStop[] = JSON.parse(json);
          setFavoriteStops(parsed);
        } catch {
          setFavoriteStops([]);
        }
      }
    });
  }, []);

  const isFavoriteStop = useCallback(
    (id: string) => favoriteStops.some((s) => s.id === id),
    [favoriteStops]
  );

  const toggleFavoriteStop = useCallback((stop: FavoriteStop) => {
    setFavoriteStops((prev) => {
      const exists = prev.some((s) => s.id === stop.id);
      const next = exists
        ? prev.filter((s) => s.id !== stop.id)
        : [...prev, { id: stop.id, name: stop.name, reference: stop.reference }];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ favoriteStops, isFavoriteStop, toggleFavoriteStop }),
    [favoriteStops, isFavoriteStop, toggleFavoriteStop]
  );

  return (
    <FavoriteStopsContext.Provider value={value}>
      {children}
    </FavoriteStopsContext.Provider>
  );
}

export function useFavoriteStops() {
  const ctx = useContext(FavoriteStopsContext);
  if (!ctx) {
    throw new Error("useFavoriteStops debe usarse dentro de FavoriteStopsProvider");
  }
  return ctx;
}
