import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TripStatus, Trip, RouteAssignment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TripDetailResponseDto } from './dto/trip-response.dto';

type TripWithRelations = Trip & {
  assignment: { id: string; serviceDate: Date; status: TripStatus };
  route: { id: string; name: string; direction: string };
  driver: { id: string; name: string };
  vehicle: { id: string; plate: string; code: string };
};

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrentByDriver(driverId: string, tx?: Prisma.TransactionClient): Promise<TripWithRelations | null> {
    const client = tx ?? this.prisma;
    return client.trip.findFirst({
      where: { driverId, status: TripStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      include: this.tripInclude(),
    });
  }

  async findCurrentByVehicle(vehicleId: string, tx?: Prisma.TransactionClient): Promise<Trip | null> {
    const client = tx ?? this.prisma;
    return client.trip.findFirst({
      where: { vehicleId, status: TripStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findInProgressForAssignment(assignmentId: string, tx?: Prisma.TransactionClient): Promise<Trip | null> {
    const client = tx ?? this.prisma;
    return client.trip.findFirst({
      where: { assignmentId, status: TripStatus.IN_PROGRESS },
    });
  }

  async start(
    assignment: RouteAssignment,
    driverId: string,
    startNotes?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<TripDetailResponseDto> {
    const client = tx ?? this.prisma;
    const trip = await client.trip.create({
      data: {
        assignmentId: assignment.id,
        routeId: assignment.routeId,
        driverId,
        vehicleId: assignment.vehicleId,
        status: TripStatus.IN_PROGRESS,
        startedAt: new Date(),
        startNotes: startNotes ?? null,
      },
      include: this.tripInclude(),
    });

    return this.mapToResponse(trip);
  }

  async finish(trip: Trip, endNotes?: string, tx?: Prisma.TransactionClient): Promise<TripDetailResponseDto> {
    const client = tx ?? this.prisma;
    const finished = await client.trip.update({
      where: { id: trip.id },
      data: {
        status: TripStatus.COMPLETED,
        endedAt: new Date(),
        endNotes: endNotes ?? null,
      },
      include: this.tripInclude(),
    });

    return this.mapToResponse(finished);
  }

  async findById(id: string): Promise<Trip | null> {
    return this.prisma.trip.findUnique({ where: { id } });
  }

  async getDetail(id: string): Promise<TripDetailResponseDto> {
    const trip = await this.prisma.trip.findUnique({ where: { id }, include: this.tripInclude() });
    if (!trip) throw new NotFoundException(`Trip with id ${id} not found`);
    return this.mapToResponse(trip);
  }

  private tripInclude(): Prisma.TripInclude {
    return {
      assignment: { select: { id: true, serviceDate: true, status: true } },
      route: { select: { id: true, name: true, direction: true } },
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plate: true, code: true } },
    };
  }

  private mapToResponse(trip: TripWithRelations): TripDetailResponseDto {
    return {
      id: trip.id,
      assignmentId: trip.assignmentId,
      routeId: trip.routeId,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      status: trip.status,
      startedAt: trip.startedAt,
      endedAt: trip.endedAt,
      startNotes: trip.startNotes,
      endNotes: trip.endNotes,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      assignment: trip.assignment,
      route: trip.route,
      driver: trip.driver,
      vehicle: trip.vehicle,
    };
  }
}