import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const integrationEnabled = process.env.RUN_SCHEDULED_DEPARTURE_INTEGRATION === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const prisma = new PrismaClient();
const campusId = randomUUID();
const serviceLineId = randomUUID();
const calendarId = randomUUID();
const regularPatternAId = randomUUID();
const regularPatternBId = randomUUID();
const scheduleTimeAId = randomUUID();
const scheduleTimeBId = randomUUID();
const exceptionId = randomUUID();
const departureAId = randomUUID();
const departureBId = randomUUID();
const exceptionDepartureId = randomUUID();

const civilDate = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

const localTime = (hours: number, minutes: number): Date =>
  new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

describeIntegration('ScheduledDeparture PostgreSQL constraints', () => {
  beforeAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.campus.create({
        data: {
          id: campusId,
          code: `TEST-5CA-${campusId.slice(0, 8)}`,
          name: '5C-A synthetic campus',
        },
      });
      await tx.serviceLine.create({
        data: {
          id: serviceLineId,
          campusId,
          code: `TEST-5CA-${serviceLineId.slice(0, 8)}`,
          name: '5C-A synthetic line',
        },
      });
      await tx.serviceCalendar.create({
        data: {
          id: calendarId,
          serviceLineId,
          name: '5C-A synthetic calendar',
          validFrom: civilDate(2026, 9, 1),
          validUntil: civilDate(2026, 9, 30),
          status: 'PUBLISHED',
        },
      });
      await tx.schedulePattern.createMany({
        data: [
          {
            id: regularPatternAId,
            serviceCalendarId: calendarId,
            direction: 'IDA',
            status: 'PUBLISHED',
          },
          {
            id: regularPatternBId,
            serviceCalendarId: calendarId,
            direction: 'IDA',
            status: 'PUBLISHED',
          },
        ],
      });
      await tx.scheduleTime.createMany({
        data: [
          {
            id: scheduleTimeAId,
            schedulePatternId: regularPatternAId,
            departureTime: localTime(6, 40),
          },
          {
            id: scheduleTimeBId,
            schedulePatternId: regularPatternBId,
            departureTime: localTime(6, 40),
          },
        ],
      });
      await tx.serviceException.create({
        data: {
          id: exceptionId,
          serviceCalendarId: calendarId,
          serviceDate: civilDate(2026, 9, 2),
          reason: 'EXAM_PERIOD',
          effect: 'ADD_TIMES',
          status: 'PUBLISHED',
          description: '5C-A synthetic exception',
        },
      });
    });
  });

  afterAll(async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.scheduledDeparture.deleteMany({
          where: { id: { in: [departureAId, departureBId, exceptionDepartureId] } },
        });
        await tx.serviceException.delete({ where: { id: exceptionId } });
        await tx.scheduleTime.deleteMany({ where: { id: { in: [scheduleTimeAId, scheduleTimeBId] } } });
        await tx.schedulePattern.deleteMany({
          where: { id: { in: [regularPatternAId, regularPatternBId] } },
        });
        await tx.serviceCalendar.delete({ where: { id: calendarId } });
        await tx.serviceLine.delete({ where: { id: serviceLineId } });
        await tx.campus.delete({ where: { id: campusId } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('enforces source/date identity, permits nominal collisions, preserves snapshots and restricts source deletion', async () => {
    const first = await prisma.scheduledDeparture.create({
      data: {
        id: departureAId,
        sourceScheduleTimeId: scheduleTimeAId,
        serviceCalendarId: calendarId,
        serviceLineId,
        serviceDate: civilDate(2026, 9, 1),
        scheduledTime: localTime(6, 40),
        direction: 'IDA',
        source: 'REGULAR',
      },
    });

    expect(first.scheduledTime.toISOString().slice(11, 16)).toBe('06:40');

    let duplicateError: unknown;
    try {
      await prisma.scheduledDeparture.create({
        data: {
          id: randomUUID(),
          sourceScheduleTimeId: scheduleTimeAId,
          serviceCalendarId: calendarId,
          serviceLineId,
          serviceDate: civilDate(2026, 9, 1),
          scheduledTime: localTime(6, 40),
          direction: 'IDA',
          source: 'REGULAR',
        },
      });
    } catch (error) {
      duplicateError = error;
    }
    expect(isUniqueViolation(duplicateError)).toBe(true);

    const nominalCollision = await prisma.scheduledDeparture.create({
      data: {
        id: departureBId,
        sourceScheduleTimeId: scheduleTimeBId,
        serviceCalendarId: calendarId,
        serviceLineId,
        serviceDate: civilDate(2026, 9, 1),
        scheduledTime: localTime(6, 40),
        direction: 'IDA',
        source: 'REGULAR',
      },
    });
    expect(nominalCollision.id).toBe(departureBId);

    const exceptionDeparture = await prisma.scheduledDeparture.create({
      data: {
        id: exceptionDepartureId,
        sourceScheduleTimeId: scheduleTimeBId,
        serviceCalendarId: calendarId,
        serviceLineId,
        serviceDate: civilDate(2026, 9, 2),
        scheduledTime: localTime(10, 30),
        direction: 'IDA',
        source: 'EXCEPTION_ADD',
        sourceExceptionId: exceptionId,
      },
    });
    expect(exceptionDeparture.sourceExceptionId).toBe(exceptionId);

    await prisma.scheduleTime.update({
      where: { id: scheduleTimeAId },
      data: { departureTime: localTime(7, 0) },
    });
    const snapshot = await prisma.scheduledDeparture.findUniqueOrThrow({ where: { id: departureAId } });
    expect(snapshot.scheduledTime.toISOString().slice(11, 16)).toBe('06:40');

    let deleteError: unknown;
    try {
      await prisma.scheduleTime.delete({ where: { id: scheduleTimeAId } });
    } catch (error) {
      deleteError = error;
    }
    expect(isForeignKeyViolation(deleteError)).toBe(true);
  });
});
