import { PrismaService } from "../../database/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { OperationalService } from "./operational.service";

describe("OperationalService - Scheduled Departure Golden & Ambiguity Tests", () => {
  let prisma: PrismaService;
  let service: OperationalService;

  beforeAll(() => {
    prisma = new PrismaService();
    const auditLogs = new AuditLogsService(prisma);
    service = new OperationalService(prisma, auditLogs);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Ambiguity & Multi-bus Journey Mapping Rules (Cases A, B, C, D)", () => {
    it("Case A: 0 assignments + 1 journeyTemplate -> shows the unique programmed journey", () => {
      const mockDeparture = {
        id: "dep-0-1",
        serviceDate: new Date("2026-08-31T12:00:00.000Z"),
        scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
        direction: "IDA" as const,
        serviceLine: {
          id: "line-1",
          code: "SUR",
          name: "Ruta Sur",
          description: null,
          campus: { id: "c-1", code: "MA", name: "Campus MA" },
        },
        sourceScheduleTime: {
          journeyTemplates: [
            {
              routePath: {
                id: "rp-1",
                code: "RP_1",
                displayName: "Ruta Principal",
                direction: "IDA" as const,
                stops: [
                  {
                    stopOrder: 1,
                    stop: {
                      id: "s-1",
                      name: "Parada 1",
                      reference: null,
                      latitude: -2.1,
                      longitude: -79.9,
                    },
                  },
                  {
                    stopOrder: 2,
                    stop: {
                      id: "s-2",
                      name: "Parada 2",
                      reference: null,
                      latitude: -2.2,
                      longitude: -80.0,
                    },
                  },
                ],
              },
              stopTimes: [
                {
                  offsetMinutes: 0,
                  routePathStop: {
                    stopOrder: 1,
                    stop: {
                      id: "s-1",
                      name: "Parada 1",
                      reference: null,
                      latitude: -2.1,
                      longitude: -79.9,
                    },
                  },
                },
                {
                  offsetMinutes: 20,
                  routePathStop: {
                    stopOrder: 2,
                    stop: {
                      id: "s-2",
                      name: "Parada 2",
                      reference: null,
                      latitude: -2.2,
                      longitude: -80.0,
                    },
                  },
                },
              ],
            },
          ],
        },
        serviceAssignments: [],
      };

      const result = service.mapStudentDeparture(mockDeparture);
      expect(result.assignments).toHaveLength(0);
      expect(result.journey).not.toBeNull();
      expect(result.journey!.routePathId).toBe("rp-1");
      expect(result.journey!.durationMinutes).toBe(20);
      expect(result.journey!.stops).toHaveLength(2);
    });

    it("Case B: 0 assignments + 2 journeyTemplates -> journey is null (ambiguous / not determined)", () => {
      const mockDeparture = {
        id: "dep-0-2",
        serviceDate: new Date("2026-08-31T12:00:00.000Z"),
        scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
        direction: "IDA" as const,
        serviceLine: {
          id: "line-1",
          code: "SUR",
          name: "Ruta Sur",
          description: null,
          campus: { id: "c-1", code: "MA", name: "Campus MA" },
        },
        sourceScheduleTime: {
          journeyTemplates: [
            {
              routePath: {
                id: "rp-1",
                code: "RP_1",
                displayName: "Variante A",
                direction: "IDA" as const,
              },
              stopTimes: [],
            },
            {
              routePath: {
                id: "rp-2",
                code: "RP_2",
                displayName: "Variante B",
                direction: "IDA" as const,
              },
              stopTimes: [],
            },
          ],
        },
        serviceAssignments: [],
      };

      const result = service.mapStudentDeparture(mockDeparture);
      expect(result.assignments).toHaveLength(0);
      expect(result.journey).toBeNull();
    });

    it("Case C: 1 assignment -> journey matches the assigned bus journeyTemplate", () => {
      const mockDeparture = {
        id: "dep-1-asg",
        serviceDate: new Date("2026-08-31T12:00:00.000Z"),
        scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
        direction: "IDA" as const,
        serviceLine: {
          id: "line-1",
          code: "SUR",
          name: "Ruta Sur",
          description: null,
          campus: { id: "c-1", code: "MA", name: "Campus MA" },
        },
        sourceScheduleTime: {
          journeyTemplates: [],
        },
        serviceAssignments: [
          {
            id: "asg-1",
            status: "ASSIGNED" as const,
            plannedStartAt: new Date("2026-08-31T06:40:00.000Z"),
            plannedEndAt: new Date("2026-08-31T07:45:00.000Z"),
            vehicle: { code: "BUS-01", plate: "GAA-1001", capacity: 40 },
            driver: { name: "Carlos Perez", user: { name: "Carlos Perez" } },
            serviceRun: null,
            journeyTemplate: {
              id: "jt-asg-1",
              routePath: {
                id: "rp-assigned",
                code: "RP_ASG",
                displayName: "Ruta Asignada Bus 1",
                direction: "IDA" as const,
              },
              stopTimes: [
                {
                  offsetMinutes: 0,
                  routePathStop: {
                    stopOrder: 1,
                    stop: {
                      id: "s-1",
                      name: "Inicio",
                      reference: null,
                      latitude: -2.1,
                      longitude: -79.9,
                    },
                  },
                },
                {
                  offsetMinutes: 45,
                  routePathStop: {
                    stopOrder: 2,
                    stop: {
                      id: "s-2",
                      name: "Fin",
                      reference: null,
                      latitude: -2.2,
                      longitude: -80.0,
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = service.mapStudentDeparture(mockDeparture);
      expect(result.assignments).toHaveLength(1);
      expect(result.journey).not.toBeNull();
      expect(result.journey!.routePathId).toBe("rp-assigned");
      expect(result.journey!.durationMinutes).toBe(45);
    });

    it("Case D: 2 assignments with different journeyTemplates -> each assignment keeps its distinct journey and duration without cross-contamination", () => {
      const mockDeparture = {
        id: "dep-2-asg",
        serviceDate: new Date("2026-08-31T12:00:00.000Z"),
        scheduledTime: new Date("1970-01-01T06:40:00.000Z"),
        direction: "IDA" as const,
        serviceLine: {
          id: "line-1",
          code: "SUR",
          name: "Ruta Sur",
          description: null,
          campus: { id: "c-1", code: "MA", name: "Campus MA" },
        },
        sourceScheduleTime: {
          journeyTemplates: [],
        },
        serviceAssignments: [
          {
            id: "asg-bus-a",
            status: "ASSIGNED" as const,
            plannedStartAt: new Date("2026-08-31T06:40:00.000Z"),
            plannedEndAt: new Date("2026-08-31T07:25:00.000Z"),
            vehicle: { code: "BUS-A", plate: "GAA-1001", capacity: 40 },
            driver: { name: "Driver A", user: { name: "Driver A" } },
            serviceRun: null,
            journeyTemplate: {
              id: "jt-a",
              routePath: {
                id: "rp-a",
                code: "RP_A",
                displayName: "Recorrido Rápido A",
                direction: "IDA" as const,
              },
              stopTimes: [
                {
                  offsetMinutes: 0,
                  routePathStop: {
                    stopOrder: 1,
                    stop: {
                      id: "s-1",
                      name: "P1",
                      reference: null,
                      latitude: -2.1,
                      longitude: -79.9,
                    },
                  },
                },
                {
                  offsetMinutes: 45,
                  routePathStop: {
                    stopOrder: 2,
                    stop: {
                      id: "s-2",
                      name: "P2",
                      reference: null,
                      latitude: -2.2,
                      longitude: -80.0,
                    },
                  },
                },
              ],
            },
          },
          {
            id: "asg-bus-b",
            status: "ASSIGNED" as const,
            plannedStartAt: new Date("2026-08-31T06:40:00.000Z"),
            plannedEndAt: new Date("2026-08-31T07:45:00.000Z"),
            vehicle: { code: "BUS-B", plate: "GAA-1002", capacity: 50 },
            driver: { name: "Driver B", user: { name: "Driver B" } },
            serviceRun: null,
            journeyTemplate: {
              id: "jt-b",
              routePath: {
                id: "rp-b",
                code: "RP_B",
                displayName: "Recorrido Extendido B",
                direction: "IDA" as const,
              },
              stopTimes: [
                {
                  offsetMinutes: 0,
                  routePathStop: {
                    stopOrder: 1,
                    stop: {
                      id: "s-1",
                      name: "P1",
                      reference: null,
                      latitude: -2.1,
                      longitude: -79.9,
                    },
                  },
                },
                {
                  offsetMinutes: 30,
                  routePathStop: {
                    stopOrder: 2,
                    stop: {
                      id: "s-inter",
                      name: "P Intermedia",
                      reference: null,
                      latitude: -2.15,
                      longitude: -79.95,
                    },
                  },
                },
                {
                  offsetMinutes: 65,
                  routePathStop: {
                    stopOrder: 3,
                    stop: {
                      id: "s-3",
                      name: "P3",
                      reference: null,
                      latitude: -2.25,
                      longitude: -80.05,
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = service.mapStudentDeparture(mockDeparture);
      expect(result.assignments).toHaveLength(2);

      // Bus A assertions
      const busA = result.assignments[0];
      expect(busA?.vehicle.code).toBe("BUS-A");
      expect(busA?.journey?.routePathId).toBe("rp-a");
      expect(busA?.journey?.durationMinutes).toBe(45);
      expect(busA?.journey?.stops).toHaveLength(2);

      // Bus B assertions
      const busB = result.assignments[1];
      expect(busB?.vehicle.code).toBe("BUS-B");
      expect(busB?.journey?.routePathId).toBe("rp-b");
      expect(busB?.journey?.durationMinutes).toBe(65);
      expect(busB?.journey?.stops).toHaveLength(3);
    });

    it("StopOrder preservation: when two stops have the exact same offsetMinutes, sequence strictly preserves stopOrder", () => {
      const mockTemplate = {
        routePath: {
          id: "rp-tied-offsets",
          code: "RP_TIED",
          displayName: "Ruta Paradas Cercanas",
          direction: "IDA" as const,
        },
        stopTimes: [
          {
            offsetMinutes: 10,
            routePathStop: {
              stopOrder: 2,
              stop: {
                id: "s-2",
                name: "Segunda Parada",
                reference: null,
                latitude: -2.12,
                longitude: -79.91,
              },
            },
          },
          {
            offsetMinutes: 10,
            routePathStop: {
              stopOrder: 1,
              stop: {
                id: "s-1",
                name: "Primera Parada",
                reference: null,
                latitude: -2.11,
                longitude: -79.9,
              },
            },
          },
          {
            offsetMinutes: 25,
            routePathStop: {
              stopOrder: 3,
              stop: {
                id: "s-3",
                name: "Tercera Parada",
                reference: null,
                latitude: -2.15,
                longitude: -79.95,
              },
            },
          },
        ],
      };

      const mapped = service.mapJourneyFromTemplate(mockTemplate);
      expect(mapped).not.toBeNull();
      expect(mapped!.stops).toHaveLength(3);
      expect(mapped!.stops[0]?.order).toBe(1);
      expect(mapped!.stops[0]?.id).toBe("s-1");
      expect(mapped!.stops[1]?.order).toBe(2);
      expect(mapped!.stops[1]?.id).toBe("s-2");
      expect(mapped!.stops[2]?.order).toBe(3);
      expect(mapped!.stops[2]?.id).toBe("s-3");
    });
  });
});
