import * as SecureStore from "expo-secure-store";
import { campusPreferenceService } from "./campus-preference.service";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

describe("campusPreferenceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no preferred campus is stored", async () => {
    const campusId =
      await campusPreferenceService.getPreferredCampusId("user-1");
    expect(campusId).toBeNull();
  });

  it("saves and retrieves preferred campus for a specific user", async () => {
    await campusPreferenceService.setPreferredCampusId(
      "user-1",
      "campus-centenario",
    );
    const campusId =
      await campusPreferenceService.getPreferredCampusId("user-1");
    expect(campusId).toBe("campus-centenario");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "ups_go.preferred_campus_id.user-1",
      "campus-centenario",
    );
  });

  it("isolates preferences between different users", async () => {
    await campusPreferenceService.setPreferredCampusId("user-a", "campus-a");
    await campusPreferenceService.setPreferredCampusId("user-b", "campus-b");

    expect(await campusPreferenceService.getPreferredCampusId("user-a")).toBe(
      "campus-a",
    );
    expect(await campusPreferenceService.getPreferredCampusId("user-b")).toBe(
      "campus-b",
    );
  });

  it("clears preferred campus for a specific user", async () => {
    await campusPreferenceService.setPreferredCampusId(
      "user-1",
      "campus-centenario",
    );
    await campusPreferenceService.clearPreferredCampusId("user-1");

    expect(
      await campusPreferenceService.getPreferredCampusId("user-1"),
    ).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "ups_go.preferred_campus_id.user-1",
    );
  });

  it("handles empty or whitespace user IDs safely", async () => {
    expect(await campusPreferenceService.getPreferredCampusId("")).toBeNull();
    await campusPreferenceService.setPreferredCampusId("", "campus-1");
    await campusPreferenceService.clearPreferredCampusId("");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
