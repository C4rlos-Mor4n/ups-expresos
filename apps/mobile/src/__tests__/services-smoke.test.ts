import { authService } from "../services/auth.service";
import { mobileService } from "../services/mobile.service";

describe("critical module resolution", () => {
  it("authService exposes the expected methods", () => {
    expect(typeof authService.requestCode).toBe("function");
    expect(typeof authService.verifyCode).toBe("function");
    expect(typeof authService.refreshTokens).toBe("function");
    expect(typeof authService.logout).toBe("function");
  });

  it("mobileService exposes the expected methods", () => {
    expect(typeof mobileService.getRoutes).toBe("function");
    expect(typeof mobileService.getRouteDetail).toBe("function");
    expect(typeof mobileService.getRouteStops).toBe("function");
    expect(typeof mobileService.getRouteSchedules).toBe("function");
    expect(typeof mobileService.getNotices).toBe("function");
  });
});
