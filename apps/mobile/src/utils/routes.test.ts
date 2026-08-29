import { canAccessRoleRoute, getRoleHome, isPrivateRoute } from "./routes";

describe("isPrivateRoute (route guard)", () => {
  it("marks role-aware application routes as private", () => {
    expect(isPrivateRoute(["(student)", "(tabs)", "index"])).toBe(true);
    expect(isPrivateRoute(["(driver)", "(tabs)", "assignments"])).toBe(true);
  });

  it("marks operational detail routes as private", () => {
    expect(isPrivateRoute(["(student)", "scheduled-departure", "[departureId]"])).toBe(true);
    expect(isPrivateRoute(["(driver)", "run", "[runId]"])).toBe(true);
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

  it("resolves only supported roles to their own application area", () => {
    expect(getRoleHome("STUDENT")).toBe("/(student)/(tabs)");
    expect(getRoleHome("DRIVER")).toBe("/(driver)/(tabs)");
    expect(getRoleHome("ADMIN")).toBe("/unsupported-role");
  });

  it("rejects cross-role deep links before a protected screen renders", () => {
    expect(canAccessRoleRoute("STUDENT", ["(student)", "(tabs)"])).toBe(true);
    expect(canAccessRoleRoute("DRIVER", ["(driver)", "(tabs)"])).toBe(true);
    expect(canAccessRoleRoute("DRIVER", ["(student)", "scheduled-departure"])).toBe(false);
    expect(canAccessRoleRoute("STUDENT", ["(driver)", "run"])).toBe(false);
    expect(canAccessRoleRoute("ADMIN", ["unsupported-role"])).toBe(true);
  });
});
