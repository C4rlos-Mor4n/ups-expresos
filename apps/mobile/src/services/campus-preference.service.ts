import * as SecureStore from "expo-secure-store";

function getStorageKey(userId: string): string {
  return `ups_go.preferred_campus_id.${userId.trim()}`;
}

export const campusPreferenceService = {
  async getPreferredCampusId(userId: string): Promise<string | null> {
    if (!userId?.trim()) return null;
    try {
      return await SecureStore.getItemAsync(getStorageKey(userId));
    } catch {
      return null;
    }
  },

  async setPreferredCampusId(userId: string, campusId: string): Promise<void> {
    if (!userId?.trim() || !campusId?.trim()) return;
    try {
      await SecureStore.setItemAsync(getStorageKey(userId), campusId.trim());
    } catch {
      // Silently fail if storage write fails
    }
  },

  async clearPreferredCampusId(userId: string): Promise<void> {
    if (!userId?.trim()) return;
    try {
      await SecureStore.deleteItemAsync(getStorageKey(userId));
    } catch {
      // Silently fail if storage delete fails
    }
  },
};
