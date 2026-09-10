import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Direction, SchedulePublicationStatus, ServiceExceptionEffect, ServiceExceptionReason, ServiceExceptionStatus, Weekday } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from '../../database/prisma.service';
import { createTestApp } from '../../../test/helpers/e2e.helper';

const integrationEnabled = process.env.RUN_ADMIN_SCHEDULE_INTEGRATION === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('Admin schedule management API integration', () => {
  const ids = {
    campus: randomUUID(),
    line: randomUUID(),
    path: randomUUID(),
    stops: [randomUUID(), randomUUID()],
    pathStops: [randomUUID(), randomUUID()],
    admin: randomUUID(),
    superAdmin: randomUUID(),
    student: randomUUID(),
    driverUser: randomUUID(),
  };
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let superAdminToken: string;
  let studentToken: string;
  let driverToken: string;
  let calendarId: string;
  let patternId: string;
  let timeId: string;
  let journeyId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    const jwt = testApp.moduleRef.get(JwtService);

    await prisma.campus.create({ data: { id: ids.campus, code: `8B-${ids.campus.slice(0, 8)}`, name: '8B Campus' } });
    await prisma.serviceLine.create({ data: { id: ids.line, campusId: ids.campus, code: `8B-${ids.line.slice(0, 8)}`, name: '8B Line' } });
    await prisma.routePath.create({ data: { id: ids.path, serviceLineId: ids.line, code: `8B-${ids.path.slice(0, 8)}`, displayName: '8B Ida', direction: Direction.IDA } });
    await prisma.stop.createMany({ data: ids.stops.map((id, index) => ({ id, name: `8B Stop ${index + 1}`, latitude: -2.1, longitude: -79.9 })) });
    await prisma.routePathStop.createMany({ data: ids.pathStops.map((id, index) => ({ id, routePathId: ids.path, stopId: ids.stops[index]!, stopOrder: index + 1 })) });
    await prisma.user.createMany({ data: [
      { id: ids.admin, email: `8b-admin-${ids.admin}@ups.edu.ec`, role: 'ADMIN', emailVerified: true },
      { id: ids.superAdmin, email: `8b-super-${ids.superAdmin}@ups.edu.ec`, role: 'SUPER_ADMIN', emailVerified: true },
      { id: ids.student, email: `8b-student-${ids.student}@est.ups.edu.ec`, role: 'STUDENT', emailVerified: true },
      { id: ids.driverUser, email: `8b-driver-${ids.driverUser}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
    ] });
    adminToken = jwt.sign({ sub: ids.admin, email: `8b-admin-${ids.admin}@ups.edu.ec`, role: 'ADMIN' });
    superAdminToken = jwt.sign({ sub: ids.superAdmin, email: `8b-super-${ids.superAdmin}@ups.edu.ec`, role: 'SUPER_ADMIN' });
    studentToken = jwt.sign({ sub: ids.student, email: `8b-student-${ids.student}@est.ups.edu.ec`, role: 'STUDENT' });
    driverToken = jwt.sign({ sub: ids.driverUser, email: `8b-driver-${ids.driverUser}@ups.edu.ec`, role: 'DRIVER' });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.scheduledDeparture.deleteMany({ where: { serviceLineId: ids.line } });
    const patterns = calendarId ? await prisma.schedulePattern.findMany({ where: { serviceCalendarId: calendarId }, select: { id: true, times: { select: { id: true, journeyTemplates: { select: { id: true } } } } } }) : [];
    const patternIds = patterns.map((pattern) => pattern.id);
    const timeIds = patterns.flatMap((pattern) => pattern.times.map((time) => time.id));
    const journeyIds = patterns.flatMap((pattern) => pattern.times.flatMap((time) => time.journeyTemplates.map((journey) => journey.id)));
    await prisma.scheduledStopTime.deleteMany({ where: { journeyTemplateId: { in: journeyIds } } });
    await prisma.scheduleJourneyTemplate.deleteMany({ where: { id: { in: journeyIds } } });
    await prisma.scheduleTime.deleteMany({ where: { id: { in: timeIds } } });
    await prisma.schedulePatternDay.deleteMany({ where: { schedulePatternId: { in: patternIds } } });
    await prisma.schedulePattern.deleteMany({ where: { id: { in: patternIds } } });
    await prisma.serviceException.deleteMany({ where: { serviceCalendarId: calendarId } });
    await prisma.serviceCalendar.deleteMany({ where: { id: calendarId } });
    await prisma.routePathStop.deleteMany({ where: { routePathId: ids.path } });
    await prisma.routePath.deleteMany({ where: { id: ids.path } });
    await prisma.stop.deleteMany({ where: { id: { in: ids.stops } } });
    await prisma.serviceLine.deleteMany({ where: { id: ids.line } });
    await prisma.campus.deleteMany({ where: { id: ids.campus } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.superAdmin, ids.student, ids.driverUser] } } });
    await app?.close();
  });

  it('rejects non-admin users and creates a complete draft workflow', async () => {
    await request(app.getHttpServer()).get('/admin/schedules/calendars').set('Authorization', `Bearer ${studentToken}`).expect(403);
    await request(app.getHttpServer()).get('/admin/schedules/calendars').set('Authorization', `Bearer ${driverToken}`).expect(403);
    await request(app.getHttpServer()).get('/admin/schedules/calendars').set('Authorization', `Bearer ${superAdminToken}`).expect(200);

    const calendar = await request(app.getHttpServer()).post('/admin/schedules/calendars').set('Authorization', `Bearer ${adminToken}`).send({ serviceLineId: ids.line, name: '8B calendar', validFrom: '2026-09-14', validUntil: '2026-09-20' }).expect(201);
    calendarId = calendar.body.id;
    const pattern = await request(app.getHttpServer()).post(`/admin/schedules/calendars/${calendarId}/patterns`).set('Authorization', `Bearer ${adminToken}`).send({ direction: 'IDA', days: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY] }).expect(201);
    patternId = pattern.body.id;
    const time = await request(app.getHttpServer()).post(`/admin/schedules/patterns/${patternId}/times`).set('Authorization', `Bearer ${adminToken}`).send({ departureTime: '06:40:00' }).expect(201);
    timeId = time.body.id;
    const journey = await request(app.getHttpServer()).post(`/admin/schedules/times/${timeId}/journeys`).set('Authorization', `Bearer ${adminToken}`).send({ routePathId: ids.path }).expect(201);
    journeyId = journey.body.journeyTemplates[0].id;
  });

  it('rejects incomplete publication and then publishes, queries and materializes idempotently', async () => {
    const incomplete = await request(app.getHttpServer()).post(`/admin/schedules/calendars/${calendarId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(400);
    expect(incomplete.body.code).toBe('SCHEDULE_CONFIGURATION_INCOMPLETE');

    await request(app.getHttpServer()).put(`/admin/schedules/journeys/${journeyId}/stop-times`).set('Authorization', `Bearer ${adminToken}`).send({ stopTimes: [{ routePathStopId: ids.pathStops[0], offsetMinutes: 0 }, { routePathStopId: ids.pathStops[1], offsetMinutes: 15 }] }).expect(200);
    const published = await request(app.getHttpServer()).post(`/admin/schedules/calendars/${calendarId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(published.body.status).toBe(SchedulePublicationStatus.PUBLISHED);
    const timetable = await request(app.getHttpServer()).get(`/admin/schedules/timetable?calendarId=${calendarId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(timetable.body).toHaveLength(1);

    const first = await request(app.getHttpServer()).post('/admin/schedules/materialization').set('Authorization', `Bearer ${adminToken}`).send({ serviceLineId: ids.line, direction: Direction.IDA, fromDate: '2026-09-14', toDate: '2026-09-20' }).expect(200);
    const second = await request(app.getHttpServer()).post('/admin/schedules/materialization').set('Authorization', `Bearer ${adminToken}`).send({ serviceLineId: ids.line, direction: Direction.IDA, fromDate: '2026-09-14', toDate: '2026-09-20' }).expect(200);
    expect(first.body.created).toBeGreaterThan(0);
    expect(second.body.created).toBe(0);
    expect(second.body.existingSame).toBe(first.body.created);
    await expect(prisma.scheduledDeparture.count({ where: { serviceLineId: ids.line } })).resolves.toBe(first.body.created);
  });

  it('manages a published NO_SERVICE exception without changing regular schedules', async () => {
    const exception = await request(app.getHttpServer()).post(`/admin/schedules/calendars/${calendarId}/exceptions`).set('Authorization', `Bearer ${adminToken}`).send({ serviceDate: '2026-09-19', reason: ServiceExceptionReason.HOLIDAY, effect: ServiceExceptionEffect.NO_SERVICE, description: '8B test holiday' }).expect(201);
    await request(app.getHttpServer()).post(`/admin/schedules/exceptions/${exception.body.id}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const stored = await prisma.serviceException.findUnique({ where: { id: exception.body.id } });
    expect(stored?.status).toBe(ServiceExceptionStatus.PUBLISHED);
  });

  it('configures and materializes ADD_TIMES through the administrative API', async () => {
    const exception = await request(app.getHttpServer()).post(`/admin/schedules/calendars/${calendarId}/exceptions`).set('Authorization', `Bearer ${adminToken}`).send({ serviceDate: '2026-09-18', direction: Direction.IDA, reason: ServiceExceptionReason.EXAM_PERIOD, effect: ServiceExceptionEffect.ADD_TIMES, description: '8B additional departure' }).expect(201);
    const replacement = await request(app.getHttpServer()).post(`/admin/schedules/exceptions/${exception.body.id}/patterns`).set('Authorization', `Bearer ${adminToken}`).send({ direction: Direction.IDA }).expect(201);
    const extraTime = await request(app.getHttpServer()).post(`/admin/schedules/patterns/${replacement.body.id}/times`).set('Authorization', `Bearer ${adminToken}`).send({ departureTime: '08:00:00' }).expect(201);
    const extraJourney = await request(app.getHttpServer()).post(`/admin/schedules/times/${extraTime.body.id}/journeys`).set('Authorization', `Bearer ${adminToken}`).send({ routePathId: ids.path }).expect(201);
    const extraJourneyId = extraJourney.body.journeyTemplates[0].id;
    await request(app.getHttpServer()).put(`/admin/schedules/journeys/${extraJourneyId}/stop-times`).set('Authorization', `Bearer ${adminToken}`).send({ stopTimes: [{ routePathStopId: ids.pathStops[0], offsetMinutes: 0 }, { routePathStopId: ids.pathStops[1], offsetMinutes: 15 }] }).expect(200);
    await request(app.getHttpServer()).post(`/admin/schedules/exceptions/${exception.body.id}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const result = await request(app.getHttpServer()).post('/admin/schedules/materialization').set('Authorization', `Bearer ${adminToken}`).send({ serviceLineId: ids.line, direction: Direction.IDA, fromDate: '2026-09-18', toDate: '2026-09-18' }).expect(200);
    expect(result.body.created).toBe(1);
    expect(result.body.existingSame).toBe(1);
  });
});
