import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RouteStatus, ScheduleStatus, TripStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { RouteResponseDto } from '../routes/dto/route-response.dto';
import { ScheduleResponseDto } from '../schedules/dto/schedule-response.dto';
import { MobileRouteStopResponseDto } from './dto/mobile-route-stop-response.dto';
import { MobileRouteDetailResponseDto } from './dto/mobile-route-detail-response.dto';
import { MobileNoticeResponseDto } from './dto/mobile-notice-response.dto';
import { MobileRouteFiltersDto } from './dto/mobile-route-filters.dto';
import { MobileScheduleFiltersDto } from './dto/mobile-schedule-filters.dto';
import { CurrentOperationResponseDto, MobileRoutePaginatedResponseDto } from './dto/mobile-route-response.dto';

type RouteWithCurrentOperation = {
  id: string;
  name: string;
  description: string | null;
  direction: string;
  status: RouteStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentOperation: CurrentOperationResponseDto | null;
};

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRoutes(
    page: number,
    limit: number,
    filters: MobileRouteFiltersDto,
  ): Promise<MobileRoutePaginatedResponseDto> {
    const skip = (page - 1) * limit;
    const where: Prisma.RouteWhereInput = { isActive: true };

    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { direction: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.route.count({ where }),
    ]);

    const data = await Promise.all(routes.map((route) => this.withCurrentOperation(route)));

    return buildPaginatedResponse(data, total, page, limit) as MobileRoutePaginatedResponseDto;
  }

  async findRouteDetail(id: string): Promise<MobileRouteDetailResponseDto> {
    const route = await this.prisma.route.findUnique({
      where: { id, isActive: true },
      include: {
        routeStops: { orderBy: { stopOrder: 'asc' }, include: { stop: true } },
        schedules: { where: { status: ScheduleStatus.ACTIVE }, orderBy: { departureTime: 'asc' } },
      },
    });
    if (!route) throw new NotFoundException(`Active route with id ${id} not found`);

    const currentOperation = await this.buildCurrentOperation(id);

    return {
      route: this.mapRouteToResponse(route),
      stops: route.routeStops.map((routeStop) => this.mapRouteStopToResponse(routeStop)),
      schedules: route.schedules.map((schedule) => this.mapScheduleToResponse(schedule)),
      currentOperation,
    };
  }

  async findRouteStops(routeId: string): Promise<MobileRouteStopResponseDto[]> {
    await this.validateActiveRoute(routeId);

    const routeStops = await this.prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { stopOrder: 'asc' },
      include: { stop: true },
    });
    return routeStops.map((routeStop) => this.mapRouteStopToResponse(routeStop));
  }

  async findRouteSchedules(routeId: string, filters: MobileScheduleFiltersDto): Promise<ScheduleResponseDto[]> {
    await this.validateActiveRoute(routeId);

    const where: Prisma.ScheduleWhereInput = { routeId, status: ScheduleStatus.ACTIVE };
    if (filters.dayOfWeek) where.dayOfWeek = filters.dayOfWeek;
    if (filters.direction) where.direction = filters.direction;

    const schedules = await this.prisma.schedule.findMany({ where, orderBy: { departureTime: 'asc' } });
    return schedules.map((schedule) => this.mapScheduleToResponse(schedule));
  }

  private async validateActiveRoute(routeId: string): Promise<void> {
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, isActive: true },
    });
    if (!route) throw new NotFoundException(`Active route with id ${routeId} not found`);
  }

  async findActiveNotices(page: number, limit: number): Promise<PaginatedResponse<MobileNoticeResponseDto>> {
    const skip = (page - 1) * limit;
    const now = new Date();
    const where: Prisma.NoticeWhereInput = {
      isActive: true,
      publishedFrom: { lte: now },
      OR: [{ publishedUntil: null }, { publishedUntil: { gte: now } }],
    };

    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({ where, skip, take: limit, orderBy: { publishedFrom: 'desc' } }),
      this.prisma.notice.count({ where }),
    ]);

    return buildPaginatedResponse(
      notices.map((notice) => this.mapNoticeToResponse(notice)),
      total,
      page,
      limit,
    );
  }

  private async withCurrentOperation(route: {
    id: string;
    name: string;
    description: string | null;
    direction: string;
    status: RouteStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<RouteWithCurrentOperation> {
    return {
      id: route.id,
      name: route.name,
      description: route.description,
      direction: route.direction,
      status: route.status,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      currentOperation: await this.buildCurrentOperation(route.id),
    };
  }

  private async buildCurrentOperation(routeId: string): Promise<CurrentOperationResponseDto | null> {
    const inProgressTrip = await this.prisma.trip.findFirst({
      where: { routeId, status: TripStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true, code: true } },
      },
    });

    if (inProgressTrip) {
      return {
        status: TripStatus.IN_PROGRESS,
        driver: { id: inProgressTrip.driver.id, name: inProgressTrip.driver.name },
        vehicle: {
          id: inProgressTrip.vehicle.id,
          plate: inProgressTrip.vehicle.plate,
          code: inProgressTrip.vehicle.code,
        },
        startedAt: inProgressTrip.startedAt,
        tripId: inProgressTrip.id,
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const latestAssignment = await this.prisma.routeAssignment.findFirst({
      where: { routeId, isActive: true, serviceDate: { gte: todayStart, lt: todayEnd } },
      orderBy: { serviceDate: 'desc' },
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true, code: true } },
      },
    });

    if (!latestAssignment) return null;

    return {
      status: latestAssignment.status,
      driver: { id: latestAssignment.driver.id, name: latestAssignment.driver.name },
      vehicle: {
        id: latestAssignment.vehicle.id,
        plate: latestAssignment.vehicle.plate,
        code: latestAssignment.vehicle.code,
      },
      startedAt: null,
    };
  }

  private mapRouteToResponse(route: {
    id: string;
    name: string;
    description: string | null;
    direction: string;
    status: RouteStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RouteResponseDto {
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

  private mapRouteStopToResponse(
    routeStop: {
      id: string;
      stopOrder: number;
      estimatedArrivalMinutes: number | null;
      notes: string | null;
      stop: {
        id: string;
        name: string;
        reference: string | null;
        latitude: import('@prisma/client/runtime/library').Decimal;
        longitude: import('@prisma/client/runtime/library').Decimal;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    },
  ): MobileRouteStopResponseDto {
    return {
      id: routeStop.id,
      stopOrder: routeStop.stopOrder,
      estimatedArrivalMinutes: routeStop.estimatedArrivalMinutes,
      notes: routeStop.notes,
      stop: {
        id: routeStop.stop.id,
        name: routeStop.stop.name,
        reference: routeStop.stop.reference,
        latitude: routeStop.stop.latitude.toNumber(),
        longitude: routeStop.stop.longitude.toNumber(),
        isActive: routeStop.stop.isActive,
        createdAt: routeStop.stop.createdAt,
        updatedAt: routeStop.stop.updatedAt,
      },
    };
  }

  private mapScheduleToResponse(schedule: {
    id: string;
    routeId: string;
    dayOfWeek: import('@prisma/client').DayOfWeek;
    direction: string;
    departureTime: string;
    approximateArrivalTime: string | null;
    status: import('@prisma/client').ScheduleStatus;
    createdAt: Date;
    updatedAt: Date;
  }): ScheduleResponseDto {
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

  private mapNoticeToResponse(notice: {
    id: string;
    title: string;
    message: string;
    severity: import('@prisma/client').NoticeSeverity;
    publishedFrom: Date;
    publishedUntil: Date | null;
  }): MobileNoticeResponseDto {
    return {
      id: notice.id,
      title: notice.title,
      message: notice.message,
      severity: notice.severity,
      publishedFrom: notice.publishedFrom,
      publishedUntil: notice.publishedUntil,
    };
  }
}