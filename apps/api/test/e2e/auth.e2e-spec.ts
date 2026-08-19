import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase, seedTestDatabase } from '../helpers/e2e.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    await cleanDatabase(prisma);
    await seedTestDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('POST /auth/request-code', () => {
    it('should reject email from non-allowed domain', async () => {
      return request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'user@gmail.com' })
        .expect(403);
    });

    it('should accept email from allowed domain', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'newuser@est.ups.edu.ec' })
        .expect(201);

      expect(response.body.message).toBeDefined();
      expect(response.body.devCode).toBeDefined(); // AUTH_DEV_EXPOSE_OTP=true en test
    });

    it('should create user with emailVerified=false', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'newuser@est.ups.edu.ec' },
      });
      expect(user).toBeDefined();
      expect(user?.emailVerified).toBe(false);
    });
  });

  describe('POST /auth/verify-code', () => {
    let otpCode: string;

    beforeAll(async () => {
      // Solicitar código
      const response = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'verifytest@est.ups.edu.ec' });
      otpCode = response.body.devCode;
    });

    it('should reject invalid code', async () => {
      return request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'verifytest@est.ups.edu.ec', code: '000000' })
        .expect(401);
    });

    it('should accept valid code and return tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'verifytest@est.ups.edu.ec', code: otpCode })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe('verifytest@est.ups.edu.ec');
      expect(response.body.user.role).toBe('STUDENT');
    });

    it('should mark user as emailVerified', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'verifytest@est.ups.edu.ec' },
      });
      expect(user?.emailVerified).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Login para obtener refresh token
      const codeResponse = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'refreshtest@est.ups.edu.ec' });
      
      await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'refreshtest@est.ups.edu.ec', code: codeResponse.body.devCode });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'refreshtest@est.ups.edu.ec', code: codeResponse.body.devCode });
      
      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.refreshToken).not.toBe(refreshToken); // Rotación
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const codeResponse = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'metest@est.ups.edu.ec' });
      
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'metest@est.ups.edu.ec', code: codeResponse.body.devCode });
      
      accessToken = loginResponse.body.accessToken;
    });

    it('should return current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('metest@est.ups.edu.ec');
      expect(response.body.emailVerified).toBe(true);
    });

    it('should reject without token', async () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const codeResponse = await request(app.getHttpServer())
        .post('/auth/request-code')
        .send({ email: 'logouttest@est.ups.edu.ec' });
      
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/verify-code')
        .send({ email: 'logouttest@est.ups.edu.ec', code: codeResponse.body.devCode });
      
      accessToken = loginResponse.body.accessToken;
      refreshToken = loginResponse.body.refreshToken;
    });

    it('should logout successfully', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(201);
    });

    it('should revoke refresh token', async () => {
      // Intentar usar el refresh token después de logout
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
