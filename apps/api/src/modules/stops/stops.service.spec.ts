import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StopsService } from './stops.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('StopsService', () => {
  let service: StopsService;

  let mockStopFindUnique: jest.Mock;
  let mockStopCreate: jest.Mock;
  let mockStopUpdate: jest.Mock;
  let mockStopFindMany: jest.Mock;
  let mockStopCount: jest.Mock;
  let mockLogAction: jest.Mock;

  // Simula el tipo Decimal de Prisma con toNumber()
  function mockDecimal(value: number): { toNumber: () => number } {
    return { toNumber: () => value };
  }

  const mockStop = {
    id: 'stop-1',
    name: 'Parque de la Madre',
    reference: 'Av. 12 de Abril',
    latitude: mockDecimal(-2.8975),
    longitude: mockDecimal(-79.0045),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    mockStopFindUnique = jest.fn();
    mockStopCreate = jest.fn();
    mockStopUpdate = jest.fn();
    mockStopFindMany = jest.fn();
    mockStopCount = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      stop: {
        findUnique: mockStopFindUnique,
        create: mockStopCreate,
        update: mockStopUpdate,
        count: mockStopCount,
        findMany: mockStopFindMany,
      },
    } as unknown as PrismaService;

    const auditMock = {
      logAction: mockLogAction,
    } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<StopsService>(StopsService);
  });

  describe('create', () => {
    it('should create a stop and register audit log', async () => {
      mockStopCreate.mockResolvedValue(mockStop);

      const dto = {
        name: 'Parque de la Madre',
        reference: 'Av. 12 de Abril',
        latitude: -2.8975,
        longitude: -79.0045,
      };
      const result = await service.create(dto, 'actor-1');

      expect(result.id).toBe('stop-1');
      expect(result.name).toBe('Parque de la Madre');
      expect(result.latitude).toBe(-2.8975);
      expect(result.longitude).toBe(-79.0045);
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'CREATE',
        'Stop',
        'stop-1',
        expect.objectContaining({ name: 'Parque de la Madre' }),
      );
    });

    it('should pass latitude and longitude to prisma as provided', async () => {
      mockStopCreate.mockResolvedValue(mockStop);

      const dto = {
        name: 'Test Stop',
        latitude: -90,
        longitude: -180,
      };
      await service.create(dto, 'actor-1');

      expect(mockStopCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: -90,
            longitude: -180,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a stop by id', async () => {
      mockStopFindUnique.mockResolvedValue(mockStop);

      const result = await service.findOne('stop-1');

      expect(result.id).toBe('stop-1');
      expect(result.latitude).toBe(-2.8975);
    });

    it('should throw NotFoundException when stop not found', async () => {
      mockStopFindUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated stops', async () => {
      mockStopFindMany.mockResolvedValue([mockStop]);
      mockStopCount.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('update', () => {
    it('should update an existing stop', async () => {
      mockStopFindUnique.mockResolvedValue(mockStop);
      const updatedStop = { ...mockStop, name: 'Nueva Parada' };
      mockStopUpdate.mockResolvedValue(updatedStop);

      const result = await service.update('stop-1', { name: 'Nueva Parada' }, 'actor-1');

      expect(result.name).toBe('Nueva Parada');
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if stop does not exist', async () => {
      mockStopFindUnique.mockResolvedValue(null);

      await expect(
        service.update('bad-id', { name: 'X' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
