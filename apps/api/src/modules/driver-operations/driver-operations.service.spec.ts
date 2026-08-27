import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TripStatus, UserRole } from '@prisma/client';
import { DriverOperationsService } from './driver-operations.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TripsService } from '../trips/trips.service';

describe('DriverOperationsService', () => {
  let service: DriverOperationsService;

  const mockDriverRow = {
    id: 'driver-1',
    name: 'Luis Herrera',
    phone: '+593991110001',
    status: 'ACTIVE',
  };

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTripDetail = {
    id: 'trip-1',
    assignmentId: 'assignment-1',
    routeId: 'route-1',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    status: TripStatus.IN_PROGRESS,
    startedAt: new Date(),
    endedAt: null,
    startNotes: null,
    endNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignment: { id: 'assignment-1', serviceDate: new Date(), status: TripStatus.IN_PROGRESS },
    route: { id: 'route-1', name: 'Ruta Norte', direction: 'IDA' },
    driver: { id: 'driver-1', name: 'Luis Herrera' },
    vehicle: { id: 'vehicle-1', plate: 'PPN-1234', code: 'BUS-001' },
  };

  let mockDriverFindUnique: jest.Mock;
  let mockAssignmentFindUnique: jest.Mock;
  let mockAssignmentFindMany: jest.Mock;
  let mockAssignmentUpdate: jest.Mock;
  let mockTripFindUnique: jest.Mock;
  let mockTripFindFirst: jest.Mock;
  let mockFindCurrentByDriver: jest.Mock;
  let mockFindCurrentByVehicle: jest.Mock;
  let mockStart: jest.Mock;
  let mockFinish: jest.Mock;
  let mockLogAction: jest.Mock;

  beforeEach(async () => {
    mockDriverFindUnique = jest.fn();
    mockAssignmentFindUnique = jest.fn();
    mockAssignmentFindMany = jest.fn();
    mockAssignmentUpdate = jest.fn();
    mockTripFindUnique = jest.fn();
    mockTripFindFirst = jest.fn();
    mockFindCurrentByDriver = jest.fn();
    mockFindCurrentByVehicle = jest.fn();
    mockStart = jest.fn();
    mockFinish = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      driver: { findUnique: mockDriverFindUnique },
      routeAssignment: {
        findUnique: mockAssignmentFindUnique,
        findMany: mockAssignmentFindMany,
        update: mockAssignmentUpdate,
      },
      trip: {
        findUnique: mockTripFindUnique,
        findFirst: mockTripFindFirst,
      },
    } as unknown as PrismaService;

    (prismaMock as { $transaction?: unknown }).$transaction = jest.fn(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
    );

    const tripsMock = {
      findCurrentByDriver: mockFindCurrentByDriver,
      findCurrentByVehicle: mockFindCurrentByVehicle,
      start: mockStart,
      finish: mockFinish,
      findById: mockTripFindUnique,
    } as unknown as TripsService;

    const auditMock = { logAction: mockLogAction } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverOperationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TripsService, useValue: tripsMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<DriverOperationsService>(DriverOperationsService);
  });

  describe('getTodayAssignments', () => {
    it('should return today assignments for a DRIVER role', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindMany.mockResolvedValue([
        {
          id: 'assignment-1',
          routeId: 'route-1',
          serviceDate: new Date(),
          status: TripStatus.SCHEDULED,
          notes: null,
          suspendReason: null,
          route: { id: 'route-1', name: 'Ruta Norte', description: null, direction: 'IDA' },
          vehicle: { id: 'vehicle-1', plate: 'PPN-1234', code: 'BUS-001', capacity: 40 },
          driver: { id: 'driver-1', name: 'Luis Herrera', phone: null },
        },
      ]);

      const result = await service.getTodayAssignments('user-1', UserRole.DRIVER);

      expect(result).toHaveLength(1);
      expect(result[0]?.route.name).toBe('Ruta Norte');
      expect(result[0]?.vehicle.plate).toBe('PPN-1234');
    });

    it('should throw NotFoundException when DRIVER has no profile', async () => {
      mockDriverFindUnique.mockResolvedValue(null);

      await expect(
        service.getTodayAssignments('user-1', UserRole.DRIVER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startTrip', () => {
    it('should start a trip for a valid active assignment', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindUnique.mockResolvedValue(mockAssignment);
      mockFindCurrentByDriver.mockResolvedValue(null);
      mockFindCurrentByVehicle.mockResolvedValue(null);
      mockStart.mockResolvedValue(mockTripDetail);
      mockAssignmentUpdate.mockResolvedValue(mockAssignment);

      const result = await service.startTrip('user-1', UserRole.DRIVER, {
        assignmentId: 'assignment-1',
        startNotes: 'Inicio sin novedades',
      });

      expect(result.status).toBe(TripStatus.IN_PROGRESS);
      expect(mockAssignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TripStatus.IN_PROGRESS }) }),
      );
      expect(mockLogAction).toHaveBeenCalledWith('user-1', 'TRIP_START', 'Trip', 'trip-1', expect.any(Object));
    });

    it('should reject when assignment is not active', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindUnique.mockResolvedValue({ ...mockAssignment, isActive: false });

      await expect(
        service.startTrip('user-1', UserRole.DRIVER, { assignmentId: 'assignment-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when assignment does not belong to the driver', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindUnique.mockResolvedValue({ ...mockAssignment, driverId: 'other-driver' });

      await expect(
        service.startTrip('user-1', UserRole.DRIVER, { assignmentId: 'assignment-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when driver already has a trip in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindUnique.mockResolvedValue(mockAssignment);
      mockFindCurrentByDriver.mockResolvedValue(mockTripDetail);

      await expect(
        service.startTrip('user-1', UserRole.DRIVER, { assignmentId: 'assignment-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject when vehicle already has a trip in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockAssignmentFindUnique.mockResolvedValue(mockAssignment);
      mockFindCurrentByDriver.mockResolvedValue(null);
      mockFindCurrentByVehicle.mockResolvedValue(mockTripDetail);

      await expect(
        service.startTrip('user-1', UserRole.DRIVER, { assignmentId: 'assignment-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('finishTrip', () => {
    it('should finish a trip in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockTripFindUnique.mockResolvedValue({
        id: 'trip-1',
        assignmentId: 'assignment-1',
        driverId: 'driver-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        status: TripStatus.IN_PROGRESS,
      });
      mockFinish.mockResolvedValue({ ...mockTripDetail, status: TripStatus.COMPLETED, endedAt: new Date() });
      mockAssignmentUpdate.mockResolvedValue(mockAssignment);

      const result = await service.finishTrip('user-1', UserRole.DRIVER, 'trip-1', {
        endNotes: 'Finalizado sin novedades',
      });

      expect(result.status).toBe(TripStatus.COMPLETED);
      expect(mockAssignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TripStatus.COMPLETED }) }),
      );
    });

    it('should reject finishing a trip that is not in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockTripFindUnique.mockResolvedValue({
        id: 'trip-1',
        assignmentId: 'assignment-1',
        driverId: 'driver-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        status: TripStatus.COMPLETED,
      });

      await expect(
        service.finishTrip('user-1', UserRole.DRIVER, 'trip-1', {}),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCurrentTrip', () => {
    it('should return the current trip in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockTripFindFirst.mockResolvedValue({
        id: 'trip-1',
        assignmentId: 'assignment-1',
        routeId: 'route-1',
        driverId: 'driver-1',
        vehicleId: 'vehicle-1',
        status: TripStatus.IN_PROGRESS,
        startedAt: new Date(),
        endedAt: null,
        startNotes: null,
        endNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        route: { id: 'route-1', name: 'Ruta Norte', direction: 'IDA' },
        vehicle: { id: 'vehicle-1', plate: 'PPN-1234', code: 'BUS-001' },
        assignment: { id: 'assignment-1', serviceDate: new Date(), status: TripStatus.IN_PROGRESS },
      });

      const result = await service.getCurrentTrip('user-1', UserRole.DRIVER);

      expect(result?.id).toBe('trip-1');
      expect(result?.status).toBe(TripStatus.IN_PROGRESS);
    });

    it('should return null when there is no trip in progress', async () => {
      mockDriverFindUnique.mockResolvedValue(mockDriverRow);
      mockTripFindFirst.mockResolvedValue(null);

      const result = await service.getCurrentTrip('user-1', UserRole.DRIVER);

      expect(result).toBeNull();
    });
  });
});