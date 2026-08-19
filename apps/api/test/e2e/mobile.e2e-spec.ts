import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase, seedTestDatabase } from '../helpers/e2e.helper';

describe('Mobile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentToken: string;
  let routeId: string;
  let stopId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    await cleanDatabase(prisma);
    await seedTestDatabase(prisma);

    // Login student
    const codeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send({ email: 'student@est.ups.edu.ec' });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ email: 'student@est.ups.edu.ec', code: codeRes.body.devCode });
    studentToken = loginRes.body.accessToken;

    // Crear datos de prueba con admin
    const adminCodeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send({ email: 'admin@ups.edu.ec' });
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ email: 'admin@ups.edu.ec', code: adminCodeRes.body.devCode });
    const adminToken = adminLoginRes.body.accessToken;

    // Crear ruta activa
    const routeRes = await request(app.getHttpServer())
      .post('/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ruta Mobile Test', direction: 'IDA', status: 'ACTIVE', isActive: true });
    routeId = routeRes.body.id;

    // Crear parada
    const stopRes = await request(app.getHttpServer())
      .post('/admin/stops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Parada Mobile', latitude: -2.17, longitude: -79.92 });
    stopId = stopRes.body.id;

    // Ordenar paradas
    await request(app.getHttpServer())
      .patch(`/admin/routes/${routeId}/stops/order`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stops: [{ stopId, stopOrder: 1 }] });

    // Crear horario
    await request(app.getHttpServer())
      .post('/admin/schedules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ routeId, dayOfWeek: 'MONDAY', direction: 'IDA', departureTime: '07:00' });

    // Crear aviso activo
    await request(app.getHttpServer())
      .post('/admin/notices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Aviso Mobile',
        message: 'Mensaje mobile',
        publishedFrom: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
        publishedUntil: new Date(Date.now() + 86400000).toISOString(), // 1 día adelante
      });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('GET /mobile/routes', () => {
    it('should return active routes', async () => {
      const res = await request(app.getHttpServer())
        .get('/mobile/routes')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].isActive).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/mobile/routes?status=ACTIVE')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should search by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/mobile/routes?search=Mobile')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /mobile/routes/:id', () => {
    it('should return route detail with stops and schedules', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mobile/routes/${routeId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.name).toBe('Ruta Mobile Test');
      expect(res.body.stops).toBeDefined();
      expect(res.body.schedules).toBeDefined();
    });

    it('should return 404 for inactive route', async () => {
      // Crear ruta inactiva
      const adminCodeRes = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'admin@ups.edu.ec' });
      const adminLoginRes = await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'admin@ups.edu.ec', code: adminCodeRes.body.devCode });
      const adminToken = adminLoginRes.body.accessToken;

      const inactiveRouteRes = await request(app.getHttpServer())
        .post('/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Inactive Route', direction: 'IDA', isActive: false });
      const inactiveRouteId = inactiveRouteRes.body.id;

      await request(app.getHttpServer())
        .get(`/mobile/routes/${inactiveRouteId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });

  describe('GET /mobile/routes/:id/stops', () => {
    it('should return ordered stops', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mobile/routes/${routeId}/stops`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].stopOrder).toBe(1);
    });
  });

  describe('GET /mobile/routes/:id/schedules', () => {
    it('should return active schedules', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mobile/routes/${routeId}/schedules`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should filter by dayOfWeek', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mobile/routes/${routeId}/schedules?dayOfWeek=MONDAY`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /mobile/notices', () => {
    it('should return active notices', async () => {
      const res = await request(app.getHttpServer())
        .get('/mobile/notices')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
