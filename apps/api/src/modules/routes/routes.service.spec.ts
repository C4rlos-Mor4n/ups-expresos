import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RouteStatus } from '@prisma/client';
import { RoutesService } from './routes.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('RoutesService', () => {
  let service: RoutesService;

  let mockRouteFindUnique: jest.Mock;
  let mockRouteCreate: jest.Mock;
  let mockRouteUpdate: jest.Mock;
  let mockRouteFindMany: jest.Mock;
  let mockRouteCount: jest.Mock;
  let mockLogAction: jest.Mock;

  const mockRoute = {
    id: 'route-1',
    name: 'Norte - Salesiana',
    description: 'Ruta norte',
    direction: 'Norte',
    status: RouteStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    mockRouteFindUnique = jest.fn();
    mockRouteCreate = jest.fn();
    mockRouteUpdate = jest.fn();
    mockRouteFindMany = jest.fn();
    mockRouteCount = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      route: {
        findUnique: mockRouteFindUnique,
        create: mockRouteCreate,
        update: mockRouteUpdate,
        count: mockRouteCount,
        findMany: mockRouteFindMany,
      },
    } as unknown as PrismaService;

    const auditMock = {
      logAction: mockLogAction,
    } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
  });

  describe('create', () => {
    it('should create a route and register audit log', async () => {
      mockRouteCreate.mockResolvedValue(mockRoute);

      const dto = { name: 'Norte - Salesiana', direction: 'Norte' };
      const result = await service.create(dto, 'actor-1');

      expect(result.id).toBe('route-1');
      expect(result.name).toBe('Norte - Salesiana');
      expect(result.direction).toBe('Norte');
      expect(result.status).toBe(RouteStatus.ACTIVE);
      expect(result.isActive).toBe(true);
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'CREATE',
        'Route',
        'route-1',
        expect.objectContaining({ name: 'Norte - Salesiana' }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing route', async () => {
      mockRouteFindUnique.mockResolvedValue(mockRoute);
      const updatedRoute = { ...mockRoute, name: 'Sur - Salesiana' };
      mockRouteUpdate.mockResolvedValue(updatedRoute);

      const dto = { name: 'Sur - Salesiana' };
      const result = await service.update('route-1', dto, 'actor-1');

      expect(result.name).toBe('Sur - Salesiana');
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if route does not exist', async () => {
      mockRouteFindUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'X' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated routes', async () => {
      mockRouteFindMany.mockResolvedValue([mockRoute]);
      mockRouteCount.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      mockRouteFindMany.mockResolvedValue([]);
      mockRouteCount.mockResolvedValue(25);

      const result = await service.findAll(1, 10);

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a route by id', async () => {
      mockRouteFindUnique.mockResolvedValue(mockRoute);

      const result = await service.findOne('route-1');

      expect(result.id).toBe('route-1');
      expect(result.name).toBe('Norte - Salesiana');
    });

    it('should throw NotFoundException when route not found', async () => {
      mockRouteFindUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
