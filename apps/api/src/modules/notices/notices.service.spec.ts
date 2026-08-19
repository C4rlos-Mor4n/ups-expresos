import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NoticeSeverity } from '@prisma/client';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('NoticesService', () => {
  let service: NoticesService;

  let mockNoticeFindUnique: jest.Mock;
  let mockNoticeCreate: jest.Mock;
  let mockNoticeUpdate: jest.Mock;
  let mockNoticeFindMany: jest.Mock;
  let mockNoticeCount: jest.Mock;
  let mockLogAction: jest.Mock;

  const mockCreator = {
    id: 'user-1',
    email: 'admin@ups.edu.ec',
    name: 'Admin',
  };

  const mockNotice = {
    id: 'notice-1',
    title: 'Cambio de ruta',
    message: 'La ruta norte tendra un desvio',
    severity: NoticeSeverity.INFO,
    publishedFrom: new Date('2026-06-01'),
    publishedUntil: new Date('2026-07-01'),
    isActive: true,
    createdById: 'user-1',
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    createdBy: mockCreator,
  };

  beforeEach(async () => {
    mockNoticeFindUnique = jest.fn();
    mockNoticeCreate = jest.fn();
    mockNoticeUpdate = jest.fn();
    mockNoticeFindMany = jest.fn();
    mockNoticeCount = jest.fn();
    mockLogAction = jest.fn().mockResolvedValue(undefined);

    const prismaMock = {
      notice: {
        findUnique: mockNoticeFindUnique,
        create: mockNoticeCreate,
        update: mockNoticeUpdate,
        count: mockNoticeCount,
        findMany: mockNoticeFindMany,
      },
    } as unknown as PrismaService;

    const auditMock = {
      logAction: mockLogAction,
    } as unknown as AuditLogsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogsService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
  });

  describe('create', () => {
    it('should validate publishedUntil > publishedFrom', async () => {
      const dto = {
        title: 'Aviso',
        message: 'Mensaje',
        publishedFrom: '2026-07-01T00:00:00.000Z',
        publishedUntil: '2026-06-01T00:00:00.000Z',
      };

      await expect(service.create(dto, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject when publishedUntil equals publishedFrom', async () => {
      const dto = {
        title: 'Aviso',
        message: 'Mensaje',
        publishedFrom: '2026-06-01T00:00:00.000Z',
        publishedUntil: '2026-06-01T00:00:00.000Z',
      };

      await expect(service.create(dto, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('should create notice and register audit log', async () => {
      mockNoticeCreate.mockResolvedValue(mockNotice);

      const dto = {
        title: 'Cambio de ruta',
        message: 'La ruta norte tendra un desvio',
        publishedFrom: '2026-06-01T00:00:00.000Z',
        publishedUntil: '2026-07-01T00:00:00.000Z',
      };

      const result = await service.create(dto, 'actor-1');

      expect(result.id).toBe('notice-1');
      expect(result.title).toBe('Cambio de ruta');
      expect(result.createdBy.id).toBe('user-1');
      expect(mockLogAction).toHaveBeenCalledWith(
        'actor-1',
        'CREATE',
        'Notice',
        'notice-1',
        expect.objectContaining({ title: 'Cambio de ruta' }),
      );
    });

    it('should allow null publishedUntil', async () => {
      mockNoticeCreate.mockResolvedValue({
        ...mockNotice,
        publishedUntil: null,
      });

      const dto = {
        title: 'Aviso sin fin',
        message: 'Mensaje',
        publishedFrom: '2026-06-01T00:00:00.000Z',
      };

      const result = await service.create(dto, 'actor-1');

      expect(result.publishedUntil).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return a notice by id', async () => {
      mockNoticeFindUnique.mockResolvedValue(mockNotice);

      const result = await service.findOne('notice-1');

      expect(result.id).toBe('notice-1');
      expect(result.createdBy.email).toBe('admin@ups.edu.ec');
    });

    it('should throw NotFoundException when notice not found', async () => {
      mockNoticeFindUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated notices', async () => {
      mockNoticeFindMany.mockResolvedValue([mockNotice]);
      mockNoticeCount.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('update', () => {
    it('should update an existing notice', async () => {
      mockNoticeFindUnique.mockResolvedValue(mockNotice);
      const updatedNotice = { ...mockNotice, title: 'Nuevo titulo' };
      mockNoticeUpdate.mockResolvedValue(updatedNotice);

      const result = await service.update('notice-1', { title: 'Nuevo titulo' }, 'actor-1');

      expect(result.title).toBe('Nuevo titulo');
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if notice does not exist', async () => {
      mockNoticeFindUnique.mockResolvedValue(null);

      await expect(
        service.update('bad-id', { title: 'X' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
