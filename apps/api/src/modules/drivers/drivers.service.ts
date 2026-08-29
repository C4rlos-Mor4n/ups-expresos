import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Driver, DriverStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverResponseDto } from './dto/driver-response.dto';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateDriverDto, actorId: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.create({
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
      this.prisma.driver.findMany({ skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.driver.count(),
    ]);

    return buildPaginatedResponse(drivers.map((driver) => this.mapDriverToResponse(driver)), total, page, limit);
  }

  async findOne(id: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException(`Driver with id ${id} not found`);
    return this.mapDriverToResponse(driver);
  }

  async remove(id: string, actorId: string): Promise<DriverResponseDto> {
    await this.findOne(id);

    const driver = await this.prisma.driver.update({
      where: { id },
      data: { status: DriverStatus.INACTIVE },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Driver', driver.id, {
      name: driver.name,
    });

    return this.mapDriverToResponse(driver);
  }

  private mapDriverToResponse(driver: Driver): DriverResponseDto {
    return {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      status: driver.status,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
