import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  Direction,
  DriverStatus,
  SchedulePublicationStatus,
  ScheduledDepartureSource,
  ServiceAssignmentStatus,
  VehicleStatus,
  Weekday,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { OperationalService } from "./operational.service";

const integrationEnabled = process.env.RUN_GOLDEN_INTEGRATION === "true";
const describeGolden = integrationEnabled ? describe : describe.skip;

const assertIsolatedTestDatabase = (): void => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("Golden integration requires DATABASE_URL");

  const databaseUrl = new URL(rawUrl);
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "");
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    throw new Error("Golden integration requires a local PostgreSQL host");
  }
  if (databaseName === "krionix") {
    throw new Error("Golden integration refuses to run against showcase DB krionix");
  }
};

const civilDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const localTime = (value: string): Date => new Date(`1970-01-01T${value}:00.000Z`);

describeGolden("OperationalService - isolated scheduled departure goldens", () => {
  let prisma: PrismaService;
  let service: OperationalService;

  const campusId = randomUUID();
  const lineIds = [randomUUID(), randomUUID(), randomUUID()];
  const calendarIds = [randomUUID(), randomUUID(), randomUUID()];
  const patternIds: string[] = [];
  const patternDayIds: string[] = [];
  const scheduleTimeIds: string[] = [];
  const journeyIds: string[] = [];
  const pathIds: string[] = [];
  const pathStopIds: string[] = [];
  const stopIds: string[] = [];
  const departureIds: string[] = [];
  const vehicleId = randomUUID();
  const driverId = randomUUID();
  const assignmentId = randomUUID();

  beforeAll(async () => {
    assertIsolatedTestDatabase();
    prisma = new PrismaService();
    service = new OperationalService(prisma, new AuditLogsService(prisma));

    await prisma.$transaction(async (tx) => {
      await tx.campus.create({
        data: {
          id: campusId,
          code: "GOLDEN_OWNER",
          name: "Golden Owner Campus",
        },
      });

      const lineSpecs = [
        {
          id: lineIds[0]!,
          code: "SUR",
          name: "Ruta Sur",
          calendarId: calendarIds[0]!,
          schedules: [
            {
              pathCode: "SUR_WEEKDAY",
              weekday: Weekday.MONDAY,
              dates: ["2026-08-31"],
              names: [
                "Campus Centenario",
                "Quito y Portete",
                "KFC - 17 y Portete",
                "Puerto Azul",
                "Mi Comisariato",
                "María Auxiliadora",
              ],
              offsets: [0, 15, 30, 45, 50, 65],
            },
            {
              pathCode: "SUR_SATURDAY",
              weekday: Weekday.SATURDAY,
              dates: ["2026-09-05"],
              names: [
                "Campus Centenario",
                "Quito y Portete",
                "KFC - 17 y Portete",
                "Puerto Azul",
                "María Auxiliadora",
              ],
              offsets: [0, 15, 30, 45, 60],
            },
          ],
        },
        {
          id: lineIds[1]!,
          code: "NORTE",
          name: "Ruta Norte",
          calendarId: calendarIds[1]!,
          schedules: [
            {
              pathCode: "NORTE_WEEKDAY",
              weekday: Weekday.MONDAY,
              dates: ["2026-08-31"],
              names: ["N1", "N2", "N3", "N4", "N5", "N6"],
              offsets: [0, 7, 25, 40, 45, 60],
            },
          ],
        },
        {
          id: lineIds[2]!,
          code: "URB_LA_JOYA",
          name: "Ruta Urb. La Joya",
          calendarId: calendarIds[2]!,
          schedules: [
            {
              pathCode: "JOYA_WEEKDAY",
              weekday: Weekday.MONDAY,
              dates: ["2026-08-31"],
              names: ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8"],
              offsets: [0, 5, 15, 25, 30, 45, 48, 60],
            },
          ],
        },
      ] as const;

      let weekdaySurDepartureId: string | undefined;
      let weekdaySurJourneyId: string | undefined;

      for (const lineSpec of lineSpecs) {
        await tx.serviceLine.create({
          data: {
            id: lineSpec.id,
            campusId,
            code: lineSpec.code,
            name: lineSpec.name,
          },
        });
        await tx.serviceLineCampus.create({
          data: { serviceLineId: lineSpec.id, campusId },
        });
        await tx.serviceCalendar.create({
          data: {
            id: lineSpec.calendarId,
            serviceLineId: lineSpec.id,
            name: `${lineSpec.code} calendar`,
            validFrom: civilDate("2026-08-30"),
            validUntil: civilDate("2026-09-06"),
            status: SchedulePublicationStatus.PUBLISHED,
          },
        });

        for (const schedule of lineSpec.schedules) {
          const pathId = randomUUID();
          const patternId = randomUUID();
          const patternDayId = randomUUID();
          const scheduleTimeId = randomUUID();
          const journeyId = randomUUID();
          const scheduleStopIds = schedule.names.map(() => randomUUID());
          const schedulePathStopIds = schedule.names.map(() => randomUUID());

          pathIds.push(pathId);
          patternIds.push(patternId);
          patternDayIds.push(patternDayId);
          scheduleTimeIds.push(scheduleTimeId);
          journeyIds.push(journeyId);
          stopIds.push(...scheduleStopIds);
          pathStopIds.push(...schedulePathStopIds);

          await tx.stop.createMany({
            data: schedule.names.map((name, index) => ({
              id: scheduleStopIds[index]!,
              name,
              latitude: -2.1 - index / 100,
              longitude: -79.9 - index / 100,
            })),
          });
          await tx.routePath.create({
            data: {
              id: pathId,
              serviceLineId: lineSpec.id,
              code: schedule.pathCode,
              displayName: schedule.pathCode,
              direction: Direction.IDA,
            },
          });
          await tx.routePathStop.createMany({
            data: schedule.names.map((_, index) => ({
              id: schedulePathStopIds[index]!,
              routePathId: pathId,
              stopId: scheduleStopIds[index]!,
              stopOrder: index + 1,
            })),
          });
          await tx.schedulePattern.create({
            data: {
              id: patternId,
              serviceCalendarId: lineSpec.calendarId,
              direction: Direction.IDA,
              status: SchedulePublicationStatus.PUBLISHED,
            },
          });
          await tx.schedulePatternDay.create({
            data: {
              id: patternDayId,
              schedulePatternId: patternId,
              weekday: schedule.weekday,
            },
          });
          await tx.scheduleTime.create({
            data: {
              id: scheduleTimeId,
              schedulePatternId: patternId,
              departureTime: localTime("06:40"),
            },
          });
          await tx.scheduleJourneyTemplate.create({
            data: { id: journeyId, scheduleTimeId, routePathId: pathId },
          });
          await tx.scheduledStopTime.createMany({
            data: schedule.offsets.map((offsetMinutes, index) => ({
              journeyTemplateId: journeyId,
              routePathStopId: schedulePathStopIds[index]!,
              offsetMinutes,
            })),
          });

          for (const date of schedule.dates) {
            const departureId = randomUUID();
            departureIds.push(departureId);
            await tx.scheduledDeparture.create({
              data: {
                id: departureId,
                sourceScheduleTimeId: scheduleTimeId,
                serviceCalendarId: lineSpec.calendarId,
                serviceLineId: lineSpec.id,
                serviceDate: civilDate(date),
                scheduledTime: localTime("06:40"),
                direction: Direction.IDA,
                source: ScheduledDepartureSource.REGULAR,
              },
            });
            if (lineSpec.code === "SUR" && schedule.weekday === Weekday.MONDAY) {
              weekdaySurDepartureId = departureId;
              weekdaySurJourneyId = journeyId;
            }
          }
        }
      }

      await tx.vehicle.create({
        data: {
          id: vehicleId,
          code: "GOLDEN-BUS",
          plate: "GOLDEN-001",
          capacity: 40,
          status: VehicleStatus.ACTIVE,
        },
      });
      await tx.driver.create({
        data: {
          id: driverId,
          name: "Golden Driver",
          status: DriverStatus.ACTIVE,
        },
      });
      if (!weekdaySurDepartureId || !weekdaySurJourneyId) {
        throw new Error("Golden SUR fixture was not created");
      }
      await tx.serviceAssignment.create({
        data: {
          id: assignmentId,
          scheduledDepartureId: weekdaySurDepartureId,
          vehicleId,
          driverId,
          journeyTemplateId: weekdaySurJourneyId,
          plannedStartAt: new Date("2026-08-31T06:40:00.000Z"),
          plannedEndAt: new Date("2026-08-31T07:45:00.000Z"),
          status: ServiceAssignmentStatus.ASSIGNED,
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.serviceAssignment.deleteMany({ where: { id: assignmentId } });
      await tx.scheduledDeparture.deleteMany({ where: { id: { in: departureIds } } });
      await tx.scheduledStopTime.deleteMany({ where: { journeyTemplateId: { in: journeyIds } } });
      await tx.scheduleJourneyTemplate.deleteMany({ where: { id: { in: journeyIds } } });
      await tx.scheduleTime.deleteMany({ where: { id: { in: scheduleTimeIds } } });
      await tx.schedulePatternDay.deleteMany({ where: { id: { in: patternDayIds } } });
      await tx.schedulePattern.deleteMany({ where: { id: { in: patternIds } } });
      await tx.routePathStop.deleteMany({ where: { id: { in: pathStopIds } } });
      await tx.routePath.deleteMany({ where: { id: { in: pathIds } } });
      await tx.serviceLineCampus.deleteMany({ where: { serviceLineId: { in: lineIds } } });
      await tx.serviceCalendar.deleteMany({ where: { id: { in: calendarIds } } });
      await tx.serviceLine.deleteMany({ where: { id: { in: lineIds } } });
      await tx.stop.deleteMany({ where: { id: { in: stopIds } } });
      await tx.driver.deleteMany({ where: { id: driverId } });
      await tx.vehicle.deleteMany({ where: { id: vehicleId } });
      await tx.campus.deleteMany({ where: { id: campusId } });
    });
    await prisma.$disconnect();
  });

  it("SUR weekday keeps the six-stop 65-minute journey", async () => {
    const line = await prisma.serviceLine.findUniqueOrThrow({ where: { id: lineIds[0] } });
    const departures = await service.getStudentDepartures(line.id, "2026-08-31", "IDA");
    const departure = departures.find((item) => item.scheduledTime.startsWith("06:40"));
    expect(departure).toBeDefined();

    const detail = await service.getStudentDepartureDetail(departure!.id);
    expect(detail.scheduledTime).toBe("06:40:00");
    expect(detail.serviceDate).toBe("2026-08-31");
    expect(detail.journey?.stops).toHaveLength(6);
    expect(detail.journey?.durationMinutes).toBe(65);
    expect(detail.journey?.stops.map((stop) => stop.offsetMinutes)).toEqual([0, 15, 30, 45, 50, 65]);
    expect(detail.journey?.stops.map((stop) => stop.name)).toEqual([
      "Campus Centenario",
      "Quito y Portete",
      "KFC - 17 y Portete",
      "Puerto Azul",
      "Mi Comisariato",
      "María Auxiliadora",
    ]);
  });

  it("SUR Saturday keeps the five-stop 60-minute journey", async () => {
    const line = await prisma.serviceLine.findUniqueOrThrow({ where: { id: lineIds[0] } });
    const departures = await service.getStudentDepartures(line.id, "2026-09-05", "IDA");
    const departure = departures.find((item) => item.scheduledTime.startsWith("06:40"));
    expect(departure).toBeDefined();

    const detail = await service.getStudentDepartureDetail(departure!.id);
    expect(detail.journey?.stops).toHaveLength(5);
    expect(detail.journey?.durationMinutes).toBe(60);
    expect(detail.journey?.stops.map((stop) => stop.offsetMinutes)).toEqual([0, 15, 30, 45, 60]);
    expect(detail.journey?.stops.some((stop) => stop.name.includes("Mi Comisariato"))).toBe(false);
  });

  it.each([
    ["NORTE", 6, 60, [0, 7, 25, 40, 45, 60]],
    ["URB_LA_JOYA", 8, 60, [0, 5, 15, 25, 30, 45, 48, 60]],
  ] as const)("%s weekday preserves its route offsets", async (code, stopCount, duration, offsets) => {
    const line = await prisma.serviceLine.findFirstOrThrow({ where: { code } });
    const departures = await service.getStudentDepartures(line.id, "2026-08-31", "IDA");
    const departure = departures.find((item) => item.scheduledTime.startsWith("06:40"));
    expect(departure).toBeDefined();

    const detail = await service.getStudentDepartureDetail(departure!.id);
    expect(detail.journey?.stops).toHaveLength(stopCount);
    expect(detail.journey?.durationMinutes).toBe(duration);
    expect(detail.journey?.stops.map((stop) => stop.offsetMinutes)).toEqual(offsets);
  });

  it("preserves vehicle and driver relation in the isolated assignment fixture", async () => {
    const assignment = await prisma.serviceAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { vehicle: true, driver: true },
    });
    const detail = await service.getStudentDepartureDetail(assignment.scheduledDepartureId);
    const studentAssignment = detail.assignments.find((item) => item.id === assignment.id);
    expect(studentAssignment?.vehicle.code).toBe(assignment.vehicle.code);
    expect(studentAssignment?.vehicle.plate).toBe(assignment.vehicle.plate);
    expect(studentAssignment?.vehicle.capacity).toBe(assignment.vehicle.capacity);
    expect(studentAssignment?.driverName).toBe(assignment.driver.name);
  });
});
