import { isPrivateRoute } from "./routes";

describe("isPrivateRoute (route guard)", () => {
  it("marks tab routes as private", () => {
    expect(isPrivateRoute(["(tabs)", "index"])).toBe(true);
    expect(isPrivateRoute(["(tabs)", "rutas"])).toBe(true);
  });

  it("marks detail routes as private", () => {
    expect(isPrivateRoute(["route", "[id]"])).toBe(true);
    expect(isPrivateRoute(["map", "[id]"])).toBe(true);
    expect(isPrivateRoute(["stop", "[id]"])).toBe(true);
  });

  it("marks public routes as not private", () => {
    expect(isPrivateRoute(["index"])).toBe(false);
    expect(isPrivateRoute(["(auth)", "login"])).toBe(false);
    expect(isPrivateRoute(["(auth)", "otp"])).toBe(false);
  });

  it("handles empty segments safely", () => {
    expect(isPrivateRoute([])).toBe(false);
    expect(isPrivateRoute([undefined])).toBe(false);
  });
});
