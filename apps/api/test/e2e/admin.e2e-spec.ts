import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase, seedTestDatabase } from '../helpers/e2e.helper';

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    await cleanDatabase(prisma);
    await seedTestDatabase(prisma);

    // Login admin
    const adminCodeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send({ email: 'admin@ups.edu.ec' });
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ email: 'admin@ups.edu.ec', code: adminCodeRes.body.devCode });
    adminToken = adminLoginRes.body.accessToken;

    // Login student
    const studentCodeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send({ email: 'student@est.ups.edu.ec' });
    const studentLoginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ email: 'student@est.ups.edu.ec', code: studentCodeRes.body.devCode });
    studentToken = studentLoginRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Roles', () => {
    it('STUDENT cannot access admin routes', async () => {
      return request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Test', direction: 'IDA' })
        .expect(403);
    });

    it('ADMIN can access admin routes', async () => {
      return request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ruta Test', direction: 'IDA' })
        .expect(201);
    });
  });

  describe('Routes', () => {
    let routeId: string;

    it('POST /admin/routes - create route', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ruta Campus Sur', description: 'Ruta principal', direction: 'IDA', status: 'ACTIVE' })
        .expect(201);
      routeId = res.body.id;
      expect(res.body.name).toBe('Ruta Campus Sur');
    });

    it('GET /admin/routes - list routes', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
    });

    it('GET /admin/routes/:id - get route', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.name).toBe('Ruta Campus Sur');
    });

    it('PATCH /admin/routes/:id - update route', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ruta Campus Sur Actualizada' })
        .expect(200);
      expect(res.body.name).toBe('Ruta Campus Sur Actualizada');
    });
  });

  describe('Stops', () => {
    it('POST /admin/stops - create stop', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/stops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Parada Principal', reference: 'Entrada principal', latitude: -2.17, longitude: -79.92 })
        .expect(201);
      expect(res.body.name).toBe('Parada Principal');
    });

    it('POST /admin/stops - reject invalid coordinates', async () => {
      await request(app.getHttpServer())
        .post('/admin/stops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Stop', latitude: 100, longitude: -79.92 })
        .expect(400);
    });

    it('GET /admin/stops - list stops', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/stops')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Route Stops Order', () => {
    let routeId: string;
    let stop1Id: string;
    let stop2Id: string;

    beforeAll(async () => {
      // Crear ruta
      const routeRes = await request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ruta Order Test', direction: 'IDA' });
      routeId = routeRes.body.id;

      // Crear paradas
      const stop1Res = await request(app.getHttpServer())
        .post('/admin/stops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Stop 1', latitude: -2.17, longitude: -79.92 });
      stop1Id = stop1Res.body.id;

      const stop2Res = await request(app.getHttpServer())
        .post('/admin/stops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Stop 2', latitude: -2.18, longitude: -79.93 });
      stop2Id = stop2Res.body.id;
    });

    it('PATCH /admin/routes/:id/stops/order - order stops', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/routes/${routeId}/stops/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stops: [
            { stopId: stop1Id, stopOrder: 1, estimatedArrivalMinutes: 0 },
            { stopId: stop2Id, stopOrder: 2, estimatedArrivalMinutes: 15 },
          ],
        })
        .expect(200);
    });

    it('reject empty stops array', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/routes/${routeId}/stops/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stops: [] })
        .expect(400);
    });

    it('reject duplicate stopIds', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/routes/${routeId}/stops/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stops: [
            { stopId: stop1Id, stopOrder: 1 },
            { stopId: stop1Id, stopOrder: 2 },
          ],
        })
        .expect(400);
    });
  });

  describe('Schedules', () => {
    let routeId: string;

    beforeAll(async () => {
      const routeRes = await request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ruta Schedule Test', direction: 'IDA' });
      routeId = routeRes.body.id;
    });

    it('POST /admin/schedules - create schedule', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ routeId, dayOfWeek: 'MONDAY', direction: 'IDA', departureTime: '07:00', approximateArrivalTime: '07:45' })
        .expect(201);
      expect(res.body.departureTime).toBe('07:00');
    });

    it('POST /admin/schedules - reject invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/admin/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ routeId, dayOfWeek: 'MONDAY', direction: 'IDA', departureTime: '25:00' })
        .expect(400);
    });

    it('GET /admin/schedules - list schedules', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Vehicles', () => {
    it('POST /admin/vehicles - create vehicle', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'TEST-001', code: 'VH-TEST', capacity: 40 })
        .expect(201);
      expect(res.body.plate).toBe('TEST-001');
    });

    it('GET /admin/vehicles - list vehicles', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Drivers', () => {
    it('POST /admin/drivers - create driver', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Conductor Test', phone: '+593999999999' })
        .expect(201);
      expect(res.body.name).toBe('Conductor Test');
    });

    it('GET /admin/drivers - list drivers', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Notices', () => {
    it('POST /admin/notices - create notice', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Aviso Test',
          message: 'Mensaje de prueba',
          severity: 'WARNING',
          publishedFrom: new Date().toISOString(),
        })
        .expect(201);
      expect(res.body.title).toBe('Aviso Test');
    });

    it('POST /admin/notices - reject publishedUntil before publishedFrom', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      await request(app.getHttpServer())
        .post('/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Bad Notice',
          message: 'Invalid dates',
          publishedFrom: now.toISOString(),
          publishedUntil: past.toISOString(),
        })
        .expect(400);
    });

    it('GET /admin/notices - list notices', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
