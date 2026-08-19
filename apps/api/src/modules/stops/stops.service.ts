import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Stop } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';
import { StopResponseDto } from './dto/stop-response.dto';

@Injectable()
export class StopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateStopDto, actorId: string): Promise<StopResponseDto> {
    const stop = await this.prisma.stop.create({
      data: {
        name: dto.name,
        reference: dto.reference ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Stop', stop.id, {
      name: stop.name,
    });

    return this.mapStopToResponse(stop);
  }

  async update(id: string, dto: UpdateStopDto, actorId: string): Promise<StopResponseDto> {
    await this.findOne(id);

    const stop = await this.prisma.stop.update({
      where: { id },
      data: {
        name: dto.name,
        reference: dto.reference,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive,
      } as Prisma.StopUpdateInput,
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Stop', stop.id, {
      name: stop.name,
    });

    return this.mapStopToResponse(stop);
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<StopResponseDto>> {
    const skip = (page - 1) * limit;
    const [stops, total] = await Promise.all([
      this.prisma.stop.findMany({ skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.stop.count(),
    ]);

    return buildPaginatedResponse(stops.map((stop) => this.mapStopToResponse(stop)), total, page, limit);
  }

  async findOne(id: string): Promise<StopResponseDto> {
    const stop = await this.prisma.stop.findUnique({ where: { id } });
    if (!stop) throw new NotFoundException(`Stop with id ${id} not found`);
    return this.mapStopToResponse(stop);
  }

  async remove(id: string, actorId: string): Promise<StopResponseDto> {
    await this.findOne(id);

    const stop = await this.prisma.stop.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Stop', stop.id, {
      name: stop.name,
    });

    return this.mapStopToResponse(stop);
  }

  private mapStopToResponse(stop: Stop): StopResponseDto {
    return {
      id: stop.id,
      name: stop.name,
      reference: stop.reference,
      latitude: stop.latitude.toNumber(),
      longitude: stop.longitude.toNumber(),
      isActive: stop.isActive,
      createdAt: stop.createdAt,
      updatedAt: stop.updatedAt,
    };
  }
}
