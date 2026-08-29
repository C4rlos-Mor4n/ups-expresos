import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { OperationalService } from './operational.service';

const integrationEnabled = process.env['RUN_PHASE_6_OPERATIONAL_INTEGRATION'] === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const prisma = new PrismaClient();
const auditLogsService = {
  logAction: jest.fn().mockResolvedValue(undefined),
} as unknown as AuditLogsService;
const service = new OperationalService(prisma as unknown as PrismaService, auditLogsService);

const fixture = {
  campusId: randomUUID(),
  serviceLineId: randomUUID(),
  calendarId: randomUUID(),
  patternId: randomUUID(),
  routePathAId: randomUUID(),
  routePathBId: randomUUID(),
  stopAId: randomUUID(),
  stopBId: randomUUID(),
  routePathStopAId: randomUUID(),
  routePathStopBId: randomUUID(),
  scheduleTimeAId: randomUUID(),
  scheduleTimeBId: randomUUID(),
  scheduleTimeHandoffId: randomUUID(),
  scheduleTimeMidnightId: randomUUID(),
  scheduleTimeConcurrentId: randomUUID(),
  journeyAId: randomUUID(),
  journeyBId: randomUUID(),
  journeyOverlapId: randomUUID(),
  journeyHandoffId: randomUUID(),
  journeyMidnightId: randomUUID(),
  journeyConcurrentId: randomUUID(),
  departureAId: randomUUID(),
  departureBId: randomUUID(),
  departureHandoffId: randomUUID(),
  departureMidnightId: randomUUID(),
  departureConcurrentId: randomUUID(),
  vehicleAId: randomUUID(),
  vehicleBId: randomUUID(),
  vehicleCId: randomUUID(),
  vehicleDId: randomUUID(),
  driverAId: randomUUID(),
  driverBId: randomUUID(),
  driverCId: randomUUID(),
  driverAUserId: randomUUID(),
  driverBUserId: randomUUID(),
  driverCUserId: randomUUID(),
};

const civilDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const localTime = (hours: number, minutes: number): Date => new Date(Date.UTC(1970, 0, 1, hours, minutes));

describeIntegration('Phase 6 operational PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.campus.create({
      data: { id: fixture.campusId, code: `P6-${fixture.campusId.slice(0, 8)}`, name: 'Phase 6 campus' },
    });
    await prisma.serviceLine.create({
      data: {
        id: fixture.serviceLineId,
        campusId: fixture.campusId,
        code: `P6-${fixture.serviceLineId.slice(0, 8)}`,
        name: 'Phase 6 line',
      },
    });
    await prisma.serviceCalendar.create({
      data: {
        id: fixture.calendarId,
        serviceLineId: fixture.serviceLineId,
        name: 'Phase 6 calendar',
        validFrom: civilDate('2026-09-01'),
        validUntil: civilDate('2026-09-30'),
        status: 'PUBLISHED',
      },
    });
    await prisma.schedulePattern.create({
      data: { id: fixture.patternId, serviceCalendarId: fixture.calendarId, direction: 'IDA', status: 'PUBLISHED' },
    });
    await prisma.stop.createMany({
      data: [
        { id: fixture.stopAId, name: `P6 Stop A ${fixture.stopAId.slice(0, 8)}`, latitude: -2.17, longitude: -79.92 },
        { id: fixture.stopBId, name: `P6 Stop B ${fixture.stopBId.slice(0, 8)}`, latitude: -2.18, longitude: -79.93 },
      ],
    });
    await prisma.routePath.createMany({
      data: [
        { id: fixture.routePathAId, serviceLineId: fixture.serviceLineId, code: `P6-A-${fixture.routePathAId.slice(0, 8)}`, displayName: 'P6 Journey A', direction: 'IDA' },
        { id: fixture.routePathBId, serviceLineId: fixture.serviceLineId, code: `P6-B-${fixture.routePathBId.slice(0, 8)}`, displayName: 'P6 Journey B', direction: 'IDA' },
      ],
    });
    await prisma.routePathStop.createMany({
      data: [
        { id: fixture.routePathStopAId, routePathId: fixture.routePathAId, stopId: fixture.stopAId, stopOrder: 1 },
        { id: fixture.routePathStopBId, routePathId: fixture.routePathBId, stopId: fixture.stopBId, stopOrder: 1 },
      ],
    });
    await prisma.scheduleTime.createMany({
      data: [
        { id: fixture.scheduleTimeAId, schedulePatternId: fixture.patternId, departureTime: localTime(6, 40) },
        { id: fixture.scheduleTimeBId, schedulePatternId: fixture.patternId, departureTime: localTime(7, 0) },
        { id: fixture.scheduleTimeHandoffId, schedulePatternId: fixture.patternId, departureTime: localTime(7, 30) },
        { id: fixture.scheduleTimeMidnightId, schedulePatternId: fixture.patternId, departureTime: localTime(23, 50) },
        { id: fixture.scheduleTimeConcurrentId, schedulePatternId: fixture.patternId, departureTime: localTime(8, 0) },
      ],
    });
    await prisma.scheduleJourneyTemplate.createMany({
      data: [
        { id: fixture.journeyAId, scheduleTimeId: fixture.scheduleTimeAId, routePathId: fixture.routePathAId },
        { id: fixture.journeyBId, scheduleTimeId: fixture.scheduleTimeAId, routePathId: fixture.routePathBId },
        { id: fixture.journeyOverlapId, scheduleTimeId: fixture.scheduleTimeBId, routePathId: fixture.routePathAId },
        { id: fixture.journeyHandoffId, scheduleTimeId: fixture.scheduleTimeHandoffId, routePathId: fixture.routePathAId },
        { id: fixture.journeyMidnightId, scheduleTimeId: fixture.scheduleTimeMidnightId, routePathId: fixture.routePathAId },
        { id: fixture.journeyConcurrentId, scheduleTimeId: fixture.scheduleTimeConcurrentId, routePathId: fixture.routePathAId },
      ],
    });
    await prisma.scheduledStopTime.createMany({
      data: [
        { journeyTemplateId: fixture.journeyAId, routePathStopId: fixture.routePathStopAId, offsetMinutes: 50 },
        { journeyTemplateId: fixture.journeyBId, routePathStopId: fixture.routePathStopBId, offsetMinutes: 50 },
        { journeyTemplateId: fixture.journeyOverlapId, routePathStopId: fixture.routePathStopAId, offsetMinutes: 50 },
        { journeyTemplateId: fixture.journeyHandoffId, routePathStopId: fixture.routePathStopAId, offsetMinutes: 50 },
        { journeyTemplateId: fixture.journeyMidnightId, routePathStopId: fixture.routePathStopAId, offsetMinutes: 30 },
        { journeyTemplateId: fixture.journeyConcurrentId, routePathStopId: fixture.routePathStopAId, offsetMinutes: 20 },
      ],
    });
    await prisma.scheduledDeparture.createMany({
      data: [
        { id: fixture.departureAId, sourceScheduleTimeId: fixture.scheduleTimeAId, serviceCalendarId: fixture.calendarId, serviceLineId: fixture.serviceLineId, serviceDate: civilDate('2026-09-01'), scheduledTime: localTime(6, 40), direction: 'IDA', source: 'REGULAR' },
        { id: fixture.departureBId, sourceScheduleTimeId: fixture.scheduleTimeBId, serviceCalendarId: fixture.calendarId, serviceLineId: fixture.serviceLineId, serviceDate: civilDate('2026-09-01'), scheduledTime: localTime(7, 0), direction: 'IDA', source: 'REGULAR' },
        { id: fixture.departureHandoffId, sourceScheduleTimeId: fixture.scheduleTimeHandoffId, serviceCalendarId: fixture.calendarId, serviceLineId: fixture.serviceLineId, serviceDate: civilDate('2026-09-01'), scheduledTime: localTime(7, 30), direction: 'IDA', source: 'REGULAR' },
        { id: fixture.departureMidnightId, sourceScheduleTimeId: fixture.scheduleTimeMidnightId, serviceCalendarId: fixture.calendarId, serviceLineId: fixture.serviceLineId, serviceDate: civilDate('2026-09-01'), scheduledTime: localTime(23, 50), direction: 'IDA', source: 'REGULAR' },
        { id: fixture.departureConcurrentId, sourceScheduleTimeId: fixture.scheduleTimeConcurrentId, serviceCalendarId: fixture.calendarId, serviceLineId: fixture.serviceLineId, serviceDate: civilDate('2026-09-01'), scheduledTime: localTime(8, 0), direction: 'IDA', source: 'REGULAR' },
      ],
    });
    await prisma.user.createMany({
      data: [
        { id: fixture.driverAUserId, email: `p6-driver-a-${fixture.driverAUserId}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
        { id: fixture.driverBUserId, email: `p6-driver-b-${fixture.driverBUserId}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
        { id: fixture.driverCUserId, email: `p6-driver-c-${fixture.driverCUserId}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
      ],
    });
    await prisma.vehicle.createMany({
      data: [
        { id: fixture.vehicleAId, code: `P6VA${fixture.vehicleAId.slice(0, 6)}`, plate: `P6A${fixture.vehicleAId.slice(0, 6)}`, capacity: 30 },
        { id: fixture.vehicleBId, code: `P6VB${fixture.vehicleBId.slice(0, 6)}`, plate: `P6B${fixture.vehicleBId.slice(0, 6)}`, capacity: 30 },
        { id: fixture.vehicleCId, code: `P6VC${fixture.vehicleCId.slice(0, 6)}`, plate: `P6C${fixture.vehicleCId.slice(0, 6)}`, capacity: 30 },
        { id: fixture.vehicleDId, code: `P6VD${fixture.vehicleDId.slice(0, 6)}`, plate: `P6D${fixture.vehicleDId.slice(0, 6)}`, capacity: 30 },
      ],
    });
    await prisma.driver.createMany({
      data: [
        { id: fixture.driverAId, userId: fixture.driverAUserId, name: 'Phase 6 driver A' },
        { id: fixture.driverBId, userId: fixture.driverBUserId, name: 'Phase 6 driver B' },
        { id: fixture.driverCId, userId: fixture.driverCUserId, name: 'Phase 6 driver C' },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.serviceRun.deleteMany({ where: { serviceAssignment: { scheduledDepartureId: { in: [fixture.departureAId, fixture.departureBId, fixture.departureHandoffId, fixture.departureMidnightId, fixture.departureConcurrentId] } } } });
      await prisma.serviceAssignment.deleteMany({ where: { scheduledDepartureId: { in: [fixture.departureAId, fixture.departureBId, fixture.departureHandoffId, fixture.departureMidnightId, fixture.departureConcurrentId] } } });
      await prisma.scheduledDeparture.deleteMany({ where: { id: { in: [fixture.departureAId, fixture.departureBId, fixture.departureHandoffId, fixture.departureMidnightId, fixture.departureConcurrentId] } } });
      await prisma.scheduledStopTime.deleteMany({ where: { journeyTemplateId: { in: [fixture.journeyAId, fixture.journeyBId, fixture.journeyOverlapId, fixture.journeyHandoffId, fixture.journeyMidnightId, fixture.journeyConcurrentId] } } });
      await prisma.scheduleJourneyTemplate.deleteMany({ where: { id: { in: [fixture.journeyAId, fixture.journeyBId, fixture.journeyOverlapId, fixture.journeyHandoffId, fixture.journeyMidnightId, fixture.journeyConcurrentId] } } });
      await prisma.scheduleTime.deleteMany({ where: { id: { in: [fixture.scheduleTimeAId, fixture.scheduleTimeBId, fixture.scheduleTimeHandoffId, fixture.scheduleTimeMidnightId, fixture.scheduleTimeConcurrentId] } } });
      await prisma.routePathStop.deleteMany({ where: { id: { in: [fixture.routePathStopAId, fixture.routePathStopBId] } } });
      await prisma.routePath.deleteMany({ where: { id: { in: [fixture.routePathAId, fixture.routePathBId] } } });
      await prisma.schedulePattern.delete({ where: { id: fixture.patternId } });
      await prisma.serviceCalendar.delete({ where: { id: fixture.calendarId } });
      await prisma.serviceLine.delete({ where: { id: fixture.serviceLineId } });
      await prisma.campus.delete({ where: { id: fixture.campusId } });
      await prisma.driver.deleteMany({ where: { id: { in: [fixture.driverAId, fixture.driverBId, fixture.driverCId] } } });
      await prisma.vehicle.deleteMany({ where: { id: { in: [fixture.vehicleAId, fixture.vehicleBId, fixture.vehicleCId, fixture.vehicleDId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [fixture.driverAUserId, fixture.driverBUserId, fixture.driverCUserId] } } });
      await prisma.stop.deleteMany({ where: { id: { in: [fixture.stopAId, fixture.stopBId] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows multiple buses for one departure, including the same journey template, and derives the planned window', async () => {
    const first = await service.createAssignment({ scheduledDepartureId: fixture.departureAId, vehicleId: fixture.vehicleAId, driverId: fixture.driverAId, journeyTemplateId: fixture.journeyAId }, fixture.driverAUserId);
    const second = await service.createAssignment({ scheduledDepartureId: fixture.departureAId, vehicleId: fixture.vehicleBId, driverId: fixture.driverBId, journeyTemplateId: fixture.journeyAId }, fixture.driverBUserId);
    const third = await service.createAssignment({ scheduledDepartureId: fixture.departureAId, vehicleId: fixture.vehicleCId, driverId: fixture.driverCId, journeyTemplateId: fixture.journeyBId }, fixture.driverCUserId);

    expect(first.plannedStartAt.toISOString()).toBe('2026-09-01T11:40:00.000Z');
    expect(first.plannedEndAt.toISOString()).toBe('2026-09-01T12:30:00.000Z');
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  });

  it('rejects invalid journey ownership and vehicle/driver planned-window conflicts', async () => {
    await expect(service.createAssignment({ scheduledDepartureId: fixture.departureAId, vehicleId: fixture.vehicleAId, driverId: fixture.driverAId, journeyTemplateId: fixture.journeyConcurrentId }, fixture.driverAUserId)).rejects.toThrow(ConflictException);
    await expect(service.createAssignment({ scheduledDepartureId: fixture.departureBId, vehicleId: fixture.vehicleAId, driverId: fixture.driverCId, journeyTemplateId: fixture.journeyOverlapId }, fixture.driverCUserId)).rejects.toThrow('VEHICLE_CONFLICT');
    await expect(service.createAssignment({ scheduledDepartureId: fixture.departureBId, vehicleId: fixture.vehicleDId, driverId: fixture.driverAId, journeyTemplateId: fixture.journeyOverlapId }, fixture.driverAUserId)).rejects.toThrow('DRIVER_CONFLICT');
  });

  it('allows exact [start, end) handoff for the same vehicle and driver', async () => {
    const handoff = await service.createAssignment({ scheduledDepartureId: fixture.departureHandoffId, vehicleId: fixture.vehicleAId, driverId: fixture.driverAId, journeyTemplateId: fixture.journeyHandoffId }, fixture.driverAUserId);
    expect(handoff.plannedStartAt.toISOString()).toBe('2026-09-01T12:30:00.000Z');
    expect(handoff.plannedEndAt.toISOString()).toBe('2026-09-01T13:20:00.000Z');
  });

  it('handles a midnight planned window and serializes competing assignment creation', async () => {
    const midnight = await service.createAssignment({ scheduledDepartureId: fixture.departureMidnightId, vehicleId: fixture.vehicleAId, driverId: fixture.driverAId, journeyTemplateId: fixture.journeyMidnightId }, fixture.driverAUserId);
    expect(midnight.plannedStartAt.toISOString()).toBe('2026-09-02T04:50:00.000Z');
    expect(midnight.plannedEndAt.toISOString()).toBe('2026-09-02T05:20:00.000Z');

    const candidates = await Promise.allSettled([
      service.createAssignment({ scheduledDepartureId: fixture.departureConcurrentId, vehicleId: fixture.vehicleBId, driverId: fixture.driverBId, journeyTemplateId: fixture.journeyConcurrentId }, fixture.driverBUserId),
      service.createAssignment({ scheduledDepartureId: fixture.departureConcurrentId, vehicleId: fixture.vehicleBId, driverId: fixture.driverBId, journeyTemplateId: fixture.journeyConcurrentId }, fixture.driverBUserId),
    ]);
    expect(candidates.filter((candidate) => candidate.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.serviceAssignment.count({ where: { scheduledDepartureId: fixture.departureConcurrentId } })).toBe(1);
  });

  it('creates exactly one ServiceRun under four concurrent starts and finishes idempotently', async () => {
    const assignment = await prisma.serviceAssignment.findFirstOrThrow({ where: { scheduledDepartureId: fixture.departureAId, driverId: fixture.driverBId } });
    const started = await Promise.all([
      service.startDriverRun(fixture.driverBUserId, assignment.id),
      service.startDriverRun(fixture.driverBUserId, assignment.id),
      service.startDriverRun(fixture.driverBUserId, assignment.id),
      service.startDriverRun(fixture.driverBUserId, assignment.id),
    ]);
    expect(new Set(started.map((value) => value.run?.id)).size).toBe(1);
    expect(await prisma.serviceRun.count({ where: { serviceAssignmentId: assignment.id } })).toBe(1);

    const runId = started[0]?.run?.id;
    expect(runId).toBeDefined();
    const firstFinish = await service.finishDriverRun(fixture.driverBUserId, runId!);
    const secondFinish = await service.finishDriverRun(fixture.driverBUserId, runId!);
    expect(firstFinish.run?.status).toBe('COMPLETED');
    expect(secondFinish.run?.status).toBe('COMPLETED');
  });
});
