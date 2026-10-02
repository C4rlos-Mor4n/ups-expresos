import * as SecureStore from "expo-secure-store";
import { studentPreferencesService } from "@/services/student-preferences.service";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    __store: store,
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe("studentPreferencesService", () => {
  beforeEach(() => store.clear());

  it("returns empty preferences for new or corrupted storage", async () => {
    expect(await studentPreferencesService.get("u1")).toEqual({
      favoriteLineIds: [],
      stops: {},
      namePromptDismissed: false,
    });
    store.set("ups_go.student_prefs.u1", "{not json");
    expect((await studentPreferencesService.get("u1")).favoriteLineIds).toEqual([]);
  });

  it("toggles favorite lines per user", async () => {
    expect(await studentPreferencesService.toggleFavoriteLine("u1", "sur")).toEqual(["sur"]);
    expect(await studentPreferencesService.toggleFavoriteLine("u1", "norte")).toEqual([
      "sur",
      "norte",
    ]);
    expect(await studentPreferencesService.toggleFavoriteLine("u1", "sur")).toEqual(["norte"]);
    expect((await studentPreferencesService.get("u2")).favoriteLineIds).toEqual([]);
  });

  it("stores the chosen stop per line and direction, and clears it", async () => {
    await studentPreferencesService.setStop("u1", "sur", "IDA", "kfc");
    await studentPreferencesService.setStop("u1", "sur", "RETORNO", "joya");
    expect((await studentPreferencesService.get("u1")).stops).toEqual({
      "sur:IDA": "kfc",
      "sur:RETORNO": "joya",
    });
    await studentPreferencesService.setStop("u1", "sur", "IDA", null);
    expect((await studentPreferencesService.get("u1")).stops).toEqual({
      "sur:RETORNO": "joya",
    });
  });

  it("remembers that the name prompt was dismissed", async () => {
    await studentPreferencesService.dismissNamePrompt("u1");
    expect((await studentPreferencesService.get("u1")).namePromptDismissed).toBe(true);
  });
});
