import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn().mockReturnValue({ status: 'ok' }),
            checkDb: jest.fn().mockResolvedValue({ status: 'ok', database: 'connected' }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should return health status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
    expect(service.check).toHaveBeenCalled();
  });

  it('should return db health status', async () => {
    await expect(controller.checkDb()).resolves.toEqual({ status: 'ok', database: 'connected' });
  });
});
