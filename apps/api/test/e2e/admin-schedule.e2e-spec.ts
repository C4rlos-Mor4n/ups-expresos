import { INestApplication } from '@nestjs/common';
import { Direction, Weekday } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from '../helpers/e2e.helper';

jest.setTimeout(30_000);

describe('Admin schedule management (e2e)', () => {
  const ids = {
    campus: randomUUID(),
    line: randomUUID(),
    path: randomUUID(),
    stops: [randomUUID(), randomUUID()],
    pathStops: [randomUUID(), randomUUID()],
    admin: randomUUID(),
    student: randomUUID(),
  };
  const adminEmail = `8b-e2e-admin-${ids.admin}@ups.edu.ec`;
  const studentEmail = `8b-e2e-student-${ids.student}@est.ups.edu.ec`;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let calendarId: string;
  let journeyId: string;

  const http = () => request(app.getHttpServer());

  async function loginWithOtp(email: string, forwardedFor: string): Promise<string> {
    const requested = await http()
      .post('/auth/request-code')
      .set('X-Forwarded-For', forwardedFor)
      .send({ email })
      .expect(201);
    expect(requested.body.devCode).toBeDefined();

    const verified = await http()
      .post('/auth/verify-code')
      .send({ email, code: requested.body.devCode })
      .expect(201);
    expect(verified.body.accessToken).toBeDefined();
    return verified.body.accessToken as string;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;

    await cleanDatabase(prisma);
    await prisma.campus.create({
      data: { id: ids.campus, code: `8B-E2E-${ids.campus.slice(0, 8)}`, name: '8B E2E Campus' },
    });
    await prisma.serviceLine.create({
      data: { id: ids.line, campusId: ids.campus, code: `8B-E2E-${ids.line.slice(0, 8)}`, name: '8B E2E Line' },
    });
    await prisma.routePath.create({
      data: { id: ids.path, serviceLineId: ids.line, code: `8B-E2E-${ids.path.slice(0, 8)}`, displayName: '8B E2E Ida', direction: Direction.IDA },
    });
    await prisma.stop.createMany({
      data: ids.stops.map((id, index) => ({ id, name: `8B E2E Stop ${index + 1}`, latitude: -2.1, longitude: -79.9 })),
    });
    await prisma.routePathStop.createMany({
      data: ids.pathStops.map((id, index) => ({ id, routePathId: ids.path, stopId: ids.stops[index]!, stopOrder: index + 1 })),
    });
    await prisma.user.createMany({
      data: [
        { id: ids.admin, email: adminEmail, role: 'ADMIN', emailVerified: true },
        { id: ids.student, email: studentEmail, role: 'STUDENT', emailVerified: true },
      ],
    });

    // The administrator context is obtained through the public OTP flow, not a bypass token.
    adminToken = await loginWithOtp(adminEmail, '198.51.100.80');
    const jwt = testApp.moduleRef.get(JwtService);
    studentToken = jwt.sign({ sub: ids.student, email: studentEmail, role: 'STUDENT' });
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanDatabase(prisma);
    await app?.close();
  });

  it('creates, publishes, queries and materializes a schedule idempotently', async () => {
    await http()
      .get('/admin/schedules/calendars')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    const calendar = await http()
      .post('/admin/schedules/calendars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceLineId: ids.line, name: '8B E2E Calendar', validFrom: '2026-09-14', validUntil: '2026-09-20' })
      .expect(201);
    calendarId = calendar.body.id as string;

    const pattern = await http()
      .post(`/admin/schedules/calendars/${calendarId}/patterns`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ direction: Direction.IDA })
      .expect(201);
    await http()
      .put(`/admin/schedules/patterns/${pattern.body.id}/days`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY] })
      .expect(200);

    const time = await http()
      .post(`/admin/schedules/patterns/${pattern.body.id}/times`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departureTime: '06:40:00' })
      .expect(201);
    const journey = await http()
      .post(`/admin/schedules/times/${time.body.id}/journeys`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ routePathId: ids.path })
      .expect(201);
    journeyId = journey.body.journeyTemplates[0].id as string;

    await http()
      .put(`/admin/schedules/journeys/${journeyId}/stop-times`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stopTimes: [
        { routePathStopId: ids.pathStops[0], offsetMinutes: 0 },
        { routePathStopId: ids.pathStops[1], offsetMinutes: 15 },
      ] })
      .expect(200);
    await http()
      .post(`/admin/schedules/calendars/${calendarId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const timetable = await http()
      .get(`/admin/schedules/timetable?calendarId=${calendarId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(timetable.body).toHaveLength(1);

    const materialize = {
      serviceLineId: ids.line,
      direction: Direction.IDA,
      fromDate: '2026-09-14',
      toDate: '2026-09-20',
    };
    const first = await http()
      .post('/admin/schedules/materialization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(materialize)
      .expect(200);
    const second = await http()
      .post('/admin/schedules/materialization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(materialize)
      .expect(200);

    expect(first.body.created).toBeGreaterThan(0);
    expect(second.body.created).toBe(0);
    expect(second.body.existingSame).toBe(first.body.created);
    await expect(prisma.scheduledDeparture.count({ where: { serviceLineId: ids.line } }))
      .resolves.toBe(first.body.created);
  });
});
