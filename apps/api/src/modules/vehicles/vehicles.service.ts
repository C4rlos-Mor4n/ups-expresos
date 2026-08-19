import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Vehicle, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { PaginatedResponse } from '../../common/types/pagination.type';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateVehicleDto, actorId: string): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.create({
      data: {
        plate: dto.plate,
        code: dto.code,
        capacity: dto.capacity,
        status: dto.status ?? VehicleStatus.ACTIVE,
      },
    });

    await this.auditLogsService.logAction(actorId, 'CREATE', 'Vehicle', vehicle.id, {
      plate: vehicle.plate,
      code: vehicle.code,
    });

    return this.mapVehicleToResponse(vehicle);
  }

  async update(id: string, dto: UpdateVehicleDto, actorId: string): Promise<VehicleResponseDto> {
    await this.findOne(id);

    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate,
        code: dto.code,
        capacity: dto.capacity,
        status: dto.status,
      } as Prisma.VehicleUpdateInput,
    });

    await this.auditLogsService.logAction(actorId, 'UPDATE', 'Vehicle', vehicle.id, {
      plate: vehicle.plate,
      code: vehicle.code,
    });

    return this.mapVehicleToResponse(vehicle);
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<VehicleResponseDto>> {
    const skip = (page - 1) * limit;
    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({ skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.vehicle.count(),
    ]);

    return buildPaginatedResponse(vehicles.map((vehicle) => this.mapVehicleToResponse(vehicle)), total, page, limit);
  }

  async findOne(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException(`Vehicle with id ${id} not found`);
    return this.mapVehicleToResponse(vehicle);
  }

  async remove(id: string, actorId: string): Promise<VehicleResponseDto> {
    await this.findOne(id);

    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { status: VehicleStatus.INACTIVE },
    });

    await this.auditLogsService.logAction(actorId, 'DELETE', 'Vehicle', vehicle.id, {
      plate: vehicle.plate,
      code: vehicle.code,
    });

    return this.mapVehicleToResponse(vehicle);
  }

  private mapVehicleToResponse(vehicle: Vehicle): VehicleResponseDto {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      code: vehicle.code,
      capacity: vehicle.capacity,
      status: vehicle.status,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}
