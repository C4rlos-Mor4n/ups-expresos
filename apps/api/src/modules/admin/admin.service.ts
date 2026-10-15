import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  ServiceAssignmentStatus,
  ServiceRunStatus,
  TrackingPointKind,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { guayaquilToday, nextCivilDate, parseCivilDate } from '../operational/operational-time.functions';
import { TrackingService } from '../tracking/tracking.service';
import { AdminUsersQueryDto, AuditLogsQueryDto, UpdateAdminUserDto } from './dto/admin.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly tracking: TrackingService,
  ) {}

  async listUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'desc' }, { email: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
      }),
    ]);
    return { items: users.map((u) => this.mapUser(u)), total, page, limit };
  }

  private mapUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    sessions?: Array<{ createdAt: Date }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.sessions?.[0]?.createdAt ?? null,
    };
  }

  /**
   * Cambia rol o estado de una cuenta.
   * - Nadie se modifica a sí mismo (evita quedarse sin acceso).
   * - Solo SUPER_ADMIN otorga/quita roles administrativos o modifica administradores.
   * - DRIVER no se asigna aquí: se vincula la cuenta desde /admin/drivers/:id/account.
   * - Desactivar revoca todas las sesiones abiertas.
   */
  async updateUser(actor: { sub: string; role: UserRole }, userId: string, dto: UpdateAdminUserDto) {
    if (actor.sub === userId) throw new ForbiddenException('You cannot modify your own account');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const touchesAdmin = ADMIN_ROLES.includes(user.role) || (dto.role && ADMIN_ROLES.includes(dto.role));
    if (touchesAdmin && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can manage administrator accounts');
    }
    const changesRole = dto.role !== undefined && dto.role !== user.role;
    if (changesRole && (dto.role === UserRole.DRIVER || user.role === UserRole.DRIVER)) {
      throw new ConflictException('DRIVER_ROLE_MANAGED_BY_DRIVER_PROFILE: link or unlink the account from the driver');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (dto.isActive === false || (dto.role && dto.role !== user.role)) {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return result;
    });
    await this.auditLogs.logAction(actor.sub, 'USER_UPDATE', 'User', userId, {
      email: user.email,
      from: { role: user.role, isActive: user.isActive },
      to: { role: updated.role, isActive: updated.isActive },
    });
    return this.mapUser(updated);
  }

  async listAuditLogs(query: AuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.AuditLogWhereInput = query.entity ? { entity: query.entity } : {};
    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { email: true } } },
      }),
    ]);
    return {
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt,
        actorEmail: log.actor?.email ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async dashboard(dateValue?: string) {
    const date = parseCivilDate(dateValue ?? guayaquilToday()) ?? parseCivilDate(guayaquilToday())!;
    const day = { gte: date, lt: nextCivilDate(date) };
    const [departures, departuresWithoutBus, assignments, runsInProgress, runsCompleted, activeVehicles, activeDrivers, devices, unboundDevices, alerts24h, users] =
      await Promise.all([
        this.prisma.scheduledDeparture.count({ where: { serviceDate: day } }),
        this.prisma.scheduledDeparture.count({
          where: { serviceDate: day, serviceAssignments: { none: { status: ServiceAssignmentStatus.ASSIGNED } } },
        }),
        this.prisma.serviceAssignment.count({
          where: { status: ServiceAssignmentStatus.ASSIGNED, scheduledDeparture: { serviceDate: day } },
        }),
        this.prisma.serviceRun.count({ where: { status: ServiceRunStatus.IN_PROGRESS } }),
        this.prisma.serviceRun.count({
          where: { status: ServiceRunStatus.COMPLETED, serviceAssignment: { scheduledDeparture: { serviceDate: day } } },
        }),
        this.prisma.vehicle.count({ where: { status: VehicleStatus.ACTIVE } }),
        this.prisma.driver.count({ where: { status: DriverStatus.ACTIVE } }),
        this.prisma.trackingDevice.findMany({ where: { vehicleId: { not: null }, isActive: true } }),
        this.prisma.trackingDevice.count({ where: { vehicleId: null, isActive: true } }),
        this.prisma.trackingPoint.count({
          where: { kind: TrackingPointKind.ALERT, occurredAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),
        this.prisma.user.count({ where: { isActive: true } }),
      ]);
    const now = new Date();
    const vehiclesLive = devices.filter((d) => this.tracking.toPosition(d, now)?.freshness === 'LIVE').length;
    return {
      date: date.toISOString().slice(0, 10),
      departures,
      departuresWithoutBus,
      assignments,
      runsInProgress,
      runsCompleted,
      activeVehicles,
      activeDrivers,
      vehiclesLive,
      unboundDevices,
      alerts24h,
      users,
    };
  }
}
