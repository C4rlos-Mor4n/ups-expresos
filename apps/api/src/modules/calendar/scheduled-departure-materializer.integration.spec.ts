import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  Direction,
  Prisma,
  SchedulePatternType,
  SchedulePublicationStatus,
  ScheduledDepartureSource,
  ServiceExceptionEffect,
  ServiceExceptionReason,
  ServiceExceptionStatus,
  Weekday,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CalendarRepository } from "./calendar.repository";
import { CalendarResolverService } from "./calendar-resolver.service";
import { ScheduledDepartureMaterializerService } from "./scheduled-departure-materializer.service";
import { ScheduledDepartureWriteInput } from "./scheduled-departure-materializer.types";
import { ScheduledDepartureRepository } from "./scheduled-departure.repository";

const integrationEnabled =
  process.env.RUN_SCHEDULED_DEPARTURE_MATERIALIZER_INTEGRATION === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;

const civilDate = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00.000Z`);

const localTime = (hours: number, minutes: number): Date =>
  new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));

const isoTime = (value: Date): string => value.toISOString().slice(11, 19);

const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2003";

describeIntegration(
  "ScheduledDeparture materializer PostgreSQL integration",
  () => {
    const prisma = new PrismaService();
    const calendarRepository = new CalendarRepository(prisma);
    const resolver = new CalendarResolverService(calendarRepository);
    const scheduledDepartureRepository = new ScheduledDepartureRepository(
      prisma,
    );
    const materializer = new ScheduledDepartureMaterializerService(
      resolver,
      scheduledDepartureRepository,
    );

    const campusId = randomUUID();
    const serviceLineId = randomUUID();
    const divergentServiceLineId = randomUUID();
    const calendarId = randomUUID();
    const regularPatternId = randomUUID();
    const addPatternId = randomUUID();
    const replacePatternId = randomUUID();
    const stalePatternId = randomUUID();
    const regularPatternDayIds = [randomUUID(), randomUUID(), randomUUID()];
    const regularScheduleTimeId = randomUUID();
    const addScheduleTimeId = randomUUID();
    const replaceScheduleTimeId = randomUUID();
    const staleScheduleTimeId = randomUUID();
    const addExceptionId = randomUUID();
    const replaceExceptionId = randomUUID();
    const noServiceExceptionId = randomUUID();
    const pathAId = randomUUID();
    const pathBId = randomUUID();
    const stopIds = [randomUUID(), randomUUID(), randomUUID()];
    const pathAStopIds = [randomUUID(), randomUUID(), randomUUID()];
    const pathBStopIds = [randomUUID(), randomUUID(), randomUUID()];
    const journeyFixtures = [
      {
        id: randomUUID(),
        scheduleTimeId: regularScheduleTimeId,
        routePathId: pathAId,
        routePathStopIds: pathAStopIds,
        scheduledStopTimeIds: [randomUUID(), randomUUID(), randomUUID()],
      },
      {
        id: randomUUID(),
        scheduleTimeId: regularScheduleTimeId,
        routePathId: pathBId,
        routePathStopIds: pathBStopIds,
        scheduledStopTimeIds: [randomUUID(), randomUUID(), randomUUID()],
      },
      {
        id: randomUUID(),
        scheduleTimeId: addScheduleTimeId,
        routePathId: pathAId,
        routePathStopIds: pathAStopIds,
        scheduledStopTimeIds: [randomUUID(), randomUUID(), randomUUID()],
      },
      {
        id: randomUUID(),
        scheduleTimeId: replaceScheduleTimeId,
        routePathId: pathBId,
        routePathStopIds: pathBStopIds,
        scheduledStopTimeIds: [randomUUID(), randomUUID(), randomUUID()],
      },
    ];
    const fixtureSourceScheduleTimeIds = [
      regularScheduleTimeId,
      addScheduleTimeId,
      replaceScheduleTimeId,
      staleScheduleTimeId,
    ];
    const journeyIds = journeyFixtures.map((journey) => journey.id);
    const scheduledStopTimeIds = journeyFixtures.flatMap(
      (journey) => journey.scheduledStopTimeIds,
    );

    const materialize = (serviceDate: string) =>
      materializer.materialize({
        serviceLineId,
        direction: Direction.IDA,
        fromDate: serviceDate,
      });

    const deleteFixtureDepartures = async (): Promise<void> => {
      await prisma.scheduledDeparture.deleteMany({
        where: { sourceScheduleTimeId: { in: fixtureSourceScheduleTimeIds } },
      });
    };

    const departuresFor = async (serviceDate: string) =>
      prisma.scheduledDeparture.findMany({
        where: {
          serviceDate: civilDate(serviceDate),
          sourceScheduleTimeId: { in: fixtureSourceScheduleTimeIds },
        },
        orderBy: [{ scheduledTime: "asc" }, { sourceScheduleTimeId: "asc" }],
      });

    const directWrite = (
      sourceScheduleTimeId: string,
      serviceDate: string,
      scheduledTime: string,
    ): ScheduledDepartureWriteInput => {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      if (hours === undefined || minutes === undefined) {
        throw new Error("Test fixture has an invalid scheduled time");
      }

      return {
        sourceScheduleTimeId,
        serviceCalendarId: calendarId,
        serviceLineId,
        serviceDate,
        scheduledTime: `${scheduledTime}:00`,
        scheduledTimeValue: localTime(hours, minutes),
        direction: Direction.IDA,
        source: ScheduledDepartureSource.REGULAR,
        sourceExceptionId: null,
      };
    };

    beforeAll(async () => {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "ScheduledDeparture materializer integration must not run against production",
        );
      }

      await prisma.$connect();
      await prisma.$transaction(async (tx) => {
        await tx.campus.create({
          data: {
            id: campusId,
            code: `TEST-5CB-${campusId.slice(0, 8)}`,
            name: "5C-B synthetic campus",
          },
        });
        await tx.serviceLine.create({
          data: {
            id: serviceLineId,
            campusId,
            code: `TEST-5CB-LINE-${serviceLineId.slice(0, 8)}`,
            name: "5C-B synthetic service line",
          },
        });
        await tx.serviceLine.create({
          data: {
            id: divergentServiceLineId,
            campusId,
            code: `TEST-5CB-DIVERGENT-${divergentServiceLineId.slice(0, 8)}`,
            name: "5C-B divergent synthetic service line",
          },
        });
        await tx.serviceCalendar.create({
          data: {
            id: calendarId,
            serviceLineId,
            name: "5C-B materializer calendar",
            validFrom: civilDate("2026-09-01"),
            validUntil: civilDate("2026-09-30"),
            timezone: "America/Guayaquil",
            status: SchedulePublicationStatus.PUBLISHED,
          },
        });
        await tx.serviceException.createMany({
          data: [
            {
              id: addExceptionId,
              serviceCalendarId: calendarId,
              serviceDate: civilDate("2026-09-01"),
              direction: Direction.IDA,
              reason: ServiceExceptionReason.EXAM_PERIOD,
              effect: ServiceExceptionEffect.ADD_TIMES,
              status: ServiceExceptionStatus.PUBLISHED,
              description: "5C-B add-times synthetic exception",
            },
            {
              id: replaceExceptionId,
              serviceCalendarId: calendarId,
              serviceDate: civilDate("2026-09-02"),
              direction: Direction.IDA,
              reason: ServiceExceptionReason.EXAM_PERIOD,
              effect: ServiceExceptionEffect.REPLACE_TIMES,
              status: ServiceExceptionStatus.PUBLISHED,
              description: "5C-B replace-times synthetic exception",
            },
            {
              id: noServiceExceptionId,
              serviceCalendarId: calendarId,
              serviceDate: civilDate("2026-09-03"),
              direction: Direction.IDA,
              reason: ServiceExceptionReason.HOLIDAY,
              effect: ServiceExceptionEffect.NO_SERVICE,
              status: ServiceExceptionStatus.PUBLISHED,
              description: "5C-B no-service synthetic exception",
            },
          ],
        });
        await tx.schedulePattern.createMany({
          data: [
            {
              id: regularPatternId,
              serviceCalendarId: calendarId,
              direction: Direction.IDA,
              type: SchedulePatternType.EXPLICIT_TIMES,
              status: SchedulePublicationStatus.PUBLISHED,
              name: "Regular Tue-Wed-Thu",
            },
            {
              id: addPatternId,
              serviceCalendarId: calendarId,
              direction: Direction.IDA,
              type: SchedulePatternType.EXPLICIT_TIMES,
              status: SchedulePublicationStatus.PUBLISHED,
              exceptionId: addExceptionId,
              name: "Add times Sep 1",
            },
            {
              id: replacePatternId,
              serviceCalendarId: calendarId,
              direction: Direction.IDA,
              type: SchedulePatternType.EXPLICIT_TIMES,
              status: SchedulePublicationStatus.PUBLISHED,
              exceptionId: replaceExceptionId,
              name: "Replace times Sep 2",
            },
            {
              id: stalePatternId,
              serviceCalendarId: calendarId,
              direction: Direction.IDA,
              type: SchedulePatternType.EXPLICIT_TIMES,
              status: SchedulePublicationStatus.DRAFT,
              name: "Draft stale source",
            },
          ],
        });
        await tx.schedulePatternDay.createMany({
          data: [
            {
              id: regularPatternDayIds[0]!,
              schedulePatternId: regularPatternId,
              weekday: Weekday.TUESDAY,
            },
            {
              id: regularPatternDayIds[1]!,
              schedulePatternId: regularPatternId,
              weekday: Weekday.WEDNESDAY,
            },
            {
              id: regularPatternDayIds[2]!,
              schedulePatternId: regularPatternId,
              weekday: Weekday.THURSDAY,
            },
          ],
        });
        await tx.scheduleTime.createMany({
          data: [
            {
              id: regularScheduleTimeId,
              schedulePatternId: regularPatternId,
              departureTime: localTime(6, 40),
              approximateArrivalTime: localTime(7, 20),
            },
            {
              id: addScheduleTimeId,
              schedulePatternId: addPatternId,
              departureTime: localTime(6, 40),
              approximateArrivalTime: localTime(7, 20),
            },
            {
              id: replaceScheduleTimeId,
              schedulePatternId: replacePatternId,
              departureTime: localTime(9, 10),
              approximateArrivalTime: localTime(9, 50),
            },
            {
              id: staleScheduleTimeId,
              schedulePatternId: stalePatternId,
              departureTime: localTime(13, 15),
              approximateArrivalTime: localTime(13, 55),
            },
          ],
        });

        for (const [index, id] of stopIds.entries()) {
          await tx.stop.create({
            data: {
              id,
              name: `5C-B synthetic stop ${index + 1}`,
              latitude: 0,
              longitude: 0,
            },
          });
        }
        await tx.routePath.createMany({
          data: [
            {
              id: pathAId,
              serviceLineId,
              code: `TEST-5CB-A-${pathAId.slice(0, 8)}`,
              displayName: "5C-B path A",
              direction: Direction.IDA,
            },
            {
              id: pathBId,
              serviceLineId,
              code: `TEST-5CB-B-${pathBId.slice(0, 8)}`,
              displayName: "5C-B path B",
              direction: Direction.IDA,
            },
          ],
        });
        for (const [pathId, routePathStopIds] of [
          [pathAId, pathAStopIds],
          [pathBId, pathBStopIds],
        ] as const) {
          for (const [index, id] of routePathStopIds.entries()) {
            const stopId = stopIds[index];
            if (!stopId)
              throw new Error("Missing synthetic stop for route path stop");
            await tx.routePathStop.create({
              data: { id, routePathId: pathId, stopId, stopOrder: index + 1 },
            });
          }
        }
        for (const journey of journeyFixtures) {
          await tx.scheduleJourneyTemplate.create({
            data: {
              id: journey.id,
              scheduleTimeId: journey.scheduleTimeId,
              routePathId: journey.routePathId,
            },
          });
          for (const [index, id] of journey.scheduledStopTimeIds.entries()) {
            const routePathStopId = journey.routePathStopIds[index];
            if (!routePathStopId)
              throw new Error("Missing synthetic route path stop for journey");
            await tx.scheduledStopTime.create({
              data: {
                id,
                journeyTemplateId: journey.id,
                routePathStopId,
                offsetMinutes: index * 10,
              },
            });
          }
        }
      });
    });

    beforeEach(async () => {
      await deleteFixtureDepartures();
      await prisma.scheduleTime.update({
        where: { id: regularScheduleTimeId },
        data: { departureTime: localTime(6, 40) },
      });
    });

    afterAll(async () => {
      try {
        await deleteFixtureDepartures();
        expect(
          await prisma.scheduledDeparture.count({
            where: {
              sourceScheduleTimeId: { in: fixtureSourceScheduleTimeIds },
            },
          }),
        ).toBe(0);

        await prisma.$transaction(async (tx) => {
          await tx.scheduledStopTime.deleteMany({
            where: { id: { in: scheduledStopTimeIds } },
          });
          await tx.scheduleJourneyTemplate.deleteMany({
            where: { id: { in: journeyIds } },
          });
          await tx.scheduleTime.deleteMany({
            where: { id: { in: fixtureSourceScheduleTimeIds } },
          });
          await tx.schedulePatternDay.deleteMany({
            where: { id: { in: regularPatternDayIds } },
          });
          await tx.schedulePattern.deleteMany({
            where: {
              id: {
                in: [
                  regularPatternId,
                  addPatternId,
                  replacePatternId,
                  stalePatternId,
                ],
              },
            },
          });
          await tx.serviceException.deleteMany({
            where: {
              id: {
                in: [addExceptionId, replaceExceptionId, noServiceExceptionId],
              },
            },
          });
          await tx.routePathStop.deleteMany({
            where: { id: { in: [...pathAStopIds, ...pathBStopIds] } },
          });
          await tx.routePath.deleteMany({
            where: { id: { in: [pathAId, pathBId] } },
          });
          await tx.stop.deleteMany({ where: { id: { in: stopIds } } });
          await tx.serviceCalendar.deleteMany({ where: { id: calendarId } });
          await tx.serviceLine.deleteMany({
            where: { id: { in: [serviceLineId, divergentServiceLineId] } },
          });
          await tx.campus.deleteMany({ where: { id: campusId } });
        });
      } finally {
        await prisma.$disconnect();
      }
    });

    it("materializes regular and ADD_TIMES departures with nominal collisions and one row per departure", async () => {
      const resolved = await resolver.resolveSchedule({
        serviceLineId,
        direction: Direction.IDA,
        serviceDate: "2026-09-01",
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error(resolved.error.message);

      const regular = resolved.value.departures.find(
        (departure) => departure.scheduleTimeId === regularScheduleTimeId,
      );
      expect(regular?.journeys).toHaveLength(2);
      expect(resolved.value.departures).toHaveLength(2);

      const result = await materialize("2026-09-01");
      expect(result).toMatchObject({ created: 2, existingSame: 0, errors: 0 });
      expect(result.dates[0]).toMatchObject({
        outcome: "MATERIALIZED",
        resolution: "ADD_TIMES",
        resolvedCount: 2,
        createdCount: 2,
      });

      const rows = await departuresFor("2026-09-01");
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.sourceScheduleTimeId).sort()).toEqual(
        [regularScheduleTimeId, addScheduleTimeId].sort(),
      );
      expect(rows.map((row) => isoTime(row.scheduledTime))).toEqual([
        "06:40:00",
        "06:40:00",
      ]);
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceScheduleTimeId: regularScheduleTimeId,
            source: ScheduledDepartureSource.REGULAR,
            sourceExceptionId: null,
          }),
          expect.objectContaining({
            sourceScheduleTimeId: addScheduleTimeId,
            source: ScheduledDepartureSource.EXCEPTION_ADD,
            sourceExceptionId: addExceptionId,
          }),
        ]),
      );
    });

    it("maps REPLACE_TIMES provenance exactly", async () => {
      const result = await materialize("2026-09-02");

      expect(result).toMatchObject({ created: 1, errors: 0 });
      expect(result.dates[0]).toMatchObject({
        outcome: "MATERIALIZED",
        resolution: "REPLACE_TIMES",
        resolvedCount: 1,
      });

      const rows = await departuresFor("2026-09-02");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sourceScheduleTimeId: replaceScheduleTimeId,
        source: ScheduledDepartureSource.EXCEPTION_REPLACE,
        sourceExceptionId: replaceExceptionId,
      });
      expect(isoTime(rows[0]!.scheduledTime)).toBe("09:10:00");
    });

    it("does not write departures for NO_SERVICE", async () => {
      const result = await materialize("2026-09-03");

      expect(result).toMatchObject({
        created: 0,
        noServiceDates: 1,
        errors: 0,
      });
      expect(result.dates[0]).toMatchObject({
        outcome: "NO_SERVICE",
        serviceAvailable: false,
        resolution: "NO_SERVICE",
        resolvedCount: 0,
      });
      expect(await departuresFor("2026-09-03")).toHaveLength(0);
    });

    it("reports a historical NO_SERVICE departure for reconciliation without mutating it", async () => {
      await prisma.scheduledDeparture.create({
        data: {
          sourceScheduleTimeId: regularScheduleTimeId,
          serviceCalendarId: calendarId,
          serviceLineId,
          serviceDate: civilDate("2026-09-03"),
          scheduledTime: localTime(6, 40),
          direction: Direction.IDA,
          source: ScheduledDepartureSource.REGULAR,
        },
      });

      const result = await materialize("2026-09-03");
      const date = result.dates[0];
      expect(result).toMatchObject({
        created: 0,
        noServiceDates: 1,
        errors: 0,
      });
      expect(date).toMatchObject({
        outcome: "RECONCILIATION_REQUIRED",
        serviceAvailable: false,
        resolution: "NO_SERVICE",
      });
      expect(date?.missingFromCurrentResolution).toEqual([
        expect.objectContaining({
          sourceScheduleTimeId: regularScheduleTimeId,
        }),
      ]);
      expect(
        await prisma.scheduledDeparture.findFirst({
          where: {
            sourceScheduleTimeId: regularScheduleTimeId,
            serviceDate: civilDate("2026-09-03"),
          },
        }),
      ).toMatchObject({
        serviceLineId,
        direction: Direction.IDA,
        source: ScheduledDepartureSource.REGULAR,
      });
    });

    it("is idempotent for one, two and ten materializations of the same date", async () => {
      const first = await materialize("2026-09-01");
      const second = await materialize("2026-09-01");
      const repeated = [];
      for (let index = 0; index < 10; index += 1) {
        repeated.push(await materialize("2026-09-01"));
      }

      expect(first).toMatchObject({ created: 2, existingSame: 0 });
      expect(second).toMatchObject({ created: 0, existingSame: 2 });
      for (const result of repeated) {
        expect(result).toMatchObject({
          created: 0,
          existingSame: 2,
          errors: 0,
        });
      }
      expect(await departuresFor("2026-09-01")).toHaveLength(2);
    });

    it("materializes concurrently without exposing P2002 and keeps the natural-identity count", async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => materialize("2026-09-01")),
      );

      expect(results).toHaveLength(4);
      expect(results.reduce((total, result) => total + result.created, 0)).toBe(
        2,
      );
      for (const result of results) {
        expect(result).toMatchObject({ errors: 0, existingDifferent: 0 });
        expect(result.dates[0]?.outcome).toBe("MATERIALIZED");
      }
      expect(await departuresFor("2026-09-01")).toHaveLength(2);
    });

    it("preserves a scheduled-time snapshot and reports existing differences without updating", async () => {
      await materialize("2026-09-01");
      await prisma.scheduleTime.update({
        where: { id: regularScheduleTimeId },
        data: { departureTime: localTime(7, 0) },
      });

      try {
        const result = await materialize("2026-09-01");
        const date = result.dates[0];
        expect(date).toMatchObject({
          outcome: "RECONCILIATION_REQUIRED",
          createdCount: 0,
        });
        expect(date?.existingDifferent).toEqual([
          expect.objectContaining({
            sourceScheduleTimeId: regularScheduleTimeId,
            fields: ["scheduledTime"],
          }),
        ]);

        const regularSnapshot =
          await prisma.scheduledDeparture.findFirstOrThrow({
            where: {
              sourceScheduleTimeId: regularScheduleTimeId,
              serviceDate: civilDate("2026-09-01"),
            },
          });
        expect(isoTime(regularSnapshot.scheduledTime)).toBe("06:40:00");
      } finally {
        await prisma.scheduleTime.update({
          where: { id: regularScheduleTimeId },
          data: { departureTime: localTime(6, 40) },
        });
      }
    });

    it("reports a natural-identity row with divergent line and direction without updating it", async () => {
      await prisma.scheduledDeparture.createMany({
        data: [
          {
            sourceScheduleTimeId: regularScheduleTimeId,
            serviceCalendarId: calendarId,
            serviceLineId: divergentServiceLineId,
            serviceDate: civilDate("2026-09-01"),
            scheduledTime: localTime(6, 40),
            direction: Direction.RETORNO,
            source: ScheduledDepartureSource.REGULAR,
          },
          {
            sourceScheduleTimeId: addScheduleTimeId,
            serviceCalendarId: calendarId,
            serviceLineId,
            serviceDate: civilDate("2026-09-01"),
            scheduledTime: localTime(6, 40),
            direction: Direction.IDA,
            source: ScheduledDepartureSource.EXCEPTION_ADD,
            sourceExceptionId: addExceptionId,
          },
        ],
      });

      const result = await materialize("2026-09-01");
      const date = result.dates[0];
      expect(result).toMatchObject({ created: 0, existingSame: 1, errors: 0 });
      expect(date).toMatchObject({
        outcome: "RECONCILIATION_REQUIRED",
        createdCount: 0,
      });
      expect(date?.existingDifferent).toEqual([
        expect.objectContaining({
          sourceScheduleTimeId: regularScheduleTimeId,
          fields: ["serviceLineId", "direction"],
        }),
      ]);

      expect(
        await prisma.scheduledDeparture.findFirstOrThrow({
          where: {
            sourceScheduleTimeId: regularScheduleTimeId,
            serviceDate: civilDate("2026-09-01"),
          },
        }),
      ).toMatchObject({
        serviceLineId: divergentServiceLineId,
        direction: Direction.RETORNO,
      });
    });

    it("reports a stale scheduled departure outside the current resolution without deleting it", async () => {
      await prisma.scheduledDeparture.create({
        data: {
          sourceScheduleTimeId: staleScheduleTimeId,
          serviceCalendarId: calendarId,
          serviceLineId,
          serviceDate: civilDate("2026-09-01"),
          scheduledTime: localTime(13, 15),
          direction: Direction.IDA,
          source: ScheduledDepartureSource.REGULAR,
        },
      });

      const result = await materialize("2026-09-01");
      const date = result.dates[0];
      expect(date).toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
      expect(date?.missingFromCurrentResolution).toEqual([
        expect.objectContaining({ sourceScheduleTimeId: staleScheduleTimeId }),
      ]);
      expect(
        await prisma.scheduledDeparture.count({
          where: {
            sourceScheduleTimeId: staleScheduleTimeId,
            serviceDate: civilDate("2026-09-01"),
          },
        }),
      ).toBe(1);
    });

    it("rolls back an entire direct repository batch when one source FK is invalid", async () => {
      const serviceDate = "2026-09-04";
      const invalidSourceScheduleTimeId = randomUUID();
      const writes = [
        directWrite(regularScheduleTimeId, serviceDate, "06:40"),
        directWrite(invalidSourceScheduleTimeId, serviceDate, "08:00"),
      ];

      let batchError: unknown;
      try {
        await scheduledDepartureRepository.materializeDate(writes);
      } catch (error) {
        batchError = error;
      }
      expect(isForeignKeyViolation(batchError)).toBe(true);
      expect(
        await prisma.scheduledDeparture.count({
          where: {
            sourceScheduleTimeId: regularScheduleTimeId,
            serviceDate: civilDate(serviceDate),
          },
        }),
      ).toBe(0);
    });
  },
);
