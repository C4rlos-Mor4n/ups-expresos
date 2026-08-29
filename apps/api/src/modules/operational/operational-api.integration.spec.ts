import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { createTestApp } from '../../../test/helpers/e2e.helper';
import * as request from 'supertest';

const integrationEnabled = process.env['RUN_PHASE_6_API_INTEGRATION'] === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const ids = {
  campus: randomUUID(),
  line: randomUUID(),
  calendar: randomUUID(),
  pattern: randomUUID(),
  scheduleTime: randomUUID(),
  routePath: randomUUID(),
  stop: randomUUID(),
  routePathStop: randomUUID(),
  journey: randomUUID(),
  departure: randomUUID(),
  vehicle: randomUUID(),
  driverUser: randomUUID(),
  otherDriverUser: randomUUID(),
  driver: randomUUID(),
  otherDriver: randomUUID(),
  admin: randomUUID(),
  student: randomUUID(),
};

const civilDate = new Date('2026-09-01T00:00:00.000Z');
const localTime = new Date('1970-01-01T06:40:00.000Z');

describeIntegration('Phase 6 operational API integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let driverToken: string;
  let otherDriverToken: string;
  let assignmentId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    const jwt = testApp.moduleRef.get(JwtService);

    await prisma.campus.create({ data: { id: ids.campus, code: `P6API-${ids.campus.slice(0, 8)}`, name: 'P6 API Campus' } });
    await prisma.serviceLine.create({ data: { id: ids.line, campusId: ids.campus, code: `P6API-${ids.line.slice(0, 8)}`, name: 'P6 API Line' } });
    await prisma.serviceCalendar.create({ data: { id: ids.calendar, serviceLineId: ids.line, name: 'P6 API calendar', validFrom: civilDate, validUntil: new Date('2026-09-30T00:00:00.000Z'), status: 'PUBLISHED' } });
    await prisma.schedulePattern.create({ data: { id: ids.pattern, serviceCalendarId: ids.calendar, direction: 'IDA', status: 'PUBLISHED' } });
    await prisma.scheduleTime.create({ data: { id: ids.scheduleTime, schedulePatternId: ids.pattern, departureTime: localTime } });
    await prisma.stop.create({ data: { id: ids.stop, name: `P6 API Stop ${ids.stop.slice(0, 8)}`, latitude: -2.17, longitude: -79.92 } });
    await prisma.routePath.create({ data: { id: ids.routePath, serviceLineId: ids.line, code: `P6API-${ids.routePath.slice(0, 8)}`, displayName: 'P6 API Journey', direction: 'IDA' } });
    await prisma.routePathStop.create({ data: { id: ids.routePathStop, routePathId: ids.routePath, stopId: ids.stop, stopOrder: 1 } });
    await prisma.scheduleJourneyTemplate.create({ data: { id: ids.journey, scheduleTimeId: ids.scheduleTime, routePathId: ids.routePath } });
    await prisma.scheduledStopTime.create({ data: { journeyTemplateId: ids.journey, routePathStopId: ids.routePathStop, offsetMinutes: 40 } });
    await prisma.scheduledDeparture.create({ data: { id: ids.departure, sourceScheduleTimeId: ids.scheduleTime, serviceCalendarId: ids.calendar, serviceLineId: ids.line, serviceDate: civilDate, scheduledTime: localTime, direction: 'IDA', source: 'REGULAR' } });
    await prisma.vehicle.create({ data: { id: ids.vehicle, code: `P6API${ids.vehicle.slice(0, 6)}`, plate: `P6AP${ids.vehicle.slice(0, 6)}`, capacity: 30 } });
    await prisma.user.createMany({ data: [
      { id: ids.admin, email: `p6-admin-${ids.admin}@ups.edu.ec`, role: 'ADMIN', emailVerified: true },
      { id: ids.student, email: `p6-student-${ids.student}@est.ups.edu.ec`, role: 'STUDENT', emailVerified: true },
      { id: ids.driverUser, email: `p6-driver-${ids.driverUser}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
      { id: ids.otherDriverUser, email: `p6-driver-${ids.otherDriverUser}@ups.edu.ec`, role: 'DRIVER', emailVerified: true },
    ] });
    await prisma.driver.createMany({ data: [
      { id: ids.driver, userId: ids.driverUser, name: 'P6 API Driver' },
      { id: ids.otherDriver, userId: ids.otherDriverUser, name: 'P6 API Other Driver' },
    ] });

    const sign = (id: string, email: string, role: string): string => jwt.sign({ sub: id, email, role });
    adminToken = sign(ids.admin, `p6-admin-${ids.admin}@ups.edu.ec`, 'ADMIN');
    studentToken = sign(ids.student, `p6-student-${ids.student}@est.ups.edu.ec`, 'STUDENT');
    driverToken = sign(ids.driverUser, `p6-driver-${ids.driverUser}@ups.edu.ec`, 'DRIVER');
    otherDriverToken = sign(ids.otherDriverUser, `p6-driver-${ids.otherDriverUser}@ups.edu.ec`, 'DRIVER');
  });

  afterAll(async () => {
    try {
      await prisma.serviceRun.deleteMany({ where: { serviceAssignment: { scheduledDepartureId: ids.departure } } });
      await prisma.serviceAssignment.deleteMany({ where: { scheduledDepartureId: ids.departure } });
      await prisma.scheduledDeparture.delete({ where: { id: ids.departure } });
      await prisma.scheduledStopTime.deleteMany({ where: { journeyTemplateId: ids.journey } });
      await prisma.scheduleJourneyTemplate.delete({ where: { id: ids.journey } });
      await prisma.routePathStop.delete({ where: { id: ids.routePathStop } });
      await prisma.routePath.delete({ where: { id: ids.routePath } });
      await prisma.scheduleTime.delete({ where: { id: ids.scheduleTime } });
      await prisma.schedulePattern.delete({ where: { id: ids.pattern } });
      await prisma.serviceCalendar.delete({ where: { id: ids.calendar } });
      await prisma.serviceLine.delete({ where: { id: ids.line } });
      await prisma.campus.delete({ where: { id: ids.campus } });
      await prisma.driver.deleteMany({ where: { id: { in: [ids.driver, ids.otherDriver] } } });
      await prisma.vehicle.delete({ where: { id: ids.vehicle } });
      await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.student, ids.driverUser, ids.otherDriverUser] } } });
      await prisma.stop.delete({ where: { id: ids.stop } });
    } finally {
      await app.close();
    }
  });

  it('enforces admin RBAC and creates a planned assignment through the public contract', async () => {
    await request(app.getHttpServer())
      .post('/admin/operational/service-assignments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ scheduledDepartureId: ids.departure, vehicleId: ids.vehicle, driverId: ids.driver, journeyTemplateId: ids.journey })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/admin/operational/service-assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scheduledDepartureId: ids.departure, vehicleId: ids.vehicle, driverId: ids.driver, journeyTemplateId: ids.journey })
      .expect(201);
    assignmentId = response.body.id;
    expect(response.body.departure.id).toBe(ids.departure);
    expect(response.body.operation).toBeNull();
  });

  it('serves the student product flow without driver private fields', async () => {
    await request(app.getHttpServer())
      .get('/student/campuses')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/student/campuses/${ids.campus}/service-lines`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const departures = await request(app.getHttpServer())
      .get(`/student/service-lines/${ids.line}/departures?date=2026-09-01&direction=IDA`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(departures.body[0].state).toBe('ASSIGNED');

    const detail = await request(app.getHttpServer())
      .get(`/student/scheduled-departures/${ids.departure}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(detail.body.assignments).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toContain('phone');
    expect(JSON.stringify(detail.body)).not.toContain('userId');
  });

  it('binds driver operations to the authenticated Driver.userId and makes start/finish stable', async () => {
    await request(app.getHttpServer())
      .get(`/driver/operational/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${otherDriverToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/driver/operational/assignments/${assignmentId}/start`)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    const current = await request(app.getHttpServer())
      .get('/driver/operational/service-runs/current')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    expect(current.body.run.status).toBe('IN_PROGRESS');

    await request(app.getHttpServer())
      .post(`/driver/operational/service-runs/${current.body.run.id}/finish`)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
  });
});
