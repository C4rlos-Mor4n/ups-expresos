import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, TripStatus, RouteAssignment, DriverStatus, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateRouteAssignmentDto } from './dto/create-route-assignment.dto';
import { UpdateRouteAssignmentDto } from './dto/update-route-assignment.dto';
import { RouteAssignmentQueryDto } from './dto/route-assignment-query.dto';
import { RouteAssignmentResponseDto } from './dto/route-assignment-response.dto';

type RouteAssignmentWithRelations = RouteAssignment & {
  route: { id: string; name: string; direction: string };
  driver: { id: string; name: string };
  vehicle: { id: string; plate: string; code: string };
};

@Injectable()
export class RouteAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateRouteAssignmentDto, actorId: string): Promise<RouteAssignmentResponseDto> {
    const serviceDate = new Date(dto.serviceDate);

    const [route, driver, vehicle] = await Promise.all([
      this.prisma.route.findUnique({ where: { id: dto.routeId } }),
      this.prisma.driver.findUnique({ where: { id: dto.driverId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
    ]);

    if (!route) throw new NotFoundException(`Route with id ${dto.routeId} not found`);
    if (!driver) throw new NotFoundException(`Driver with id ${dto.driverId} not found`);
    if (!vehicle) throw new NotFoundException(`Vehicle with id ${dto.vehicleId} not found`);

    if (driver.status !== DriverStatus.ACTIVE) {
      throw new BadRequestException(`Driver with id ${dto.driverId} is not active`);
    }
    if (vehicle.status !== VehicleStatus.ACTIVE) {
      throw new BadRequestException(`Vehicle with id ${dto.vehicleId} is not active`);
    }

    await this.assertNoConflictingAssignment(dto, serviceDate);

    const assignment = await this.prisma.routeAssignment.create({
      data: {
        routeId: dto.routeId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        serviceDate,
        notes: dto.notes ?? null,
        status: TripStatus.SCHEDULED,
        isActive: true,
      },
      include: this.assignmentInclude(),
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'RouteAssignment', assignment.id, {
      routeId: assignment.routeId,
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      serviceDate: assignment.serviceDate.toISOString(),
    });

    return this.mapToResponse(assignment);
  }

  async findAll(query: RouteAssignmentQueryDto): Promise<PaginatedResponse<RouteAssignmentResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RouteAssignmentWhereInput = {};
    if (query.serviceDate) {
      const start = new Date(query.serviceDate);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where.serviceDate = { gte: start, lt: end };
    }
    if (query.routeId) where.routeId = query.routeId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status;

    const [assignments, total] = await Promise.all([
      this.prisma.routeAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { serviceDate: 'asc' },
        include: this.assignmentInclude(),
      }),
      this.prisma.routeAssignment.count({ where }),
    ]);

    return buildPaginatedResponse(assignments.map((a) => this.mapToResponse(a)), total, page, limit);
  }

  async findOne(id: string): Promise<RouteAssignmentResponseDto> {
    const assignment = await this.prisma.routeAssignment.findUnique({
      where: { id },
      include: this.assignmentInclude(),
    });
    if (!assignment) throw new NotFoundException(`Route assignment with id ${id} not found`);
    return this.mapToResponse(assignment);
  }

  async update(id: string, dto: UpdateRouteAssignmentDto, actorId: string): Promise<RouteAssignmentResponseDto> {
    const existing = await this.prisma.routeAssignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Route assignment with id ${id} not found`);

    await this.assertNoInProgressTrip(id);

    const routeId = dto.routeId ?? existing.routeId;
    const driverId = dto.driverId ?? existing.driverId;
    const vehicleId = dto.vehicleId ?? existing.vehicleId;

    if (dto.routeId || dto.driverId || dto.vehicleId) {
      await this.validateReferences(dto.routeId ?? existing.routeId, dto.driverId ?? existing.driverId, dto.vehicleId ?? existing.vehicleId);
    }

    const serviceDate = dto.serviceDate ? new Date(dto.serviceDate) : existing.serviceDate;

    if (dto.routeId || dto.driverId || dto.vehicleId || dto.serviceDate) {
      await this.assertNoConflictingAssignment(
        { routeId, driverId, vehicleId, serviceDate: serviceDate.toISOString() },
        serviceDate,
        id,
      );
    }

    const assignment = await this.prisma.routeAssignment.update({
      where: { id },
      data: {
        routeId,
        driverId,
        vehicleId,
        serviceDate,
        notes: dto.notes ?? existing.notes,
      },
      include: this.assignmentInclude(),
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'RouteAssignment', assignment.id, {
      routeId,
      driverId,
      vehicleId,
      serviceDate: serviceDate.toISOString(),
    });

    return this.mapToResponse(assignment);
  }

  async suspend(id: string, actorId: string, reason?: string): Promise<RouteAssignmentResponseDto> {
    const existing = await this.prisma.routeAssignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Route assignment with id ${id} not found`);

    await this.assertNoInProgressTrip(id);

    const assignment = await this.prisma.routeAssignment.update({
      where: { id },
      data: {
        status: TripStatus.SUSPENDED,
        isActive: false,
        suspendReason: reason ?? null,
        suspendedAt: new Date(),
      },
      include: this.assignmentInclude(),
    });

    await this.auditLogsService.logAction(actorId, 'SUSPEND', 'RouteAssignment', assignment.id, {
      reason: reason ?? null,
    });

    return this.mapToResponse(assignment);
  }

  private async validateReferences(routeId: string, driverId: string, vehicleId: string): Promise<void> {
    const [route, driver, vehicle] = await Promise.all([
      this.prisma.route.findUnique({ where: { id: routeId } }),
      this.prisma.driver.findUnique({ where: { id: driverId } }),
      this.prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    ]);

    if (!route) throw new NotFoundException(`Route with id ${routeId} not found`);
    if (!driver) throw new NotFoundException(`Driver with id ${driverId} not found`);
    if (!vehicle) throw new NotFoundException(`Vehicle with id ${vehicleId} not found`);

    if (driver.status !== DriverStatus.ACTIVE) {
      throw new BadRequestException(`Driver with id ${driverId} is not active`);
    }
    if (vehicle.status !== VehicleStatus.ACTIVE) {
      throw new BadRequestException(`Vehicle with id ${vehicleId} is not active`);
    }
  }

  private async assertNoConflictingAssignment(
    dto: { routeId: string; driverId: string; vehicleId: string; serviceDate: string },
    serviceDate: Date,
    excludeId?: string,
  ): Promise<void> {
    const start = new Date(serviceDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const conflict = await this.prisma.routeAssignment.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        serviceDate: { gte: start, lt: end },
        OR: [
          { driverId: dto.driverId },
          { vehicleId: dto.vehicleId },
          { routeId: dto.routeId },
        ],
        isActive: true,
      },
    });

    if (conflict) {
      throw new ConflictException(
        `A conflicting assignment already exists for the same date (driver, vehicle or route already assigned)`,
      );
    }
  }

  private async assertNoInProgressTrip(assignmentId: string): Promise<void> {
    const inProgressTrip = await this.prisma.trip.findFirst({
      where: { assignmentId, status: TripStatus.IN_PROGRESS },
    });
    if (inProgressTrip) {
      throw new ConflictException('Cannot modify assignment while a trip is in progress');
    }
  }

  private assignmentInclude(): Prisma.RouteAssignmentInclude {
    return {
      route: { select: { id: true, name: true, direction: true } },
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plate: true, code: true } },
    };
  }

  private mapToResponse(assignment: RouteAssignmentWithRelations): RouteAssignmentResponseDto {
    return {
      id: assignment.id,
      routeId: assignment.routeId,
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      serviceDate: assignment.serviceDate,
      status: assignment.status,
      notes: assignment.notes,
      isActive: assignment.isActive,
      suspendReason: assignment.suspendReason,
      suspendedAt: assignment.suspendedAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      route: assignment.route,
      driver: assignment.driver,
      vehicle: assignment.vehicle,
    };
  }
}