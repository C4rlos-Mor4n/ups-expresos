import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RouteStatus, ScheduleStatus, DayOfWeek, NoticeSeverity } from '@prisma/client';
import { MobileService } from './mobile.service';
import { PrismaService } from '../../database/prisma.service';

describe('MobileService', () => {
  let service: MobileService;

  let mockRouteFindUnique: jest.Mock;
  let mockRouteFindFirst: jest.Mock;
  let mockRouteFindMany: jest.Mock;
  let mockRouteCount: jest.Mock;
  let mockRouteStopFindMany: jest.Mock;
  let mockScheduleFindMany: jest.Mock;
  let mockNoticeFindMany: jest.Mock;
  let mockNoticeCount: jest.Mock;
  let mockTripFindFirst: jest.Mock;
  let mockRouteAssignmentFindFirst: jest.Mock;

  function mockDecimal(value: number): { toNumber: () => number } {
    return { toNumber: () => value };
  }

  const mockActiveRoute = {
    id: 'route-1',
    name: 'Norte',
    description: 'Ruta norte',
    direction: 'Norte',
    status: RouteStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    mockRouteFindUnique = jest.fn();
    mockRouteFindFirst = jest.fn();
    mockRouteFindMany = jest.fn();
    mockRouteCount = jest.fn();
    mockRouteStopFindMany = jest.fn();
    mockScheduleFindMany = jest.fn();
    mockNoticeFindMany = jest.fn();
    mockNoticeCount = jest.fn();
    mockTripFindFirst = jest.fn();
    mockRouteAssignmentFindFirst = jest.fn();

    const prismaMock = {
      route: {
        findUnique: mockRouteFindUnique,
        findFirst: mockRouteFindFirst,
        findMany: mockRouteFindMany,
        count: mockRouteCount,
      },
      routeStop: {
        findMany: mockRouteStopFindMany,
      },
      schedule: {
        findMany: mockScheduleFindMany,
      },
      notice: {
        findMany: mockNoticeFindMany,
        count: mockNoticeCount,
      },
      trip: {
        findFirst: mockTripFindFirst,
      },
      routeAssignment: {
        findFirst: mockRouteAssignmentFindFirst,
      },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MobileService>(MobileService);
  });

  describe('findActiveRoutes', () => {
    it('should only return active routes', async () => {
      mockRouteFindMany.mockResolvedValue([mockActiveRoute]);
      mockRouteCount.mockResolvedValue(1);

      const result = await service.findActiveRoutes(1, 10, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.isActive).toBe(true);
      expect(mockRouteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should apply status filter', async () => {
      mockRouteFindMany.mockResolvedValue([mockActiveRoute]);
      mockRouteCount.mockResolvedValue(1);

      await service.findActiveRoutes(1, 10, { status: RouteStatus.ACTIVE });

      expect(mockRouteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: RouteStatus.ACTIVE }),
        }),
      );
    });

    it('should apply search filter', async () => {
      mockRouteFindMany.mockResolvedValue([]);
      mockRouteCount.mockResolvedValue(0);

      await service.findActiveRoutes(1, 10, { search: 'Norte' });

      expect(mockRouteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'Norte' }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findRouteDetail', () => {
    it('should throw NotFoundException for inactive route', async () => {
      mockRouteFindUnique.mockResolvedValue(null);

      await expect(service.findRouteDetail('route-2')).rejects.toThrow(NotFoundException);
    });

    it('should return route detail with stops and schedules', async () => {
      const routeWithRelations = {
        ...mockActiveRoute,
        routeStops: [
          {
            id: 'rs-1',
            stopOrder: 0,
            estimatedArrivalMinutes: null,
            notes: null,
            stop: {
              id: 'stop-1',
              name: 'Parada 1',
              reference: null,
              latitude: mockDecimal(-2.8975),
              longitude: mockDecimal(-79.0045),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        schedules: [
          {
            id: 'sch-1',
            routeId: 'route-1',
            dayOfWeek: DayOfWeek.MONDAY,
            direction: 'Norte',
            departureTime: '07:30',
            approximateArrivalTime: '08:15',
            status: ScheduleStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockRouteFindUnique.mockResolvedValue(routeWithRelations);

      const result = await service.findRouteDetail('route-1');

      expect(result.route.id).toBe('route-1');
      expect(result.stops).toHaveLength(1);
      expect(result.stops[0]!.stop.name).toBe('Parada 1');
      expect(result.schedules).toHaveLength(1);
      expect(result.schedules[0]!.departureTime).toBe('07:30');
    });
  });

  describe('findRouteStops', () => {
    it('should throw NotFoundException for inactive route', async () => {
      mockRouteFindFirst.mockResolvedValue(null);

      await expect(service.findRouteStops('route-2')).rejects.toThrow(NotFoundException);
    });

    it('should return stops for active route', async () => {
      mockRouteFindFirst.mockResolvedValue(mockActiveRoute);
      mockRouteStopFindMany.mockResolvedValue([
        {
          id: 'rs-1',
          stopOrder: 0,
          estimatedArrivalMinutes: null,
          notes: null,
          stop: {
            id: 'stop-1',
            name: 'Parada 1',
            reference: null,
            latitude: mockDecimal(-2.8975),
            longitude: mockDecimal(-79.0045),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ]);

      const result = await service.findRouteStops('route-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.stopOrder).toBe(0);
    });
  });

  describe('findRouteSchedules', () => {
    it('should throw NotFoundException for inactive route', async () => {
      mockRouteFindFirst.mockResolvedValue(null);

      await expect(service.findRouteSchedules('route-2', {})).rejects.toThrow(NotFoundException);
    });

    it('should return schedules for active route', async () => {
      mockRouteFindFirst.mockResolvedValue(mockActiveRoute);
      mockScheduleFindMany.mockResolvedValue([
        {
          id: 'sch-1',
          routeId: 'route-1',
          dayOfWeek: DayOfWeek.MONDAY,
          direction: 'Norte',
          departureTime: '07:30',
          approximateArrivalTime: null,
          status: ScheduleStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findRouteSchedules('route-1', {});

      expect(result).toHaveLength(1);
      expect(result[0]!.dayOfWeek).toBe(DayOfWeek.MONDAY);
    });
  });

  describe('findActiveNotices', () => {
    it('should filter notices by date correctly', async () => {
      const now = new Date();
      const mockNotice = {
        id: 'notice-1',
        title: 'Aviso activo',
        message: 'Mensaje',
        severity: NoticeSeverity.INFO,
        publishedFrom: new Date(now.getTime() - 86400000),
        publishedUntil: new Date(now.getTime() + 86400000),
      };

      mockNoticeFindMany.mockResolvedValue([mockNotice]);
      mockNoticeCount.mockResolvedValue(1);

      const result = await service.findActiveNotices(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.title).toBe('Aviso activo');

      expect(mockNoticeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            publishedFrom: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should include notices with null publishedUntil', async () => {
      mockNoticeFindMany.mockResolvedValue([]);
      mockNoticeCount.mockResolvedValue(0);

      await service.findActiveNotices(1, 10);

      expect(mockNoticeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { publishedUntil: null },
            ]),
          }),
        }),
      );
    });
  });

  describe('currentOperation', () => {
    it('should include currentOperation IN_PROGRESS in active routes when a trip is in progress', async () => {
      mockRouteFindMany.mockResolvedValue([mockActiveRoute]);
      mockRouteCount.mockResolvedValue(1);
      mockTripFindFirst.mockResolvedValue({
        id: 'trip-1',
        status: 'IN_PROGRESS',
        startedAt: new Date('2026-08-27T12:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Juan Pérez' },
        vehicle: { id: 'vehicle-1', plate: 'GXX-1234', code: 'BUS-01' },
      });

      const result = await service.findActiveRoutes(1, 10, {});

      expect(result.data[0]!.currentOperation).toEqual({
        status: 'IN_PROGRESS',
        driver: { id: 'driver-1', name: 'Juan Pérez' },
        vehicle: { id: 'vehicle-1', plate: 'GXX-1234', code: 'BUS-01' },
        startedAt: new Date('2026-08-27T12:00:00.000Z'),
        tripId: 'trip-1',
      });
    });

    it('should return currentOperation null when no trip or assignment exists', async () => {
      mockRouteFindMany.mockResolvedValue([mockActiveRoute]);
      mockRouteCount.mockResolvedValue(1);
      mockTripFindFirst.mockResolvedValue(null);
      mockRouteAssignmentFindFirst.mockResolvedValue(null);

      const result = await service.findActiveRoutes(1, 10, {});

      expect(result.data[0]!.currentOperation).toBeNull();
    });

    it('should include currentOperation in route detail with driver, vehicle and status', async () => {
      const routeWithRelations = {
        ...mockActiveRoute,
        routeStops: [],
        schedules: [],
      };

      mockRouteFindUnique.mockResolvedValue(routeWithRelations);
      mockTripFindFirst.mockResolvedValue({
        id: 'trip-1',
        status: 'IN_PROGRESS',
        startedAt: new Date('2026-08-27T12:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Juan Pérez' },
        vehicle: { id: 'vehicle-1', plate: 'GXX-1234', code: 'BUS-01' },
      });

      const result = await service.findRouteDetail('route-1');

      expect(result.currentOperation?.status).toBe('IN_PROGRESS');
      expect(result.currentOperation?.driver.name).toBe('Juan Pérez');
      expect(result.currentOperation?.vehicle.plate).toBe('GXX-1234');
    });

    it('should return currentOperation null in route detail when no active operation', async () => {
      const routeWithRelations = {
        ...mockActiveRoute,
        routeStops: [],
        schedules: [],
      };

      mockRouteFindUnique.mockResolvedValue(routeWithRelations);
      mockTripFindFirst.mockResolvedValue(null);
      mockRouteAssignmentFindFirst.mockResolvedValue(null);

      const result = await service.findRouteDetail('route-1');

      expect(result.currentOperation).toBeNull();
    });

    it('should return currentOperation null when the only assignment is not for today', async () => {
      mockRouteFindMany.mockResolvedValue([mockActiveRoute]);
      mockRouteCount.mockResolvedValue(1);
      mockTripFindFirst.mockResolvedValue(null);
      mockRouteAssignmentFindFirst.mockResolvedValue(null);

      const result = await service.findActiveRoutes(1, 10, {});

      expect(result.data[0]!.currentOperation).toBeNull();
      expect(mockRouteAssignmentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceDate: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });
  });
});
