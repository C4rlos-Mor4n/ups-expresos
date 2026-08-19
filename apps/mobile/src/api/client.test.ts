import api, { API_BASE_URL, setOnSessionExpired, setOnTokensRotated, validateApiUrl } from "./client";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

// Adaptador mock: permite ejercitar los interceptores sin red real.
function useMockAdapter(handler: (config: any) => Promise<{ data: unknown; status: number }>) {
  api.defaults.adapter = (async (config: any) => {
    try {
      const result = await handler(config);
      return {
        data: result.data,
        status: result.status,
        statusText: "OK",
        headers: {},
        config,
      } as any;
    } catch (e) {
      const err = e as any;
      return Promise.reject({
        config,
        response: { status: err.status ?? 500, data: err.data },
        isAxiosError: true,
      });
    }
  }) as any;
}

describe("HTTP client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockDeleteItem.mockReset();
  });

  it("exposes the configured API base URL", () => {
    expect(API_BASE_URL).toBe(process.env.EXPO_PUBLIC_API_URL);
  });

  it("injects the Bearer token from SecureStore", async () => {
    mockGetItem.mockResolvedValue("the-access-token");
    useMockAdapter(async (config) => {
      expect(config.headers.Authorization).toBe("Bearer the-access-token");
      return { data: { ok: true }, status: 200 };
    });

    await api.get("/mobile/routes");
  });

  it("does not add Authorization when there is no token", async () => {
    mockGetItem.mockResolvedValue(null);
    useMockAdapter(async (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return { data: { ok: true }, status: 200 };
    });
    await api.get("/mobile/routes");
  });

  it("refreshes once and retries the original request on 401", async () => {
    mockGetItem
      .mockResolvedValueOnce("expired-token") // request interceptor (original)
      .mockResolvedValueOnce("refresh-token") // refreshAccessToken
      .mockResolvedValueOnce("new-token"); // request interceptor (retry)

    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "new-token", refreshToken: "new-refresh-token" },
    } as any);

    let calls = 0;
    useMockAdapter(async (config) => {
      calls += 1;
      if (calls === 1) throw { status: 401, data: { message: "Unauthorized" } };
      expect(config.headers.Authorization).toBe("Bearer new-token");
      return { data: { ok: true }, status: 200 };
    });

    const res = await api.get("/mobile/routes");
    expect(res.data).toEqual({ ok: true });
    expect(postSpy).toHaveBeenCalledTimes(1);
    // La rotación persiste tanto el nuevo access como el nuevo refresh token.
    expect(mockSetItem).toHaveBeenCalledWith("access_token", "new-token");
    expect(mockSetItem).toHaveBeenCalledWith("refresh_token", "new-refresh-token");
    postSpy.mockRestore();
  });

  it("notifies AuthContext of the rotated tokens so React state stays in sync", async () => {
    mockGetItem
      .mockResolvedValueOnce("expired-token") // request interceptor (original)
      .mockResolvedValueOnce("refresh-token") // refreshAccessToken
      .mockResolvedValueOnce("new-token"); // request interceptor (retry)

    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "new-token", refreshToken: "new-refresh-token" },
    } as any);

    const onRotated = jest.fn();
    setOnTokensRotated(onRotated);

    let calls = 0;
    useMockAdapter(async () => {
      calls += 1;
      if (calls === 1) throw { status: 401, data: { message: "Unauthorized" } };
      return { data: { ok: true }, status: 200 };
    });

    await api.get("/mobile/routes");
    expect(onRotated).toHaveBeenCalledWith("new-token", "new-refresh-token");
    setOnTokensRotated(null);
    postSpy.mockRestore();
  });

  it("clears the session and notifies when refresh fails", async () => {
    mockGetItem
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce(null); // refreshAccessToken: no refresh token

    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);

    useMockAdapter(async () => {
      throw { status: 401, data: { message: "Unauthorized" } };
    });

    await expect(api.get("/mobile/routes")).rejects.toBeTruthy();
    expect(mockDeleteItem).toHaveBeenCalledWith("access_token");
    expect(mockDeleteItem).toHaveBeenCalledWith("refresh_token");
    expect(mockDeleteItem).toHaveBeenCalledWith("user");
    expect(onExpired).toHaveBeenCalled();
  });

  it("shares a single in-flight refresh across simultaneous 401s", async () => {
    // Primer request: access token. refreshAccessToken: refresh token.
    mockGetItem
      .mockResolvedValueOnce("expired-token") // request interceptor (req A)
      .mockResolvedValueOnce("expired-token") // request interceptor (req B)
      .mockResolvedValueOnce("refresh-token") // refreshAccessToken (single)
      .mockResolvedValueOnce("new-token") // retry interceptor (A)
      .mockResolvedValueOnce("new-token"); // retry interceptor (B)

    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "new-token", refreshToken: "new-refresh-token" },
    } as any);

    let calls = 0;
    useMockAdapter(async (config) => {
      calls += 1;
      if (calls <= 2) throw { status: 401, data: { message: "Unauthorized" } };
      expect(config.headers.Authorization).toBe("Bearer new-token");
      return { data: { ok: true }, status: 200 };
    });

    const [resA, resB] = await Promise.all([
      api.get("/mobile/routes"),
      api.get("/mobile/routes"),
    ]);

    expect(resA.data).toEqual({ ok: true });
    expect(resB.data).toEqual({ ok: true });
    // Solo un refresh compartido para ambos 401 simultáneos.
    expect(postSpy).toHaveBeenCalledTimes(1);
    postSpy.mockRestore();
  });

  it("handles network errors without a response", async () => {
    useMockAdapter(async () => {
      throw { isAxiosError: true, message: "Network Error" };
    });
    await expect(api.get("/mobile/routes")).rejects.toBeTruthy();
  });
});
