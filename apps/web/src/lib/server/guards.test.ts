import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { allowedApiPath } = await import("./guards");

describe("allowedApiPath", () => {
  it("only lets admin endpoints and the current user through", () => {
    expect(allowedApiPath("admin/vehicles")).toBe(true);
    expect(allowedApiPath("auth/me")).toBe(true);
    expect(allowedApiPath("student/campuses")).toBe(false);
    expect(allowedApiPath("auth/refresh")).toBe(false);
    expect(allowedApiPath("integrations/hunter/dataforward")).toBe(false);
    expect(allowedApiPath("admin/../auth/refresh")).toBe(false);
  });
});
