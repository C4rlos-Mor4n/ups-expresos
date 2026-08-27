import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TripsService } from '../trips/trips.service';
import { StartTripDto } from './dto/start-trip.dto';
import { FinishTripDto } from './dto/finish-trip.dto';
import { DriverAssignmentResponseDto } from './dto/driver-assignment-response.dto';
import { CurrentTripResponseDto } from './dto/current-trip-response.dto';
import { TripDetailResponseDto } from '../trips/dto/trip-response.dto';

@Injectable()
export class DriverOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getTodayAssignments(userId: string, role: string, driverIdParam?: string): Promise<DriverAssignmentResponseDto[]> {
    const driverId = await this.resolveDriverId(userId, role, driverIdParam);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const assignments = await this.prisma.routeAssignment.findMany({
      where: {
        driverId,
        serviceDate: { gte: start, lt: end },
      },
      orderBy: { serviceDate: 'asc' },
      include: {
        route: { select: { id: true, name: true, description: true, direction: true } },
        vehicle: { select: { id: true, plate: true, code: true, capacity: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    return assignments.map((a) => this.mapAssignmentToResponse(a));
  }

  async startTrip(userId: string, role: string, dto: StartTripDto): Promise<TripDetailResponseDto> {
    const driverId = await this.resolveDriverId(userId, role);

    const assignment = await this.prisma.routeAssignment.findUnique({
      where: { id: dto.assignmentId },
    });
    if (!assignment) throw new NotFoundException(`Route assignment with id ${dto.assignmentId} not found`);
    if (!assignment.isActive) throw new BadRequestException('Assignment is not active');
    if (assignment.driverId !== driverId) {
      throw new ForbiddenException('Assignment does not belong to the authenticated driver');
    }
    if (assignment.status === TripStatus.SUSPENDED) {
      throw new BadRequestException('Assignment is suspended');
    }

    // Transacción serializable: evita carreras TOCTOU donde dos peticiones concurrentes
    // podrían crear dos trips IN_PROGRESS para el mismo conductor o vehículo.
    try {
      const trip = await this.prisma.$transaction(
        async (tx) => {
          const activeDriverTrip = await this.tripsService.findCurrentByDriver(driverId, tx);
          if (activeDriverTrip) {
            throw new ConflictException('Driver already has a trip in progress');
          }

          const activeVehicleTrip = await this.tripsService.findCurrentByVehicle(assignment.vehicleId, tx);
          if (activeVehicleTrip) {
            throw new ConflictException('Vehicle already has a trip in progress');
          }

          const created = await this.tripsService.start(assignment, driverId, dto.startNotes, tx);

          await tx.routeAssignment.update({
            where: { id: assignment.id },
            data: { status: TripStatus.IN_PROGRESS },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.auditLogsService.logAction(userId, 'TRIP_START', 'Trip', trip.id, {
        assignmentId: assignment.id,
        routeId: assignment.routeId,
        vehicleId: assignment.vehicleId,
      });

      return trip;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Concurrent trip start detected. Please retry.');
      }
      throw error;
    }
  }

  async finishTrip(userId: string, role: string, tripId: string, dto: FinishTripDto): Promise<TripDetailResponseDto> {
    const driverId = await this.resolveDriverId(userId, role);

    const trip = await this.tripsService.findById(tripId);
    if (!trip) throw new NotFoundException(`Trip with id ${tripId} not found`);
    if (trip.driverId !== driverId) {
      throw new ForbiddenException('Trip does not belong to the authenticated driver');
    }
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new ConflictException('Trip is not in progress');
    }

    const finished = await this.tripsService.finish(trip, dto.endNotes);

    await this.prisma.routeAssignment.update({
      where: { id: trip.assignmentId },
      data: { status: TripStatus.COMPLETED },
    });

    await this.auditLogsService.logAction(userId, 'TRIP_FINISH', 'Trip', trip.id, {
      assignmentId: trip.assignmentId,
      routeId: trip.routeId,
      vehicleId: trip.vehicleId,
    });

    return finished;
  }

  async getCurrentTrip(userId: string, role: string): Promise<CurrentTripResponseDto | null> {
    const driverId = await this.resolveDriverId(userId, role);

    const trip = await this.prisma.trip.findFirst({
      where: { driverId, status: TripStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      include: {
        route: { select: { id: true, name: true, direction: true } },
        vehicle: { select: { id: true, plate: true, code: true } },
        assignment: { select: { id: true, serviceDate: true, status: true } },
      },
    });

    if (!trip) return null;

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
      route: trip.route,
      vehicle: trip.vehicle,
      assignment: trip.assignment,
    };
  }

  private async resolveDriverId(userId: string, role: string, driverIdParam?: string): Promise<string> {
    if (driverIdParam) {
      if (role === 'DRIVER') {
        throw new ForbiddenException('Drivers cannot query another driver');
      }
      const driver = await this.prisma.driver.findUnique({ where: { id: driverIdParam } });
      if (!driver) throw new NotFoundException(`Driver with id ${driverIdParam} not found`);
      return driver.id;
    }

    if (role === 'DRIVER') {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) throw new NotFoundException('Driver profile not found for authenticated user');
      return driver.id;
    }

    throw new BadRequestException('driverId query parameter is required for non-driver roles');
  }

  private mapAssignmentToResponse(assignment: {
    id: string;
    routeId: string;
    serviceDate: Date;
    status: TripStatus;
    notes: string | null;
    suspendReason: string | null;
    route: { id: string; name: string; description: string | null; direction: string };
    vehicle: { id: string; plate: string; code: string; capacity: number };
    driver: { id: string; name: string; phone: string | null };
  }): DriverAssignmentResponseDto {
    return {
      id: assignment.id,
      routeId: assignment.routeId,
      serviceDate: assignment.serviceDate,
      status: assignment.status,
      notes: assignment.notes,
      suspendReason: assignment.suspendReason,
      route: assignment.route,
      vehicle: assignment.vehicle,
      driver: assignment.driver,
    };
  }
}