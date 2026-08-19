import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RouteStopsService } from './route-stops.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('RouteStopsService', () => {
  let service: RouteStopsService;

  let mockRouteFindUnique: jest.Mock;
  let mockStopFindMany: jest.Mock;
  let mockRouteStopDeleteMany: jest.Mock;
  let mockRouteStopCreateManyAndReturn: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockLogAction: jest.Mock;

  beforeEach(async () => {
    mockRouteFindUnique = jest.fn();
    mockStopFindMany = jest.fn();
    mockRouteStopDeleteMany = jest.fn();
    mockRouteStopCreateManyAndReturn = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    mockTransaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const txProxy = {
        routeStop: {
          deleteMany: mockRouteStopDeleteMany,
          createManyAndReturn: mockRouteStopCreateManyAndReturn,
        },
      };
      return fn(txProxy);
    });

    const prismaMock = {
      route: {
        findUnique: mockRouteFindUnique,
      },
      stop: {
        findMany: mockStopFindMany,
      },
      routeStop: {
        deleteMany: mockRouteStopDeleteMany,
        createManyAndReturn: mockRouteStopCreateManyAndReturn,
      },
      $transaction: mockTransaction,
    } as unknown as PrismaService;

    const auditMock = {
      logAction: mockLogAction,
    } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteStopsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<RouteStopsService>(RouteStopsService);
  });

  describe('orderStops', () => {
    it('should reject empty stops array', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });

      await expect(
        service.orderStops('route-1', { stops: [] }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate stopIds', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });

      const dto = {
        stops: [
          { stopId: 'stop-1', stopOrder: 0 },
          { stopId: 'stop-1', stopOrder: 1 },
        ],
      };

      await expect(
        service.orderStops('route-1', dto, 'actor-1'),
      ).rejects.toThrow('Duplicate stop IDs are not allowed');
    });

    it('should reject duplicate stopOrders', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });

      const dto = {
        stops: [
          { stopId: 'stop-1', stopOrder: 0 },
          { stopId: 'stop-2', stopOrder: 0 },
        ],
      };

      await expect(
        service.orderStops('route-1', dto, 'actor-1'),
      ).rejects.toThrow('Duplicate stop orders are not allowed');
    });

    it('should throw NotFoundException if route does not exist', async () => {
      mockRouteFindUnique.mockResolvedValue(null);

      await expect(
        service.orderStops('bad-route', { stops: [{ stopId: 'stop-1', stopOrder: 0 }] }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should execute transaction and create route stops', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });

      mockStopFindMany.mockResolvedValue([
        { id: 'stop-1' },
        { id: 'stop-2' },
      ]);

      const mockRouteStops = [
        { id: 'rs-1', routeId: 'route-1', stopId: 'stop-1', stopOrder: 0, estimatedArrivalMinutes: null, notes: null },
        { id: 'rs-2', routeId: 'route-1', stopId: 'stop-2', stopOrder: 1, estimatedArrivalMinutes: 15, notes: null },
      ];

      mockRouteStopDeleteMany.mockResolvedValue({ count: 0 });
      mockRouteStopCreateManyAndReturn.mockResolvedValue(mockRouteStops);

      const dto = {
        stops: [
          { stopId: 'stop-1', stopOrder: 0 },
          { stopId: 'stop-2', stopOrder: 1, estimatedArrivalMinutes: 15 },
        ],
      };

      const result = await service.orderStops('route-1', dto, 'actor-1');

      expect(result).toHaveLength(2);
      expect(mockRouteStopDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { routeId: 'route-1' } }),
      );
      expect(mockRouteStopCreateManyAndReturn).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'ORDER_STOPS',
        'Route',
        'route-1',
        expect.objectContaining({ stopCount: 2 }),
      );
    });

    it('should reject stopIds that do not exist in DB', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockStopFindMany.mockResolvedValue([{ id: 'stop-1' }]);

      const dto = {
        stops: [
          { stopId: 'stop-1', stopOrder: 0 },
          { stopId: 'stop-nonexistent', stopOrder: 1 },
        ],
      };

      await expect(
        service.orderStops('route-1', dto, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
