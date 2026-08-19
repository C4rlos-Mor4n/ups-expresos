import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase, seedTestDatabase } from '../helpers/e2e.helper';

describe('TripFeedback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentToken: string;
  let routeId: string;

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

    // Crear ruta con admin
    const adminCodeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send({ email: 'admin@ups.edu.ec' });
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ email: 'admin@ups.edu.ec', code: adminCodeRes.body.devCode });
    const adminToken = adminLoginRes.body.accessToken;

    const routeRes = await request(app.getHttpServer())
      .post('/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ruta Feedback Test', direction: 'IDA' });
    routeId = routeRes.body.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('POST /trip-feedback', () => {
    it('should create feedback', async () => {
      const res = await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 5, comment: 'Excelente servicio' })
        .expect(201);
      expect(res.body.rating).toBe(5);
      expect(res.body.comment).toBe('Excelente servicio');
    });

    it('should reject rating < 1', async () => {
      await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 0 })
        .expect(400);
    });

    it('should reject rating > 5', async () => {
      await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 6 })
        .expect(400);
    });

    it('should reject non-existent route', async () => {
      await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId: '00000000-0000-0000-0000-000000000000', rating: 4 })
        .expect(404);
    });
  });

  describe('GET /trip-feedback', () => {
    beforeAll(async () => {
      // Crear varios feedbacks
      await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 4 });
      await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 3 });
    });

    it('should list feedback with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
    });

    it('should filter by routeId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/trip-feedback?routeId=${routeId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /trip-feedback/:id', () => {
    let feedbackId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/trip-feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ routeId, rating: 5 });
      feedbackId = res.body.id;
    });

    it('should return feedback by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/trip-feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.id).toBe(feedbackId);
    });

    it('should return 404 for non-existent feedback', async () => {
      await request(app.getHttpServer())
        .get('/trip-feedback/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
