import { mobileService } from "./mobile.service";
import api from "../api/client";

jest.mock("../api/client", () => ({
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

describe("mobileService pagination contract", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it("getRoutes sends page and limit params", async () => {
    apiGet.mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
    await mobileService.getRoutes({ page: 2, limit: 20 });
    expect(apiGet).toHaveBeenCalledWith("/mobile/routes", { params: { page: 2, limit: 20 } });
  });

  it("getRoutes returns data and meta", async () => {
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    apiGet.mockResolvedValue({ data: { data: [{ id: "route-1" }], meta } });
    const result = await mobileService.getRoutes({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it("getRoutes surfaces currentOperation on each route", async () => {
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    const routeWithOperation = {
      id: "route-1",
      name: "Norte - Salesiana",
      description: null,
      direction: "Norte",
      status: "ACTIVE",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      currentOperation: {
        status: "IN_PROGRESS",
        startedAt: "2026-08-27T12:00:00.000Z",
        tripId: "trip-1",
        driver: { id: "driver-1", name: "Luis Herrera" },
        vehicle: { id: "vehicle-1", plate: "PPN-1234", code: "BUS-001" },
      },
    };
    apiGet.mockResolvedValue({ data: { data: [routeWithOperation], meta } });
    const result = await mobileService.getRoutes({ page: 1, limit: 20 });
    const operation = result.data[0]?.currentOperation;
    expect(operation).not.toBeNull();
    expect(operation?.status).toBe("IN_PROGRESS");
    expect(operation?.driver?.name).toBe("Luis Herrera");
    expect(operation?.vehicle?.plate).toBe("PPN-1234");
  });

  it("getNotices sends page and limit params", async () => {
    apiGet.mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
    await mobileService.getNotices({ page: 3, limit: 20 });
    expect(apiGet).toHaveBeenCalledWith("/mobile/notices", { params: { page: 3, limit: 20 } });
  });
});
