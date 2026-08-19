import { authService } from "./auth.service";
import api from "../api/client";

jest.mock("../api/client", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;

describe("authService (auth contract)", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it("requests an OTP code", async () => {
    apiPost.mockResolvedValue({ data: { message: "Verification code sent" } });
    await authService.requestCode("student@est.ups.edu.ec");
    expect(apiPost).toHaveBeenCalledWith("/auth/request-code", { email: "student@est.ups.edu.ec" });
  });

  it("verifies the OTP and returns tokens with a typed user", async () => {
    const user = {
      id: "u1",
      email: "student@est.ups.edu.ec",
      name: null,
      role: "STUDENT" as const,
      emailVerified: true,
      isActive: true,
    };
    apiPost.mockResolvedValue({
      data: { accessToken: "a", refreshToken: "r", user },
    });

    const res = await authService.verifyCode("student@est.ups.edu.ec", "123456");
    expect(apiPost).toHaveBeenCalledWith("/auth/verify-code", {
      email: "student@est.ups.edu.ec",
      code: "123456",
    });
    // el user está tipado como AuthUser (role union), sin `as any`
    expect(res.user.role).toBe("STUDENT");
  });

  it("sends the refresh token body on logout", async () => {
    apiPost.mockResolvedValue({ data: { message: "Logged out" } });
    await authService.logout("refresh-token-value");
    expect(apiPost).toHaveBeenCalledWith("/auth/logout", { refreshToken: "refresh-token-value" });
  });

  it("fetches the current user via /auth/me", async () => {
    apiGet.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: null, role: "STUDENT", emailVerified: true, isActive: true },
    });
    const me = await authService.getMe();
    expect(apiGet).toHaveBeenCalledWith("/auth/me");
    expect(me.id).toBe("u1");
  });
});
