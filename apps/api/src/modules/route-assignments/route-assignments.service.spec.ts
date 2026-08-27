import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TripStatus, DriverStatus, VehicleStatus } from '@prisma/client';
import { RouteAssignmentsService } from './route-assignments.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('RouteAssignmentsService', () => {
  let service: RouteAssignmentsService;

  const mockRoute = { id: 'route-1', name: 'Ruta Norte', direction: 'IDA' };
  const mockDriver = { id: 'driver-1', name: 'Luis Herrera' };
  const mockVehicle = { id: 'vehicle-1', plate: 'PPN-1234', code: 'BUS-001' };

  const mockAssignment = {
    id: 'assignment-1',
    routeId: 'route-1',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    serviceDate: new Date('2026-08-27T00:00:00.000Z'),
    status: TripStatus.SCHEDULED,
    notes: null,
    isActive: true,
    suspendReason: null,
    suspendedAt: null,
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
    updatedAt: new Date('2026-08-25T00:00:00.000Z'),
    route: mockRoute,
    driver: mockDriver,
    vehicle: mockVehicle,
  };

  let mockRouteFindUnique: jest.Mock;
  let mockDriverFindUnique: jest.Mock;
  let mockVehicleFindUnique: jest.Mock;
  let mockAssignmentFindUnique: jest.Mock;
  let mockAssignmentFindFirst: jest.Mock;
  let mockAssignmentCreate: jest.Mock;
  let mockAssignmentUpdate: jest.Mock;
  let mockAssignmentFindMany: jest.Mock;
  let mockAssignmentCount: jest.Mock;
  let mockTripFindFirst: jest.Mock;
  let mockLogAction: jest.Mock;

  beforeEach(async () => {
    mockRouteFindUnique = jest.fn();
    mockDriverFindUnique = jest.fn();
    mockVehicleFindUnique = jest.fn();
    mockAssignmentFindUnique = jest.fn();
    mockAssignmentFindFirst = jest.fn();
    mockAssignmentCreate = jest.fn();
    mockAssignmentUpdate = jest.fn();
    mockAssignmentFindMany = jest.fn();
    mockAssignmentCount = jest.fn();
    mockTripFindFirst = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      route: { findUnique: mockRouteFindUnique },
      driver: { findUnique: mockDriverFindUnique },
      vehicle: { findUnique: mockVehicleFindUnique },
      routeAssignment: {
        findUnique: mockAssignmentFindUnique,
        findFirst: mockAssignmentFindFirst,
        create: mockAssignmentCreate,
        update: mockAssignmentUpdate,
        findMany: mockAssignmentFindMany,
        count: mockAssignmentCount,
      },
      trip: { findFirst: mockTripFindFirst },
    } as unknown as PrismaService;

    const auditMock = { logAction: mockLogAction } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteAssignmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<RouteAssignmentsService>(RouteAssignmentsService);
  });

  const validCreateDto = {
    routeId: 'route-1',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    serviceDate: '2026-08-27T00:00:00.000Z',
  };

  describe('create', () => {
    it('should create a valid assignment and register audit log', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.ACTIVE });
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.ACTIVE });
      mockAssignmentFindFirst.mockResolvedValue(null);
      mockAssignmentCreate.mockResolvedValue(mockAssignment);

      const result = await service.create(validCreateDto, 'actor-1');

      expect(result.id).toBe('assignment-1');
      expect(result.status).toBe(TripStatus.SCHEDULED);
      expect(result.route.name).toBe('Ruta Norte');
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'CREATE',
        'RouteAssignment',
        'assignment-1',
        expect.objectContaining({ routeId: 'route-1' }),
      );
    });

    it('should reject when route does not exist', async () => {
      mockRouteFindUnique.mockResolvedValue(null);
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.ACTIVE });
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.ACTIVE });

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject when driver does not exist', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue(null);
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.ACTIVE });

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject when vehicle does not exist', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.ACTIVE });
      mockVehicleFindUnique.mockResolvedValue(null);

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject when driver is inactive', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.INACTIVE });
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.ACTIVE });

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject when vehicle is inactive', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.ACTIVE });
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.MAINTENANCE });

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject a conflicting assignment for the same date', async () => {
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1', status: 'ACTIVE' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.ACTIVE });
      mockVehicleFindUnique.mockResolvedValue({ id: 'vehicle-1', status: VehicleStatus.ACTIVE });
      mockAssignmentFindFirst.mockResolvedValue({ id: 'existing-conflict' });

      await expect(service.create(validCreateDto, 'actor-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should reject update when a trip is in progress', async () => {
      mockAssignmentFindUnique.mockResolvedValue(mockAssignment);
      mockTripFindFirst.mockResolvedValue({ id: 'trip-1', status: TripStatus.IN_PROGRESS });

      await expect(
        service.update('assignment-1', { notes: 'cambio' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject update when assignment does not exist', async () => {
      mockAssignmentFindUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { notes: 'cambio' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated assignments', async () => {
      mockAssignmentFindMany.mockResolvedValue([mockAssignment]);
      mockAssignmentCount.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0]?.route.name).toBe('Ruta Norte');
    });
  });
});