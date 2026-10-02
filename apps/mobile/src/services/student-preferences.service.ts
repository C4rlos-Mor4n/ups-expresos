import * as SecureStore from "expo-secure-store";
import type { Direction } from "@/types/operational";

// Preferencias locales del estudiante (solo en el dispositivo, por usuario).
interface StudentPreferences {
  favoriteLineIds: string[];
  /** Parada elegida por línea y sentido: clave `${lineId}:${direction}`. */
  stops: Record<string, string>;
  namePromptDismissed: boolean;
}

const EMPTY: StudentPreferences = {
  favoriteLineIds: [],
  stops: {},
  namePromptDismissed: false,
};

const storageKey = (userId: string) => `ups_go.student_prefs.${userId.trim()}`;
export const stopKey = (lineId: string, direction: Direction) =>
  `${lineId}:${direction}`;

async function read(userId: string): Promise<StudentPreferences> {
  if (!userId?.trim()) return { ...EMPTY };
  try {
    const raw = await SecureStore.getItemAsync(storageKey(userId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<StudentPreferences>;
    return {
      favoriteLineIds: Array.isArray(parsed.favoriteLineIds)
        ? parsed.favoriteLineIds.filter((id): id is string => typeof id === "string")
        : [],
      stops:
        parsed.stops && typeof parsed.stops === "object" ? { ...parsed.stops } : {},
      namePromptDismissed: parsed.namePromptDismissed === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

async function write(userId: string, prefs: StudentPreferences): Promise<void> {
  if (!userId?.trim()) return;
  try {
    await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // Una preferencia que no se guarda no debe romper la pantalla.
  }
}

export const studentPreferencesService = {
  get: read,

  async toggleFavoriteLine(userId: string, lineId: string): Promise<string[]> {
    const prefs = await read(userId);
    const favoriteLineIds = prefs.favoriteLineIds.includes(lineId)
      ? prefs.favoriteLineIds.filter((id) => id !== lineId)
      : [...prefs.favoriteLineIds, lineId];
    await write(userId, { ...prefs, favoriteLineIds });
    return favoriteLineIds;
  },

  async setStop(
    userId: string,
    lineId: string,
    direction: Direction,
    stopId: string | null,
  ): Promise<Record<string, string>> {
    const prefs = await read(userId);
    const stops = { ...prefs.stops };
    if (stopId) stops[stopKey(lineId, direction)] = stopId;
    else delete stops[stopKey(lineId, direction)];
    await write(userId, { ...prefs, stops });
    return stops;
  },

  async dismissNamePrompt(userId: string): Promise<void> {
    const prefs = await read(userId);
    await write(userId, { ...prefs, namePromptDismissed: true });
  },
};
