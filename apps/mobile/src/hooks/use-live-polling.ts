import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Consulta periódica de un recurso "en vivo". Respeta el intervalo que sugiere el servidor,
 * se pausa cuando la app pasa a segundo plano y se detiene al desmontar la pantalla.
 * (Polling HTTP en lugar de WebSocket: funciona detrás de ngrok/proxies y basta para buses que
 * reportan cada pocos segundos; ver docs/api/tracking.md.)
 *
 * `fetcher` e `intervalFrom` deben ser estables (useCallback / funciones de módulo).
 */
export function useLivePolling<T>(
  fetcher: (() => Promise<T>) | null,
  intervalFrom: (value: T) => number,
  fallbackSeconds = 15,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!fetcher) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (timer) clearTimeout(timer);
      if (!active) return;
      let next = fallbackSeconds;
      try {
        const value = await fetcher();
        if (!active) return;
        setData(value);
        setError(null);
        next = intervalFrom(value);
      } catch (requestError) {
        if (active) setError(requestError);
      }
      if (active) timer = setTimeout(() => void poll(), next * 1000);
    };

    void poll();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        active = true;
        void poll();
      } else {
        active = false;
        if (timer) clearTimeout(timer);
      }
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [fetcher, intervalFrom, fallbackSeconds]);

  return { data, error };
}
