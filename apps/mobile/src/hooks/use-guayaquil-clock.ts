import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getGuayaquilClock, type GuayaquilClock } from "@/utils/schedule";

/**
 * Reloj de Guayaquil que se refresca cada `intervalMs` y al volver la app a primer
 * plano, para que los "en 12 min" no queden congelados.
 */
export function useGuayaquilClock(intervalMs = 30_000): GuayaquilClock {
  const [clock, setClock] = useState(getGuayaquilClock);

  useEffect(() => {
    const tick = () =>
      setClock((previous) => {
        const next = getGuayaquilClock();
        return next.date === previous.date && next.minutes === previous.minutes
          ? previous
          : next;
      });
    const timer = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return clock;
}
