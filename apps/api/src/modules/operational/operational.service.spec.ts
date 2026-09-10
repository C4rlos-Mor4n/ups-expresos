import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../../database/prisma.service";
import { OperationalService } from "./operational.service";
import { ServiceAssignmentStatus, ServiceRunStatus } from "@prisma/client";

describe("OperationalService - Student Departures State Mapping", () => {
  let service: OperationalService;
  let prismaMock: {
    serviceLine: { findFirst: jest.Mock };
    scheduledDeparture: { findMany: jest.Mock; findFirst: jest.Mock };
  };
  let auditLogsMock: { logAction: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      serviceLine: { findFirst: jest.fn() },
      scheduledDeparture: { findMany: jest.fn(), findFirst: jest.fn() },
    };
    auditLogsMock = { logAction: jest.fn() };
    service = new OperationalService(
      prismaMock as unknown as PrismaService,
      auditLogsMock as unknown as AuditLogsService,
    );
  });

  describe("getStudentDepartures multi-bus aggregate state", () => {
    it("maps mixed states [COMPLETED, ASSIGNED] to ASSIGNED aggregate state", async () => {
      prismaMock.serviceLine.findFirst.mockResolvedValue({ id: "line-1" });
      prismaMock.scheduledDeparture.findMany.mockResolvedValue([
        {
          id: "dep-1",
          serviceDate: new Date("2026-09-01T00:00:00.000Z"),
          scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
          direction: "IDA",
          serviceAssignments: [
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: { status: ServiceRunStatus.COMPLETED },
            },
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: null, // Still assigned / pending
            },
          ],
        },
      ]);

      const result = await service.getStudentDepartures("line-1", "2026-09-01");

      expect(result).toHaveLength(1);
      expect(result[0]?.state).toBe("ASSIGNED");
      expect(result[0]?.assignmentCount).toBe(2);
    });

    it("maps all completed [COMPLETED, COMPLETED] to COMPLETED aggregate state", async () => {
      prismaMock.serviceLine.findFirst.mockResolvedValue({ id: "line-1" });
      prismaMock.scheduledDeparture.findMany.mockResolvedValue([
        {
          id: "dep-1",
          serviceDate: new Date("2026-09-01T00:00:00.000Z"),
          scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
          direction: "IDA",
          serviceAssignments: [
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: { status: ServiceRunStatus.COMPLETED },
            },
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: { status: ServiceRunStatus.COMPLETED },
            },
          ],
        },
      ]);

      const result = await service.getStudentDepartures("line-1", "2026-09-01");

      expect(result[0]?.state).toBe("COMPLETED");
      expect(result[0]?.assignmentCount).toBe(2);
    });

    it("maps any in-progress [IN_PROGRESS, ASSIGNED, COMPLETED] to IN_PROGRESS aggregate state", async () => {
      prismaMock.serviceLine.findFirst.mockResolvedValue({ id: "line-1" });
      prismaMock.scheduledDeparture.findMany.mockResolvedValue([
        {
          id: "dep-1",
          serviceDate: new Date("2026-09-01T00:00:00.000Z"),
          scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
          direction: "IDA",
          serviceAssignments: [
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: { status: ServiceRunStatus.IN_PROGRESS },
            },
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: null,
            },
            {
              status: ServiceAssignmentStatus.ASSIGNED,
              serviceRun: { status: ServiceRunStatus.COMPLETED },
            },
          ],
        },
      ]);

      const result = await service.getStudentDepartures("line-1", "2026-09-01");

      expect(result[0]?.state).toBe("IN_PROGRESS");
      expect(result[0]?.assignmentCount).toBe(3);
    });
  });

  describe("getStudentDepartureDetail multi-bus detail", () => {
    it("maps individual assignment states and correct aggregate state", async () => {
      prismaMock.scheduledDeparture.findFirst.mockResolvedValue({
        id: "dep-1",
        serviceDate: new Date("2026-09-01T00:00:00.000Z"),
        scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
        direction: "IDA",
        serviceLine: {
          id: "line-1",
          code: "SUR",
          name: "Ruta Sur",
          description: null,
          campus: { id: "c-1", code: "CENT", name: "Campus Centenario" },
        },
        serviceAssignments: [
          {
            id: "asg-1",
            status: ServiceAssignmentStatus.ASSIGNED,
            plannedStartAt: new Date("2026-09-01T11:40:00.000Z"),
            plannedEndAt: new Date("2026-09-01T12:40:00.000Z"),
            vehicle: { code: "BUS-01", plate: "GUA-0001", capacity: 30 },
            driver: { id: "d-1", name: "Carlos Morán" },
            journeyTemplate: {
              routePath: {
                id: "rp-1",
                code: "SUR-IDA-1",
                displayName: "Ruta Sur Vía 1",
                direction: "IDA",
                stops: [],
              },
            },
            serviceRun: {
              id: "run-1",
              status: ServiceRunStatus.COMPLETED,
              startedAt: new Date("2026-09-01T11:38:00.000Z"),
              completedAt: new Date("2026-09-01T12:35:00.000Z"),
            },
          },
          {
            id: "asg-2",
            status: ServiceAssignmentStatus.ASSIGNED,
            plannedStartAt: new Date("2026-09-01T11:40:00.000Z"),
            plannedEndAt: new Date("2026-09-01T12:40:00.000Z"),
            vehicle: { code: "BUS-02", plate: "GUA-0002", capacity: 30 },
            driver: { id: "d-2", name: "Mario Silva" },
            journeyTemplate: {
              routePath: {
                id: "rp-2",
                code: "SUR-IDA-2",
                displayName: "Ruta Sur Vía 2",
                direction: "IDA",
                stops: [],
              },
            },
            serviceRun: null, // Still assigned / pending
          },
        ],
      });

      const result = await service.getStudentDepartureDetail("dep-1");

      expect(result.state).toBe("ASSIGNED");
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments[0]?.operationStatus).toBe("COMPLETED");
      expect(result.assignments[1]?.operationStatus).toBe("ASSIGNED");
    });
  });
});
