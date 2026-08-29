import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from './mail/mail.service';
import { AppConfig } from '../../config/app.config';

// Configuración mock reutilizable
function buildAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    nodeEnv: 'test',
    port: 3000,
    appName: 'test-app',
    database: { url: 'postgresql://test' },
    jwt: {
      accessSecret: 'access-secret',
      refreshSecret: 'refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    otp: { expiresMinutes: 5, maxAttempts: 3 },
    auth: {
      devExposeOtp: false,
      allowedDomains: ['est.ups.edu.ec', 'ups.edu.ec', 'gmail.com'],
      superAdminEmails: ['super@admin.com'],
    },
    cors: { origins: ['*'] },
    trustProxyHops: 0,
    swagger: { enabled: false, path: '/docs' },
    throttle: {
      ttl: 60000,
      limit: 10,
      auth: { ttl: 60000, limit: 3 },
    },
    smtp: {
      secure: false,
    },
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;

  // Mocks con tipos explicitos para evitar noUncheckedIndexedAccess
  let mockUserUpsert: jest.Mock;
  let mockUserFindUnique: jest.Mock;
  let mockUserCreate: jest.Mock;
  let mockUserUpdate: jest.Mock;
  let mockOtpFindFirst: jest.Mock;
  let mockOtpCreate: jest.Mock;
  let mockOtpUpdate: jest.Mock;
  let mockOtpUpsert: jest.Mock;
  let mockOtpUpdateMany: jest.Mock;
  let mockOtpDeleteMany: jest.Mock;
  let mockSessionFindUnique: jest.Mock;
  let mockSessionCreate: jest.Mock;
  let mockSessionUpdate: jest.Mock;
  let mockSessionUpdateMany: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockSignAsync: jest.Mock;
  let mockVerifyAsync: jest.Mock;
  let mockDecode: jest.Mock;
  let mockConfigGet: jest.Mock;
  let mockSendOtp: jest.Mock;

  let appConfig: AppConfig;

  beforeEach(async () => {
    appConfig = buildAppConfig();

    // Inicializar todos los mocks
    mockUserUpsert = jest.fn();
    mockUserFindUnique = jest.fn();
    mockUserCreate = jest.fn();
    mockUserUpdate = jest.fn();
    mockOtpFindFirst = jest.fn();
    mockOtpCreate = jest.fn();
    mockOtpUpdate = jest.fn();
    mockOtpUpsert = jest.fn();
    mockOtpUpdateMany = jest.fn();
    mockOtpDeleteMany = jest.fn();
    mockSessionFindUnique = jest.fn();
    mockSessionCreate = jest.fn();
    mockSessionUpdate = jest.fn();
    mockSessionUpdateMany = jest.fn();
    mockSignAsync = jest.fn().mockResolvedValue('mock-token');
    mockVerifyAsync = jest.fn();
    mockDecode = jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 86400 });
    mockConfigGet = jest.fn().mockReturnValue(appConfig);
    mockSendOtp = jest.fn().mockResolvedValue(undefined);

    mockTransaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const txProxy = {
        user: {
          upsert: mockUserUpsert,
        },
        authVerificationCode: {
          upsert: mockOtpUpsert,
        },
      };
      return fn(txProxy);
    });

    const prismaMock = {
      user: {
        findUnique: mockUserFindUnique,
        create: mockUserCreate,
        update: mockUserUpdate,
        upsert: mockUserUpsert,
      },
      authVerificationCode: {
        findFirst: mockOtpFindFirst,
        create: mockOtpCreate,
        update: mockOtpUpdate,
        upsert: mockOtpUpsert,
        updateMany: mockOtpUpdateMany,
        deleteMany: mockOtpDeleteMany,
      },
      session: {
        findUnique: mockSessionFindUnique,
        create: mockSessionCreate,
        update: mockSessionUpdate,
        updateMany: mockSessionUpdateMany,
      },
      $transaction: mockTransaction,
    };

    const jwtMock = {
      signAsync: mockSignAsync,
      verifyAsync: mockVerifyAsync,
      decode: mockDecode,
    };

    const configMock = {
      get: mockConfigGet,
    };

    const mailMock = {
      sendOtp: mockSendOtp,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── requestCode ───────────────────────────────────────────────

  describe('requestCode', () => {
    it('should reject email from non-allowed domain', async () => {
      await expect(
        service.requestCode({ email: 'user@yahoo.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept super admin email regardless of domain', async () => {
      mockUserUpsert.mockResolvedValue({
        id: 'user-1',
        email: 'super@admin.com',
        role: UserRole.STUDENT,
        emailVerified: false,
        isActive: true,
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.requestCode({ email: 'super@admin.com' });

      expect(result.message).toBe('Verification code sent');
      expect(mockUserUpsert).toHaveBeenCalled();
    });

    it('should accept email from allowed domain and create hashed OTP', async () => {
      mockUserUpsert.mockResolvedValue({
        id: 'user-1',
        email: 'student@est.ups.edu.ec',
        role: UserRole.STUDENT,
        emailVerified: false,
        isActive: true,
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.requestCode({ email: 'student@est.ups.edu.ec' });

      expect(result.message).toBe('Verification code sent');
      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'student@est.ups.edu.ec' },
        }),
      );
      expect(mockOtpUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'student@est.ups.edu.ec' },
          create: expect.objectContaining({
            email: 'student@est.ups.edu.ec',
            codeHash: expect.stringContaining(':'),
          }),
        }),
      );
      expect(mockSendOtp).toHaveBeenCalled();
    });

    it('should create user via upsert if not exists', async () => {
      mockUserUpsert.mockResolvedValue({
        id: 'new-user',
        email: 'new@ups.edu.ec',
        role: UserRole.STUDENT,
        emailVerified: false,
        isActive: true,
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.requestCode({ email: 'new@ups.edu.ec' });

      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            email: 'new@ups.edu.ec',
            role: UserRole.STUDENT,
          }),
        }),
      );
    });

    it('should expose devCode when devExposeOtp is true', async () => {
      const devConfig = buildAppConfig({
        auth: { ...appConfig.auth, devExposeOtp: true },
      });
      mockConfigGet.mockReturnValue(devConfig);

      mockUserUpsert.mockResolvedValue({
        id: 'user-1',
        email: 'dev@ups.edu.ec',
        role: UserRole.STUDENT,
        emailVerified: false,
        isActive: true,
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.requestCode({ email: 'dev@ups.edu.ec' });

      expect(result.devCode).toBeDefined();
      expect(result.devCode).toHaveLength(6);
    });
  });

  // ─── verifyCode ────────────────────────────────────────────────

  describe('verifyCode', () => {
    it('should reject when no verification code exists', async () => {
      mockOtpFindFirst.mockResolvedValue(null);

      await expect(
        service.verifyCode({ email: 'user@ups.edu.ec', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when max attempts exceeded', async () => {
      mockOtpFindFirst.mockResolvedValue({
        id: 'otp-1',
        email: 'user@ups.edu.ec',
        codeHash: 'salt:hash',
        attempts: 3,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.verifyCode({ email: 'user@ups.edu.ec', code: '123456' }),
      ).rejects.toThrow('Maximum verification attempts exceeded');
    });

    it('should reject incorrect code and increment attempts', async () => {
      const crypto = require('node:crypto');
      const salt = 'test-salt';
      const realHash = crypto.scryptSync('999999', salt, 32).toString('hex');
      const codeHash = `${salt}:${realHash}`;

      mockOtpFindFirst.mockResolvedValue({
        id: 'otp-1',
        email: 'user@ups.edu.ec',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.verifyCode({ email: 'user@ups.edu.ec', code: '000000' }),
      ).rejects.toThrow('Invalid verification code');

      expect(mockOtpUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { attempts: { increment: 1 } },
        }),
      );
    });

    it('should accept correct code and create session with tokens', async () => {
      const crypto = require('node:crypto');
      const salt = 'test-salt';
      const realHash = crypto.scryptSync('123456', salt, 32).toString('hex');
      const codeHash = `${salt}:${realHash}`;

      mockOtpFindFirst.mockResolvedValue({
        id: 'otp-1',
        email: 'user@ups.edu.ec',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        createdAt: new Date(),
      });

      const mockUser = {
        id: 'user-1',
        email: 'user@ups.edu.ec',
        name: null,
        role: UserRole.STUDENT,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      mockOtpUpdateMany.mockResolvedValue({ count: 1 });

      mockSessionCreate.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'pending',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      });

      mockSessionUpdate.mockResolvedValue({});

      const result = await service.verifyCode({
        email: 'user@ups.edu.ec',
        code: '123456',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.id).toBe('user-1');
      expect(mockOtpUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'otp-1', usedAt: null },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
    });

    it('should reject deactivated user', async () => {
      const crypto = require('node:crypto');
      const salt = 'test-salt';
      const realHash = crypto.scryptSync('123456', salt, 32).toString('hex');
      const codeHash = `${salt}:${realHash}`;

      mockOtpFindFirst.mockResolvedValue({
        id: 'otp-1',
        email: 'user@ups.edu.ec',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        createdAt: new Date(),
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@ups.edu.ec',
        name: null,
        role: UserRole.STUDENT,
        emailVerified: true,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.verifyCode({ email: 'user@ups.edu.ec', code: '123456' }),
      ).rejects.toThrow('User is deactivated');
    });
  });

  // ─── refresh ───────────────────────────────────────────────────

  describe('refresh', () => {
    it('should reject invalid refresh token', async () => {
      mockVerifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject revoked session', async () => {
      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
        type: 'refresh',
      });

      mockSessionFindUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // revocada
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'user@ups.edu.ec',
          name: null,
          role: UserRole.STUDENT,
          emailVerified: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        service.refresh({ refreshToken: 'some-token' }),
      ).rejects.toThrow('Session expired or revoked');
    });

    it('should create new session and revoke old one on valid refresh', async () => {
      const crypto = require('node:crypto');
      const tokenHash = crypto.createHash('sha256').update('valid-token').digest('hex');

      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
        type: 'refresh',
      });

      const mockUser = {
        id: 'user-1',
        email: 'user@ups.edu.ec',
        name: null,
        role: UserRole.STUDENT,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionFindUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        user: mockUser,
      });

      mockSessionCreate.mockResolvedValue({
        id: 'session-2',
        userId: 'user-1',
        refreshTokenHash: 'pending',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      });

      mockSessionUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.refresh({ refreshToken: 'valid-token' });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      // La sesion vieja debe ser revocada de forma atomica
      expect(mockSessionUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1', revokedAt: null },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should reject deactivated user on refresh', async () => {
      const crypto = require('node:crypto');
      const tokenHash = crypto.createHash('sha256').update('valid-token').digest('hex');

      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
        type: 'refresh',
      });

      mockSessionFindUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'user@ups.edu.ec',
          name: null,
          role: UserRole.STUDENT,
          emailVerified: true,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        service.refresh({ refreshToken: 'valid-token' }),
      ).rejects.toThrow('User is deactivated');
    });
  });
});
