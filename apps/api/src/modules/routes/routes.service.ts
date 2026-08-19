import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Route, RouteStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteResponseDto } from './dto/route-response.dto';

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateRouteDto, actorId: string): Promise<RouteResponseDto> {
    const route = await this.prisma.route.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        direction: dto.direction,
        status: dto.status ?? RouteStatus.ACTIVE,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Route', route.id, {
      name: route.name,
      direction: route.direction,
    });

    return this.mapRouteToResponse(route);
  }

  async update(id: string, dto: UpdateRouteDto, actorId: string): Promise<RouteResponseDto> {
    await this.findOne(id);

    const route = await this.prisma.route.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        direction: dto.direction,
        status: dto.status,
        isActive: dto.isActive,
      } as Prisma.RouteUpdateInput,
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Route', route.id, {
      name: route.name,
      direction: route.direction,
    });

    return this.mapRouteToResponse(route);
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<RouteResponseDto>> {
    const skip = (page - 1) * limit;
    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({ skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.route.count(),
    ]);

    return buildPaginatedResponse(routes.map((route) => this.mapRouteToResponse(route)), total, page, limit);
  }

  async findOne(id: string): Promise<RouteResponseDto> {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundException(`Route with id ${id} not found`);
    return this.mapRouteToResponse(route);
  }

  async remove(id: string, actorId: string): Promise<RouteResponseDto> {
    await this.findOne(id);

    const route = await this.prisma.route.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Route', route.id, {
      name: route.name,
      direction: route.direction,
    });

    return this.mapRouteToResponse(route);
  }

  private mapRouteToResponse(route: Route): RouteResponseDto {
    return {
      id: route.id,
      name: route.name,
      description: route.description,
      direction: route.direction,
      status: route.status,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    };
  }
}
