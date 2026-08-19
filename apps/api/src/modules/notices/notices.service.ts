import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Notice, NoticeSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { NoticeResponseDto } from './dto/notice-response.dto';

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateNoticeDto, actorId: string): Promise<NoticeResponseDto> {
    const publishedFrom = new Date(dto.publishedFrom);
    const publishedUntil = dto.publishedUntil ? new Date(dto.publishedUntil) : null;

    if (publishedUntil && publishedUntil <= publishedFrom) {
      throw new BadRequestException('publishedUntil must be after publishedFrom');
    }

    const notice = await this.prisma.notice.create({
      data: {
        title: dto.title,
        message: dto.message,
        severity: dto.severity ?? NoticeSeverity.INFO,
        publishedFrom,
        publishedUntil,
        isActive: dto.isActive ?? true,
        createdById: actorId,
      },
      include: { createdBy: true },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Notice', notice.id, {
      title: notice.title,
    });

    return this.mapNoticeToResponse(notice);
  }

  async update(id: string, dto: UpdateNoticeDto, actorId: string): Promise<NoticeResponseDto> {
    const existing = await this.findOne(id);

    const publishedFrom = dto.publishedFrom ? new Date(dto.publishedFrom) : existing.publishedFrom;
    const publishedUntil =
      dto.publishedUntil !== undefined
        ? (dto.publishedUntil ? new Date(dto.publishedUntil) : null)
        : existing.publishedUntil;

    if (publishedUntil && publishedUntil <= publishedFrom) {
      throw new BadRequestException('publishedUntil must be after publishedFrom');
    }

    const notice = await this.prisma.notice.update({
      where: { id },
      data: {
        title: dto.title,
        message: dto.message,
        severity: dto.severity,
        publishedFrom: dto.publishedFrom ? new Date(dto.publishedFrom) : undefined,
        publishedUntil: dto.publishedUntil !== undefined ? (dto.publishedUntil ? new Date(dto.publishedUntil) : null) : undefined,
        isActive: dto.isActive,
      } as Prisma.NoticeUpdateInput,
      include: { createdBy: true },
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Notice', notice.id, {
      title: notice.title,
    });

    return this.mapNoticeToResponse(notice);
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<NoticeResponseDto>> {
    const skip = (page - 1) * limit;
    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({
        skip,
        take: limit,
        orderBy: { publishedFrom: 'desc' },
        include: { createdBy: true },
      }),
      this.prisma.notice.count(),
    ]);

    return buildPaginatedResponse(
      notices.map((notice) => this.mapNoticeToResponse(notice)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<NoticeResponseDto> {
    const notice = await this.prisma.notice.findUnique({ where: { id }, include: { createdBy: true } });
    if (!notice) throw new NotFoundException(`Notice with id ${id} not found`);
    return this.mapNoticeToResponse(notice);
  }

  async remove(id: string, actorId: string): Promise<NoticeResponseDto> {
    await this.findOne(id);

    const notice = await this.prisma.notice.update({
      where: { id },
      data: { isActive: false },
      include: { createdBy: true },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Notice', notice.id, {
      title: notice.title,
    });

    return this.mapNoticeToResponse(notice);
  }

  private mapNoticeToResponse(
    notice: Notice & { createdBy: { id: string; email: string; name: string | null } },
  ): NoticeResponseDto {
    return {
      id: notice.id,
      title: notice.title,
      message: notice.message,
      severity: notice.severity,
      publishedFrom: notice.publishedFrom,
      publishedUntil: notice.publishedUntil,
      isActive: notice.isActive,
      createdBy: {
        id: notice.createdBy.id,
        email: notice.createdBy.email,
        name: notice.createdBy.name,
      },
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
    };
  }
}
