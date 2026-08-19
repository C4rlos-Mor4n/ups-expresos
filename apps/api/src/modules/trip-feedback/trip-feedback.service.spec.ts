import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TripFeedbackService } from './trip-feedback.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateTripFeedbackDto } from './dto/create-trip-feedback.dto';
import { TripFeedbackResponseDto } from './dto/trip-feedback-response.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';

// ─── Helpers de datos mock ───────────────────────────────────────

function buildFeedbackRecord(overrides?: Partial<{
  id: string;
  userId: string;
  routeId: string;
  driverId: string | null;
  rating: number;
  comment: string | null;
  travelDate: Date | null;
  createdAt: Date;
}>): {
  id: string;
  userId: string;
  routeId: string;
  driverId: string | null;
  rating: number;
  comment: string | null;
  travelDate: Date | null;
  createdAt: Date;
} {
  return {
    id: 'feedback-1',
    userId: 'user-1',
    routeId: 'route-1',
    driverId: null,
    rating: 4,
    comment: null,
    travelDate: null,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  };
}

function buildDto(overrides?: Partial<CreateTripFeedbackDto>): CreateTripFeedbackDto {
  return {
    routeId: 'route-1',
    rating: 4,
    ...overrides,
  };
}

function buildUser(overrides?: Partial<JwtPayload>): JwtPayload {
  return {
    sub: 'user-1',
    email: 'student@ups.edu.ec',
    role: 'STUDENT',
    ...overrides,
  };
}

describe('TripFeedbackService', () => {
  let service: TripFeedbackService;

  // Mocks con tipos explicitos
  let mockRouteFindUnique: jest.Mock;
  let mockDriverFindUnique: jest.Mock;
  let mockFeedbackCreate: jest.Mock;
  let mockFeedbackFindMany: jest.Mock;
  let mockFeedbackFindUnique: jest.Mock;
  let mockFeedbackCount: jest.Mock;
  let mockLogAction: jest.Mock;

  beforeEach(async () => {
    mockRouteFindUnique = jest.fn();
    mockDriverFindUnique = jest.fn();
    mockFeedbackCreate = jest.fn();
    mockFeedbackFindMany = jest.fn();
    mockFeedbackFindUnique = jest.fn();
    mockFeedbackCount = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      route: {
        findUnique: mockRouteFindUnique,
      },
      driver: {
        findUnique: mockDriverFindUnique,
      },
      tripFeedback: {
        create: mockFeedbackCreate,
        findMany: mockFeedbackFindMany,
        findUnique: mockFeedbackFindUnique,
        count: mockFeedbackCount,
      },
    } as unknown as PrismaService;

    const auditLogsMock = {
      logAction: mockLogAction,
    } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripFeedbackService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditLogsMock },
      ],
    }).compile();

    service = module.get<TripFeedbackService>(TripFeedbackService);
  });

  // ─── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should throw NotFoundException when route does not exist', async () => {
      // Arrange
      mockRouteFindUnique.mockResolvedValue(null);
      const dto = buildDto();

      // Act & Assert
      await expect(service.create(dto, 'user-1', 'actor-1'))
        .rejects.toThrow(NotFoundException);
      await expect(service.create(dto, 'user-1', 'actor-1'))
        .rejects.toThrow(`Route with id ${dto.routeId} not found`);
    });

    it('should throw NotFoundException when driver does not exist', async () => {
      // Arrange
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockDriverFindUnique.mockResolvedValue(null);
      const dto = buildDto({ driverId: 'driver-nonexistent' });

      // Act & Assert
      await expect(service.create(dto, 'user-1', 'actor-1'))
        .rejects.toThrow(NotFoundException);
      await expect(service.create(dto, 'user-1', 'actor-1'))
        .rejects.toThrow(`Driver with id ${dto.driverId} not found`);
    });

    it('should create feedback and register audit log', async () => {
      // Arrange
      const travelDate = new Date('2026-07-01T08:00:00.000Z');
      const record = buildFeedbackRecord({
        userId: 'user-1',
        routeId: 'route-1',
        driverId: 'driver-1',
        rating: 5,
        comment: 'Excelente servicio',
        travelDate,
      });

      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockDriverFindUnique.mockResolvedValue({ id: 'driver-1' });
      mockFeedbackCreate.mockResolvedValue(record);

      const dto = buildDto({
        routeId: 'route-1',
        driverId: 'driver-1',
        rating: 5,
        comment: 'Excelente servicio',
        travelDate: '2026-07-01T08:00:00.000Z',
      });

      // Act
      const result = await service.create(dto, 'user-1', 'actor-1');

      // Assert
      expect(mockRouteFindUnique).toHaveBeenCalledWith({
        where: { id: 'route-1' },
      });
      expect(mockDriverFindUnique).toHaveBeenCalledWith({
        where: { id: 'driver-1' },
      });
      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          routeId: 'route-1',
          driverId: 'driver-1',
          rating: 5,
          comment: 'Excelente servicio',
          travelDate: expect.any(Date),
        },
      });
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'CREATE',
        'TripFeedback',
        'feedback-1',
        { routeId: 'route-1', rating: 5 },
      );
      expect(result.id).toBe('feedback-1');
      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Excelente servicio');
    });

    it('should handle driverId null correctly (skip driver validation)', async () => {
      // Arrange
      const record = buildFeedbackRecord({ driverId: null });
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockFeedbackCreate.mockResolvedValue(record);

      const dto = buildDto({ routeId: 'route-1', rating: 3 });
      // driverId no se proporciona (undefined)

      // Act
      const result = await service.create(dto, 'user-1', 'actor-1');

      // Assert
      expect(mockDriverFindUnique).not.toHaveBeenCalled();
      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: null,
        }),
      });
      expect(result.driverId).toBeNull();
    });

    it('should handle travelDate correctly (null when not provided)', async () => {
      // Arrange
      const record = buildFeedbackRecord({ travelDate: null });
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockFeedbackCreate.mockResolvedValue(record);

      const dto = buildDto({ routeId: 'route-1', rating: 4 });
      // travelDate no se proporciona

      // Act
      const result = await service.create(dto, 'user-1', 'actor-1');

      // Assert
      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          travelDate: null,
        }),
      });
      expect(result.travelDate).toBeNull();
    });

    it('should convert travelDate string to Date object', async () => {
      // Arrange
      const travelDate = new Date('2026-06-15T10:30:00.000Z');
      const record = buildFeedbackRecord({ travelDate });
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockFeedbackCreate.mockResolvedValue(record);

      const dto = buildDto({
        routeId: 'route-1',
        rating: 4,
        travelDate: '2026-06-15T10:30:00.000Z',
      });

      // Act
      await service.create(dto, 'user-1', 'actor-1');

      // Assert
      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          travelDate: new Date('2026-06-15T10:30:00.000Z'),
        }),
      });
    });

    it('should handle comment null correctly', async () => {
      // Arrange
      const record = buildFeedbackRecord({ comment: null });
      mockRouteFindUnique.mockResolvedValue({ id: 'route-1' });
      mockFeedbackCreate.mockResolvedValue(record);

      const dto = buildDto({ routeId: 'route-1', rating: 4 });
      // comment no se proporciona

      // Act
      const result = await service.create(dto, 'user-1', 'actor-1');

      // Assert
      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment: null,
        }),
      });
      expect(result.comment).toBeNull();
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return correct pagination structure', async () => {
      // Arrange
      const records = [
        buildFeedbackRecord({ id: 'f-1' }),
        buildFeedbackRecord({ id: 'f-2' }),
      ];
      mockFeedbackFindMany.mockResolvedValue(records);
      mockFeedbackCount.mockResolvedValue(2);

      // Act
      const result = await service.findAll(1, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by userId when provided and user is admin', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(1, 10, buildUser({ role: 'ADMIN' }), 'user-filter');

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-filter' },
        }),
      );
      expect(mockFeedbackCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-filter' },
        }),
      );
    });

    it('should force own userId when user is not admin', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act — student intenta filtrar por otro usuario
      await service.findAll(1, 10, buildUser(), 'user-other');

      // Assert — el filtro se fuerza a su propio id
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
      expect(mockFeedbackCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });

    it('should filter by routeId when provided', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(1, 10, buildUser({ role: 'ADMIN' }), undefined, 'route-filter');

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { routeId: 'route-filter' },
        }),
      );
      expect(mockFeedbackCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { routeId: 'route-filter' },
        }),
      );
    });

    it('should filter by both userId and routeId when admin and both provided', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(1, 10, buildUser({ role: 'ADMIN' }), 'user-1', 'route-1');

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', routeId: 'route-1' },
        }),
      );
    });

    it('should use empty where when admin and no filters provided', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(1, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      // Arrange — 25 items, limit 10 → 3 pages
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(25);

      // Act
      const result = await service.findAll(1, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      expect(result.meta.totalPages).toBe(3);
    });

    it('should calculate skip correctly for page 3', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(3, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should order results by createdAt desc', async () => {
      // Arrange
      mockFeedbackFindMany.mockResolvedValue([]);
      mockFeedbackCount.mockResolvedValue(0);

      // Act
      await service.findAll(1, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should map feedback records to response DTOs', async () => {
      // Arrange
      const travelDate = new Date('2026-07-01T08:00:00.000Z');
      const createdAt = new Date('2026-07-01T10:00:00.000Z');
      const records = [
        buildFeedbackRecord({
          id: 'f-1',
          travelDate,
          createdAt,
          comment: 'Buen servicio',
        }),
      ];
      mockFeedbackFindMany.mockResolvedValue(records);
      mockFeedbackCount.mockResolvedValue(1);

      // Act
      const result = await service.findAll(1, 10, buildUser({ role: 'ADMIN' }));

      // Assert
      const dto = result.data[0] as TripFeedbackResponseDto;
      expect(dto.id).toBe('f-1');
      expect(dto.travelDate).toBe(travelDate.toISOString());
      expect(dto.createdAt).toBe(createdAt.toISOString());
      expect(dto.comment).toBe('Buen servicio');
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return feedback by ID when user owns it', async () => {
      // Arrange
      const record = buildFeedbackRecord({ id: 'feedback-target' });
      mockFeedbackFindUnique.mockResolvedValue(record);

      // Act
      const result = await service.findOne('feedback-target', buildUser());

      // Assert
      expect(mockFeedbackFindUnique).toHaveBeenCalledWith({
        where: { id: 'feedback-target' },
      });
      expect(result.id).toBe('feedback-target');
      expect(result.userId).toBe('user-1');
      expect(result.routeId).toBe('route-1');
    });

    it('should return feedback when user is admin (any owner)', async () => {
      // Arrange
      const record = buildFeedbackRecord({ id: 'feedback-target' });
      mockFeedbackFindUnique.mockResolvedValue(record);

      // Act
      const result = await service.findOne('feedback-target', buildUser({ role: 'SUPER_ADMIN' }));

      // Assert
      expect(result.id).toBe('feedback-target');
    });

    it('should throw ForbiddenException when user is not admin and does not own feedback', async () => {
      // Arrange
      const record = buildFeedbackRecord({ id: 'feedback-target', userId: 'user-other' });
      mockFeedbackFindUnique.mockResolvedValue(record);

      // Act & Assert
      await expect(service.findOne('feedback-target', buildUser()))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when feedback does not exist', async () => {
      // Arrange
      mockFeedbackFindUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent-id', buildUser()))
        .rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent-id', buildUser()))
        .rejects.toThrow('TripFeedback with id nonexistent-id not found');
    });

    it('should map travelDate to ISO string in response', async () => {
      // Arrange
      const travelDate = new Date('2026-06-15T10:30:00.000Z');
      const record = buildFeedbackRecord({ travelDate });
      mockFeedbackFindUnique.mockResolvedValue(record);

      // Act
      const result = await service.findOne('feedback-1', buildUser());

      // Assert
      expect(result.travelDate).toBe('2026-06-15T10:30:00.000Z');
    });

    it('should return null travelDate when not set', async () => {
      // Arrange
      const record = buildFeedbackRecord({ travelDate: null });
      mockFeedbackFindUnique.mockResolvedValue(record);

      // Act
      const result = await service.findOne('feedback-1', buildUser());

      // Assert
      expect(result.travelDate).toBeNull();
    });
  });
});