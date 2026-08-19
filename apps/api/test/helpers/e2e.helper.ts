import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as crypto from 'node:crypto';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = moduleRef.get<PrismaService>(PrismaService);
  
  return { app, prisma, moduleRef };
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Limpiar en orden para evitar violaciones de FK
  await prisma.tripFeedback.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.session.deleteMany();
  await prisma.authVerificationCode.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.user.deleteMany();
  await prisma.allowedEmailDomain.deleteMany();
}

export async function seedTestDatabase(prisma: PrismaService): Promise<void> {
  // Crear dominios permitidos
  await prisma.allowedEmailDomain.createMany({
    data: [
      { domain: 'ups.edu.ec' },
      { domain: 'est.ups.edu.ec' },
    ],
  });

  // Crear super admin
  await prisma.user.create({
    data: {
      email: 'super@ups.edu.ec',
      role: 'SUPER_ADMIN',
      emailVerified: true,
    },
  });

  // Crear admin
  await prisma.user.create({
    data: {
      email: 'admin@ups.edu.ec',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  // Crear student
  await prisma.user.create({
    data: {
      email: 'student@est.ups.edu.ec',
      role: 'STUDENT',
      emailVerified: true,
    },
  });
}

export function generateOtpHash(code: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(code, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyOtpHash(code: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const testHash = crypto.scryptSync(code, salt, 64).toString('hex');
  return testHash === hash;
}
