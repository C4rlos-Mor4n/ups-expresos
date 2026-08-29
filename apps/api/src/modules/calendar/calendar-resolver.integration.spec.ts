import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  Weekday,
} from '@prisma/client';
import { CalendarRepository } from './calendar.repository';
import { CalendarResolverService } from './calendar-resolver.service';
import { PrismaService } from '../../database/prisma.service';

const integrationEnabled = process.env.RUN_CALENDAR_INTEGRATION === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('Calendar resolver PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const repository = new CalendarRepository(prisma);
  const resolver = new CalendarResolverService(repository);
  const campusId = randomUUID();
  const serviceLineId = randomUUID();
  const calendarId = randomUUID();
  const patternId = randomUUID();
  const patternDayId = randomUUID();
  const scheduleTimeId = randomUUID();
  const pathAId = randomUUID();
  const pathBId = randomUUID();
  const stopAId = randomUUID();
  const stopBId = randomUUID();
  const stopCId = randomUUID();
  const pathAStopIds = [randomUUID(), randomUUID(), randomUUID()];
  const pathBStopIds = [randomUUID(), randomUUID(), randomUUID()];
  const journeyIdBase = randomUUID().slice(0, -1);
  const journeyAId = `${journeyIdBase}a`;
  const journeyBId = `${journeyIdBase}b`;
  const journeyAStopTimeIds = [randomUUID(), randomUUID(), randomUUID()];
  const journeyBStopTimeIds = [randomUUID(), randomUUID(), randomUUID()];
  const pathStopIds = [...pathAStopIds, ...pathBStopIds];
  const journeyIds = [journeyAId, journeyBId];
  const stopTimeIds = [...journeyAStopTimeIds, ...journeyBStopTimeIds];
  const stopIds = [stopAId, stopBId, stopCId];

  const cleanup = async (): Promise<void> => {
    await prisma.scheduledStopTime.deleteMany({ where: { id: { in: stopTimeIds } } });
    await prisma.scheduleJourneyTemplate.deleteMany({ where: { id: { in: journeyIds } } });
    await prisma.scheduleTime.deleteMany({ where: { id: scheduleTimeId } });
    await prisma.schedulePatternDay.deleteMany({ where: { id: patternDayId } });
    await prisma.schedulePattern.deleteMany({ where: { id: patternId } });
    await prisma.routePathStop.deleteMany({ where: { id: { in: pathStopIds } } });
    await prisma.routePath.deleteMany({ where: { id: { in: [pathAId, pathBId] } } });
    await prisma.stop.deleteMany({ where: { id: { in: stopIds } } });
    await prisma.serviceCalendar.deleteMany({ where: { id: calendarId } });
    await prisma.serviceLine.deleteMany({ where: { id: serviceLineId } });
    await prisma.campus.deleteMany({ where: { id: campusId } });
  };

  const readFixtureCounts = async (): Promise<number[]> =>
    Promise.all([
      prisma.campus.count({ where: { id: campusId } }),
      prisma.serviceLine.count({ where: { id: serviceLineId } }),
      prisma.serviceCalendar.count({ where: { id: calendarId } }),
      prisma.schedulePattern.count({ where: { id: patternId } }),
      prisma.schedulePatternDay.count({ where: { id: patternDayId } }),
      prisma.scheduleTime.count({ where: { id: scheduleTimeId } }),
      prisma.routePath.count({ where: { id: { in: [pathAId, pathBId] } } }),
      prisma.routePathStop.count({ where: { id: { in: pathStopIds } } }),
      prisma.stop.count({ where: { id: { in: stopIds } } }),
      prisma.scheduleJourneyTemplate.count({ where: { id: { in: journeyIds } } }),
      prisma.scheduledStopTime.count({ where: { id: { in: stopTimeIds } } }),
    ]);

  beforeAll(async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Calendar integration must not run against production');
    }

    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
      await tx.campus.create({
        data: {
          id: campusId,
          code: `TEST-CALENDAR-${campusId.slice(0, 8)}`,
          name: 'Calendar Resolver Integration Campus',
        },
      });
      await tx.serviceLine.create({
        data: {
          id: serviceLineId,
          campusId,
          code: `TEST-LINE-${serviceLineId.slice(0, 8)}`,
          name: 'Calendar Resolver Integration Line',
        },
      });
      await tx.serviceCalendar.create({
        data: {
          id: calendarId,
          serviceLineId,
          name: 'Integration Calendar',
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          validUntil: new Date('2026-12-31T00:00:00.000Z'),
          timezone: 'America/Guayaquil',
          status: SchedulePublicationStatus.PUBLISHED,
        },
      });
      await tx.schedulePattern.create({
        data: {
          id: patternId,
          serviceCalendarId: calendarId,
          direction: Direction.IDA,
          type: SchedulePatternType.EXPLICIT_TIMES,
          status: SchedulePublicationStatus.PUBLISHED,
        },
      });
      await tx.schedulePatternDay.create({
        data: {
          id: patternDayId,
          schedulePatternId: patternId,
          weekday: Weekday.MONDAY,
        },
      });
      await tx.scheduleTime.create({
        data: {
          id: scheduleTimeId,
          schedulePatternId: patternId,
          departureTime: new Date('1970-01-01T23:50:00.000Z'),
          approximateArrivalTime: new Date('1970-01-01T06:40:00.000Z'),
        },
      });

      for (const [id, name] of [
        [stopAId, 'Integration Stop A'],
        [stopBId, 'Integration Stop B'],
        [stopCId, 'Integration Stop C'],
      ] as const) {
        await tx.stop.create({
          data: { id, name, latitude: 0, longitude: 0 },
        });
      }

      await tx.routePath.createMany({
        data: [
          {
            id: pathAId,
            serviceLineId,
            code: `TEST-PATH-A-${pathAId.slice(0, 8)}`,
            displayName: 'Integration Path A',
            direction: Direction.IDA,
          },
          {
            id: pathBId,
            serviceLineId,
            code: `TEST-PATH-B-${pathBId.slice(0, 8)}`,
            displayName: 'Integration Path B',
            direction: Direction.IDA,
          },
        ],
      });

      for (const [pathId, ids] of [
        [pathAId, pathAStopIds],
        [pathBId, pathBStopIds],
      ] as const) {
        for (const [index, id] of ids.entries()) {
          await tx.routePathStop.create({
            data: {
              id,
              routePathId: pathId,
              stopId: stopIds[index] ?? stopAId,
              stopOrder: index + 1,
            },
          });
        }
      }

      await tx.scheduleJourneyTemplate.create({
        data: { id: journeyBId, scheduleTimeId, routePathId: pathBId },
      });
      await tx.scheduleJourneyTemplate.create({
        data: { id: journeyAId, scheduleTimeId, routePathId: pathAId },
      });

      for (const [journeyTemplateId, ids, routeStops] of [
        [journeyAId, journeyAStopTimeIds, pathAStopIds],
        [journeyBId, journeyBStopTimeIds, pathBStopIds],
      ] as const) {
        for (const [index, id] of ids.entries()) {
          const routePathStopId = routeStops[index];
          if (!routePathStopId) {
            throw new Error(`Missing route path stop fixture for ${journeyTemplateId}`);
          }
          await tx.scheduledStopTime.create({
            data: {
              id,
              journeyTemplateId,
              routePathStopId,
              offsetMinutes: [0, 20, 30][index] ?? 0,
            },
          });
        }
      }
    });
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('resolves a complete timetable, sorts journeys, crosses midnight and performs no writes', async () => {
    const before = await readFixtureCounts();
    expect(before[7]).toBe(pathStopIds.length);
    expect(before[10]).toBe(stopTimeIds.length);
    expect(before[7]).toBe(before[10]);

    const result = await resolver.resolveSchedule({
      serviceLineId,
      direction: Direction.IDA,
      serviceDate: '2026-08-24',
    });

    const after = await readFixtureCounts();

    expect(result).toMatchObject({
      ok: true,
      value: {
        serviceLineId,
        serviceCalendarId: calendarId,
        direction: Direction.IDA,
        serviceDate: '2026-08-24',
        timezone: 'America/Guayaquil',
        serviceAvailable: true,
        resolution: 'REGULAR',
        timetableCompleteness: 'COMPLETE',
        departures: [
          {
            patternId,
            scheduleTimeId,
            departureTime: '23:50:00',
            approximateArrivalTime: '06:40:00',
            source: 'REGULAR',
          },
        ],
      },
    });
    expect(after).toEqual(before);

    if (!result.ok) return;
    const departure = result.value.departures[0];
    expect(departure).toBeDefined();
    if (!departure) return;

    expect(departure.journeys.map((journey) => journey.journeyTemplateId)).toEqual(
      [journeyAId, journeyBId].sort(),
    );

    const expectedJourneyData = [
      { id: journeyAId, routePathId: pathAId, routeStops: pathAStopIds },
      { id: journeyBId, routePathId: pathBId, routeStops: pathBStopIds },
    ];
    for (const expected of expectedJourneyData) {
      const journey = departure.journeys.find((candidate) => candidate.journeyTemplateId === expected.id);
      expect(journey).toBeDefined();
      if (!journey) return;

      expect(journey).toMatchObject({ journeyTemplateId: expected.id, routePathId: expected.routePathId });
      expect(journey.scheduledStopTimes.map((stop) => stop.routePathStopId)).toEqual(expected.routeStops);
      expect(journey.scheduledStopTimes.map((stop) => stop.stopOrder)).toEqual([1, 2, 3]);
      expect(journey.scheduledStopTimes.map((stop) => stop.offsetMinutes)).toEqual([0, 20, 30]);
      expect(journey.scheduledStopTimes.map((stop) => stop.plannedTime)).toEqual([
        '23:50:00',
        '00:10:00',
        '00:20:00',
      ]);
      expect(journey.scheduledStopTimes.map((stop) => stop.dayOffset)).toEqual([0, 1, 1]);
    }
  });
});
