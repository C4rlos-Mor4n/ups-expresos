import api from "@/api/client";
import { operationalService } from "@/services/operational.service";

jest.mock("@/api/client", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;

const driverAssignment = {
  id: "assignment-1",
  operationalStatus: "ASSIGNED",
  plannedStartAt: "2026-08-29T11:40:00.000Z",
  plannedEndAt: "2026-08-29T12:30:00.000Z",
  departure: {
    id: "departure-1", serviceDate: "2026-08-29", scheduledTime: "06:40:00", direction: "IDA",
    serviceLine: { id: "line-1", code: "NORTE", name: "Ruta Norte", description: null, campus: { id: "campus-1", code: "GYQ", name: "Guayaquil" } },
  },
  vehicle: { id: "vehicle-1", code: "BUS-1", plate: "ABC-1234", capacity: 30 },
  journey: { id: "journey-1", routePath: { id: "path-1", code: "NORTE-IDA", displayName: "Ruta Norte · Ida", direction: "IDA", stops: [] } },
  run: null,
};

describe("operationalService", () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it("uses the student campus and service-line contracts", async () => {
    apiGet.mockResolvedValue({ data: [] });
    await operationalService.getCampuses();
    await operationalService.getServiceLines("campus-1");
    expect(apiGet).toHaveBeenNthCalledWith(1, "/student/campuses");
    expect(apiGet).toHaveBeenNthCalledWith(2, "/student/campuses/campus-1/service-lines");
  });

  it("keeps direction and civil date explicit for student departures", async () => {
    apiGet.mockResolvedValue({ data: [] });
    await operationalService.getDepartures("line-1", "2026-08-29", "IDA");
    expect(apiGet).toHaveBeenCalledWith("/student/service-lines/line-1/departures", { params: { date: "2026-08-29", direction: "IDA" } });
  });

  it("uses only Phase 6 driver operational endpoints", async () => {
    apiGet
      .mockResolvedValueOnce({ data: [driverAssignment] })
      .mockResolvedValueOnce({ data: driverAssignment })
      .mockResolvedValueOnce({ data: null });
    apiPost.mockResolvedValue({ data: driverAssignment });
    await operationalService.getDriverAssignmentsToday();
    await operationalService.getDriverAssignment("assignment-1");
    await operationalService.getCurrentDriverRun();
    await operationalService.startDriverRun("assignment-1");
    await operationalService.finishDriverRun("run-1");
    expect(apiGet).toHaveBeenNthCalledWith(1, "/driver/operational/assignments/today");
    expect(apiGet).toHaveBeenNthCalledWith(2, "/driver/operational/assignments/assignment-1");
    expect(apiGet).toHaveBeenNthCalledWith(3, "/driver/operational/service-runs/current");
    expect(apiPost).toHaveBeenNthCalledWith(1, "/driver/operational/assignments/assignment-1/start");
    expect(apiPost).toHaveBeenNthCalledWith(2, "/driver/operational/service-runs/run-1/finish");
  });

  it("rejects malformed operational payloads before a screen can render them", async () => {
    apiGet.mockResolvedValue({ data: [{ id: "campus-1" }] });
    await expect(operationalService.getCampuses()).rejects.toMatchObject({ name: "OperationalContractError" });
  });
});
