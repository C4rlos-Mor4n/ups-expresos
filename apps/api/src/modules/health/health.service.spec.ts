import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../../database/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({ appName: 'Test App' }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('check returns ok', () => {
    const result = service.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('Test App');
  });

  it('checkDb returns connected when query succeeds', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '1': 1 }]);

    await expect(service.checkDb()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('checkDb throws ServiceUnavailableException when query fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(service.checkDb()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
