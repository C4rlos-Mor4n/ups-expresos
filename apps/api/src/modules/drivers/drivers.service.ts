import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Driver, DriverStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { LinkDriverAccountDto } from './dto/link-driver-account.dto';

// La cuenta vinculada se expone solo por su correo.
const withAccount = { user: { select: { email: true } } } as const;
type DriverWithAccount = Driver & { user?: { email: string } | null };

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateDriverDto, actorId: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.create({
      include: withAccount,
      data: {
        name: dto.name,
        phone: dto.phone ?? null,
        licenseNumber: dto.licenseNumber ?? null,
        status: dto.status ?? DriverStatus.ACTIVE,
      },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Driver', driver.id, {
      name: driver.name,
    });

    return this.mapDriverToResponse(driver);
  }

  async update(id: string, dto: UpdateDriverDto, actorId: string): Promise<DriverResponseDto> {
    await this.findOne(id);
    const driver = await this.prisma.driver.update({
      where: { id },
      include: withAccount,
      data: {
        name: dto.name,
        phone: dto.phone,
        licenseNumber: dto.licenseNumber,
        status: dto.status,
      } as Prisma.DriverUpdateInput,
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Driver', driver.id, {
      name: driver.name,
    });

    return this.mapDriverToResponse(driver);
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<DriverResponseDto>> {
    const skip = (page - 1) * limit;
    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({ skip, take: limit, orderBy: { name: 'asc' }, include: withAccount }),
      this.prisma.driver.count(),
    ]);

    return buildPaginatedResponse(drivers.map((driver) => this.mapDriverToResponse(driver)), total, page, limit);
  }

  async findOne(id: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.findUnique({ where: { id }, include: withAccount });
    if (!driver) throw new NotFoundException(`Driver with id ${id} not found`);
    return this.mapDriverToResponse(driver);
  }

  async remove(id: string, actorId: string): Promise<DriverResponseDto> {
    await this.findOne(id);

    const driver = await this.prisma.driver.update({
      where: { id },
      include: withAccount,
      data: { status: DriverStatus.INACTIVE },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Driver', driver.id, {
      name: driver.name,
    });

    return this.mapDriverToResponse(driver);
  }

  /**
   * Da acceso a la app al conductor: vincula (o crea) la cuenta del correo y le asigna rol DRIVER.
   * Las cuentas existentes inician sesión con cualquier dominio, así que el conductor no necesita correo UPS.
   */
  async linkAccount(id: string, dto: LinkDriverAccountDto, actorId: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.$transaction(async (tx) => {
      const current = await tx.driver.findUnique({ where: { id }, include: withAccount });
      if (!current) throw new NotFoundException(`Driver with id ${id} not found`);

      const existing = await tx.user.findUnique({
        where: { email: dto.email },
        include: { driverProfile: { select: { id: true } } },
      });
      if (current.userId && current.userId !== existing?.id) {
        throw new ConflictException('El conductor ya tiene una cuenta vinculada; desvincúlala primero');
      }
      if (existing) {
        if (existing.role === UserRole.ADMIN || existing.role === UserRole.SUPER_ADMIN) {
          throw new ConflictException('Ese correo pertenece a un administrador');
        }
        if (existing.driverProfile && existing.driverProfile.id !== id) {
          throw new ConflictException('Ese correo ya está vinculado a otro conductor');
        }
        if (!existing.isActive) {
          throw new ConflictException('Esa cuenta está desactivada');
        }
      }

      // El nombre de la ficha del conductor se usa para saludarlo en la app si la cuenta no tiene uno.
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { role: UserRole.DRIVER, name: existing.name ?? current.name },
          })
        : await tx.user.create({ data: { email: dto.email, role: UserRole.DRIVER, name: current.name } });

      return tx.driver.update({ where: { id }, data: { userId: user.id }, include: withAccount });
    });

    await this.auditLogsService.logAction(actorId, 'LINK_ACCOUNT', 'Driver', driver.id, {
      email: dto.email,
    });
    return this.mapDriverToResponse(driver);
  }

  /** Quita el acceso: desvincula la cuenta, la devuelve a STUDENT y revoca sus sesiones. */
  async unlinkAccount(id: string, actorId: string): Promise<DriverResponseDto> {
    const { driver, email } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.driver.findUnique({ where: { id }, include: withAccount });
      if (!current) throw new NotFoundException(`Driver with id ${id} not found`);
      if (!current.userId) throw new ConflictException('El conductor no tiene una cuenta vinculada');

      await tx.user.update({ where: { id: current.userId }, data: { role: UserRole.STUDENT } });
      await tx.session.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const updated = await tx.driver.update({
        where: { id },
        data: { userId: null },
        include: withAccount,
      });
      return { driver: updated, email: current.user?.email ?? null };
    });

    await this.auditLogsService.logAction(actorId, 'UNLINK_ACCOUNT', 'Driver', driver.id, { email });
    return this.mapDriverToResponse(driver);
  }

  private mapDriverToResponse(driver: DriverWithAccount): DriverResponseDto {
    return {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      accountEmail: driver.user?.email ?? null,
      status: driver.status,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
