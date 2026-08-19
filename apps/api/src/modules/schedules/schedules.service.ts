import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Schedule, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { ScheduleFiltersDto } from './dto/schedule-filters.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateScheduleDto, actorId: string): Promise<ScheduleResponseDto> {
    const route = await this.prisma.route.findUnique({ where: { id: dto.routeId } });
    if (!route) throw new NotFoundException(`Route with id ${dto.routeId} not found`);

    const schedule = await this.prisma.schedule.create({
      data: {
        routeId: dto.routeId,
        dayOfWeek: dto.dayOfWeek,
        direction: dto.direction,
        departureTime: dto.departureTime,
        approximateArrivalTime: dto.approximateArrivalTime ?? null,
        status: dto.status ?? ScheduleStatus.ACTIVE,
      },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Schedule', schedule.id, {
      routeId: schedule.routeId,
      dayOfWeek: schedule.dayOfWeek,
      departureTime: schedule.departureTime,
    });

    return this.mapScheduleToResponse(schedule);
  }

  async update(id: string, dto: UpdateScheduleDto, actorId: string): Promise<ScheduleResponseDto> {
    await this.findOne(id);

    if (dto.routeId) {
      const route = await this.prisma.route.findUnique({ where: { id: dto.routeId } });
      if (!route) throw new NotFoundException(`Route with id ${dto.routeId} not found`);
    }

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        routeId: dto.routeId,
        dayOfWeek: dto.dayOfWeek,
        direction: dto.direction,
        departureTime: dto.departureTime,
        approximateArrivalTime: dto.approximateArrivalTime,
        status: dto.status,
      } as Prisma.ScheduleUpdateInput,
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Schedule', schedule.id, {
      routeId: schedule.routeId,
      dayOfWeek: schedule.dayOfWeek,
      departureTime: schedule.departureTime,
    });

    return this.mapScheduleToResponse(schedule);
  }

  async findAll(
    page: number,
    limit: number,
    filters: ScheduleFiltersDto,
  ): Promise<PaginatedResponse<ScheduleResponseDto>> {
    const skip = (page - 1) * limit;
    const where: Prisma.ScheduleWhereInput = {};
    if (filters.routeId) where.routeId = filters.routeId;
    if (filters.dayOfWeek) where.dayOfWeek = filters.dayOfWeek;

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({ where, skip, take: limit, orderBy: { departureTime: 'asc' } }),
      this.prisma.schedule.count({ where }),
    ]);

    return buildPaginatedResponse(
      schedules.map((schedule) => this.mapScheduleToResponse(schedule)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<ScheduleResponseDto> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException(`Schedule with id ${id} not found`);
    return this.mapScheduleToResponse(schedule);
  }

  async remove(id: string, actorId: string): Promise<ScheduleResponseDto> {
    const schedule = await this.findOne(id);

    await this.prisma.schedule.delete({ where: { id } });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Schedule', schedule.id, {
      routeId: schedule.routeId,
      dayOfWeek: schedule.dayOfWeek,
      departureTime: schedule.departureTime,
    });

    return schedule;
  }

  private mapScheduleToResponse(schedule: Schedule): ScheduleResponseDto {
    return {
      id: schedule.id,
      routeId: schedule.routeId,
      dayOfWeek: schedule.dayOfWeek,
      direction: schedule.direction,
      departureTime: schedule.departureTime,
      approximateArrivalTime: schedule.approximateArrivalTime,
      status: schedule.status,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }
}
