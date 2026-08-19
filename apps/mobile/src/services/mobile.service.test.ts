import { mobileService } from "./mobile.service";
import api from "./api";

jest.mock("./api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const apiGet = api.get as jest.Mock;

describe("mobileService.getRouteDetail (backend contract)", () => {
  const backendResponse = {
    route: {
      id: "route-1",
      name: "Norte - Salesiana",
      description: null,
      direction: "Norte",
      status: "ACTIVE",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    stops: [
      {
        id: "rs-1",
        stopOrder: 1,
        estimatedArrivalMinutes: 15,
        notes: null,
        stop: {
          id: "stop-1",
          name: "Parque de la Madre",
          reference: null,
          latitude: -2.8975,
          longitude: -79.0045,
          isActive: true,
        },
      },
    ],
    schedules: [
      {
        id: "sch-1",
        routeId: "route-1",
        dayOfWeek: "MONDAY",
        direction: "Norte",
        departureTime: "07:30",
        approximateArrivalTime: null,
        status: "ACTIVE",
      },
    ],
  };

  beforeEach(() => {
    apiGet.mockReset();
  });

  it("requests the route detail endpoint", async () => {
    apiGet.mockResolvedValue({ data: backendResponse });
    await mobileService.getRouteDetail("route-1");
    expect(apiGet).toHaveBeenCalledWith("/mobile/routes/route-1");
  });

  it("exposes route, stops and schedules without requiring any", async () => {
    apiGet.mockResolvedValue({ data: backendResponse });
    const result = await mobileService.getRouteDetail("route-1");

    expect(result.route.id).toBe("route-1");
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0].stop.name).toBe("Parque de la Madre");
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].dayOfWeek).toBe("MONDAY");
    // tipos: los campos opcionales/nullables son accesibles con narrowing
    expect(result.route.description).toBeNull();
    expect(result.stops[0].estimatedArrivalMinutes).toBe(15);
  });
});
