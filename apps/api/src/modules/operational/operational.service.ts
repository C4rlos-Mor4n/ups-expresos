import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  ServiceAssignmentStatus,
  ServiceRunStatus,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AdminOperationalAssignmentsQueryDto,
  CreateServiceAssignmentDto,
} from './dto/operational.dto';
import {
  calculatePlannedWindow,
  civilDateToIso,
  guayaquilToday,
  nextCivilDate,
  parseCivilDate,
} from './operational-time.functions';

const assignmentInclude = {
  scheduledDeparture: {
    select: {
      id: true,
      serviceDate: true,
      scheduledTime: true,
      direction: true,
      serviceLine: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          campus: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  vehicle: { select: { id: true, code: true, plate: true, capacity: true } },
  driver: { select: { id: true, name: true } },
  journeyTemplate: {
    select: {
      id: true,
      routePath: {
        select: {
          id: true,
          code: true,
          displayName: true,
          direction: true,
          stops: {
            orderBy: { stopOrder: 'asc' },
            select: {
              stopOrder: true,
              stop: { select: { id: true, name: true, reference: true } },
            },
          },
        },
      },
    },
  },
  serviceRun: { select: { id: true, status: true, startedAt: true, completedAt: true } },
} satisfies Prisma.ServiceAssignmentInclude;

type AssignmentRecord = Prisma.ServiceAssignmentGetPayload<{ include: typeof assignmentInclude }>;

const formatTime = (value: Date): string => value.toISOString().slice(11, 19);

const operationalState = (assignment: AssignmentRecord): 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' => {
  if (!assignment.serviceRun) return 'ASSIGNED';
  return assignment.serviceRun.status;
};

const conflictMessage = (error: unknown): string | null => {
  if (!(error instanceof Error)) return null;
  if (error.message.includes('service_assignments_vehicle_window_excl')) {
    return 'VEHICLE_CONFLICT: vehicle has an incompatible planned window';
  }
  if (error.message.includes('service_assignments_driver_window_excl')) {
    return 'DRIVER_CONFLICT: driver has an incompatible planned window';
  }
  return null;
};

@Injectable()
export class OperationalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createAssignment(dto: CreateServiceAssignmentDto, actorId: string): Promise<ReturnType<OperationalService['mapAdminAssignment']>> {
    const [departure, journeyTemplate, vehicle, driver] = await Promise.all([
      this.prisma.scheduledDeparture.findUnique({
        where: { id: dto.scheduledDepartureId },
        select: {
          id: true,
          sourceScheduleTimeId: true,
          serviceLineId: true,
          serviceDate: true,
          scheduledTime: true,
          direction: true,
        },
      }),
      this.prisma.scheduleJourneyTemplate.findUnique({
        where: { id: dto.journeyTemplateId },
        include: {
          routePath: { select: { serviceLineId: true, direction: true } },
          stopTimes: { select: { offsetMinutes: true } },
        },
      }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
      this.prisma.driver.findUnique({ where: { id: dto.driverId } }),
    ]);

    if (!departure) throw new NotFoundException('Scheduled departure not found');
    if (!journeyTemplate) throw new NotFoundException('Schedule journey template not found');
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!driver) throw new NotFoundException('Driver not found');
    if (vehicle.status !== VehicleStatus.ACTIVE) throw new BadRequestException('Vehicle is not active');
    if (driver.status !== DriverStatus.ACTIVE) throw new BadRequestException('Driver is not active');

    if (
      journeyTemplate.scheduleTimeId !== departure.sourceScheduleTimeId ||
      journeyTemplate.routePath.serviceLineId !== departure.serviceLineId ||
      journeyTemplate.routePath.direction !== departure.direction
    ) {
      throw new ConflictException('INVALID_JOURNEY: journey template does not belong to this departure');
    }

    const maximumOffsetMinutes = Math.max(...journeyTemplate.stopTimes.map((stopTime) => stopTime.offsetMinutes));
    const plannedWindow = calculatePlannedWindow(
      departure.serviceDate,
      departure.scheduledTime,
      maximumOffsetMinutes,
    );
    if (!plannedWindow) {
      throw new ConflictException(
        'INVALID_JOURNEY: journey template needs a positive final scheduled stop offset',
      );
    }

    let assignment: AssignmentRecord;
    try {
      assignment = await this.prisma.serviceAssignment.create({
        data: {
          scheduledDepartureId: departure.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          journeyTemplateId: journeyTemplate.id,
          plannedStartAt: plannedWindow.plannedStartAt,
          plannedEndAt: plannedWindow.plannedEndAt,
        },
        include: assignmentInclude,
      });
    } catch (error) {
      const message = conflictMessage(error);
      if (message) throw new ConflictException(message);
      throw error;
    }

    await this.auditLogsService.logAction(actorId, 'SERVICE_ASSIGNMENT_CREATE', 'ServiceAssignment', assignment.id, {
      scheduledDepartureId: assignment.scheduledDepartureId,
      vehicleId: assignment.vehicleId,
      driverId: assignment.driverId,
      journeyTemplateId: assignment.journeyTemplateId,
    });
    return this.mapAdminAssignment(assignment);
  }

  async listAdminAssignments(query: AdminOperationalAssignmentsQueryDto): Promise<{
    data: Array<ReturnType<OperationalService['mapAdminAssignment']>>;
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const date = query.date ? this.requiredCivilDate(query.date) : null;
    const where: Prisma.ServiceAssignmentWhereInput = {
      ...(date
        ? {
            scheduledDeparture: {
              serviceDate: { gte: date, lt: nextCivilDate(date) },
              ...(query.serviceLineId ? { serviceLineId: query.serviceLineId } : {}),
            },
          }
        : query.serviceLineId
          ? { scheduledDeparture: { serviceLineId: query.serviceLineId } }
          : {}),
    };
    const [assignments, total] = await Promise.all([
      this.prisma.serviceAssignment.findMany({
        where,
        orderBy: { plannedStartAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: assignmentInclude,
      }),
      this.prisma.serviceAssignment.count({ where }),
    ]);
    return {
      data: assignments.map((assignment) => this.mapAdminAssignment(assignment)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listAdminRuns(query: AdminOperationalAssignmentsQueryDto): Promise<{
    data: Array<ReturnType<OperationalService['mapAdminAssignment']>>;
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const civilDate = query.date ? this.requiredCivilDate(query.date) : null;
    const where: Prisma.ServiceAssignmentWhereInput = {
      serviceRun: { isNot: null },
      ...(civilDate
        ? {
            scheduledDeparture: {
              serviceDate: { gte: civilDate, lt: nextCivilDate(civilDate) },
              ...(query.serviceLineId ? { serviceLineId: query.serviceLineId } : {}),
            },
          }
        : query.serviceLineId
          ? { scheduledDeparture: { serviceLineId: query.serviceLineId } }
          : {}),
    };
    const [assignments, total] = await Promise.all([
      this.prisma.serviceAssignment.findMany({
        where,
        orderBy: { plannedStartAt: 'asc' },
        include: assignmentInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.serviceAssignment.count({ where }),
    ]);
    return {
      data: assignments.map((assignment) => this.mapAdminAssignment(assignment)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStudentCampuses(): Promise<Array<{ id: string; code: string; name: string; address: string | null }>> {
    return this.prisma.campus.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAdminCampuses() {
    return this.prisma.campus.findMany({
      select: { id: true, code: true, name: true, address: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAdminServiceLines(campusId?: string) {
    return this.prisma.serviceLine.findMany({
      where: campusId ? { campusId } : undefined,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        isActive: true,
        campus: { select: { id: true, code: true, name: true } },
        destinationCampus: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ campus: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async getAdminServiceLineTimetable(serviceLineId: string, dateValue?: string) {
    const serviceDate = this.requiredCivilDate(dateValue ?? guayaquilToday());
    const line = await this.prisma.serviceLine.findUnique({
      where: { id: serviceLineId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        campus: { select: { id: true, code: true, name: true } },
        paths: {
          select: {
            id: true,
            code: true,
            displayName: true,
            direction: true,
            isActive: true,
            stops: {
              orderBy: { stopOrder: 'asc' },
              select: { stopOrder: true, stop: { select: { id: true, name: true, reference: true } } },
            },
          },
          orderBy: [{ direction: 'asc' }, { code: 'asc' }],
        },
        calendars: {
          select: {
            id: true,
            name: true,
            validFrom: true,
            validUntil: true,
            timezone: true,
            status: true,
            patterns: {
              select: {
                id: true,
                direction: true,
                status: true,
                days: { select: { weekday: true } },
                times: {
                  select: {
                    id: true,
                    departureTime: true,
                    approximateArrivalTime: true,
                    journeyTemplates: { select: { id: true, routePathId: true } },
                  },
                  orderBy: { departureTime: 'asc' },
                },
              },
            },
          },
          orderBy: { validFrom: 'desc' },
        },
      },
    });
    if (!line) throw new NotFoundException('Service line not found');
    const departures = await this.prisma.scheduledDeparture.findMany({
      where: { serviceLineId, serviceDate },
      orderBy: [{ direction: 'asc' }, { scheduledTime: 'asc' }],
      include: { serviceAssignments: { include: assignmentInclude, orderBy: { plannedStartAt: 'asc' } } },
    });
    return {
      serviceDate: civilDateToIso(serviceDate),
      line,
      scheduledDepartures: departures.map((departure) => ({
        id: departure.id,
        scheduledTime: formatTime(departure.scheduledTime),
        direction: departure.direction,
        assignments: departure.serviceAssignments.map((assignment) => this.mapAdminAssignment(assignment)),
      })),
    };
  }

  async getStudentServiceLines(campusId: string): Promise<Array<{ id: string; code: string; name: string; description: string | null }>> {
    const campus = await this.prisma.campus.findFirst({ where: { id: campusId, isActive: true } });
    if (!campus) throw new NotFoundException('Active campus not found');
    return this.prisma.serviceLine.findMany({
      where: { campusId, isActive: true },
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  async getStudentDepartures(serviceLineId: string, dateValue: string, direction?: 'IDA' | 'RETORNO'): Promise<Array<{
    id: string;
    serviceDate: string;
    scheduledTime: string;
    direction: 'IDA' | 'RETORNO';
    state: 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
    assignmentCount: number;
  }>> {
    const serviceDate = this.requiredCivilDate(dateValue);
    const serviceLine = await this.prisma.serviceLine.findFirst({
      where: { id: serviceLineId, isActive: true, campus: { isActive: true } },
      select: { id: true },
    });
    if (!serviceLine) throw new NotFoundException('Active service line not found');

    const departures = await this.prisma.scheduledDeparture.findMany({
      where: {
        serviceLineId,
        serviceDate,
        ...(direction ? { direction } : {}),
      },
      orderBy: [{ scheduledTime: 'asc' }, { id: 'asc' }],
      include: {
        serviceAssignments: {
          where: { status: ServiceAssignmentStatus.ASSIGNED },
          select: { status: true, serviceRun: { select: { status: true } } },
        },
      },
    });

    return departures.map((departure) => {
      const states = departure.serviceAssignments.map((assignment) => assignment.serviceRun?.status ?? 'ASSIGNED');
      const state = states.includes(ServiceRunStatus.IN_PROGRESS)
        ? 'IN_PROGRESS'
        : states.includes(ServiceRunStatus.COMPLETED)
          ? 'COMPLETED'
          : states.includes('ASSIGNED')
            ? 'ASSIGNED'
            : 'SCHEDULED';
      return {
        id: departure.id,
        serviceDate: civilDateToIso(departure.serviceDate),
        scheduledTime: formatTime(departure.scheduledTime),
        direction: departure.direction,
        state,
        assignmentCount: departure.serviceAssignments.length,
      };
    });
  }

  async getStudentDepartureDetail(id: string): Promise<ReturnType<OperationalService['mapStudentDeparture']>> {
    const departure = await this.prisma.scheduledDeparture.findFirst({
      where: { id, serviceLine: { isActive: true, campus: { isActive: true } } },
      include: {
        serviceLine: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            campus: { select: { id: true, code: true, name: true } },
          },
        },
        serviceAssignments: {
          where: { status: ServiceAssignmentStatus.ASSIGNED },
          orderBy: { createdAt: 'asc' },
          include: assignmentInclude,
        },
      },
    });
    if (!departure) throw new NotFoundException('Scheduled departure not found');
    return this.mapStudentDeparture(departure);
  }

  async getDriverAssignmentsToday(userId: string): Promise<Array<ReturnType<OperationalService['mapDriverAssignment']>>> {
    const driver = await this.resolveActiveDriver(userId);
    const date = this.requiredCivilDate(guayaquilToday());
    const assignments = await this.prisma.serviceAssignment.findMany({
      where: {
        driverId: driver.id,
        status: ServiceAssignmentStatus.ASSIGNED,
        scheduledDeparture: { serviceDate: { gte: date, lt: nextCivilDate(date) } },
      },
      orderBy: { plannedStartAt: 'asc' },
      include: assignmentInclude,
    });
    return assignments.map((assignment) => this.mapDriverAssignment(assignment));
  }

  async getDriverAssignment(userId: string, assignmentId: string): Promise<ReturnType<OperationalService['mapDriverAssignment']>> {
    const driver = await this.resolveActiveDriver(userId);
    const assignment = await this.prisma.serviceAssignment.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundException('Service assignment not found');
    if (assignment.driverId !== driver.id) {
      throw new ForbiddenException('Service assignment does not belong to the authenticated driver');
    }
    return this.mapDriverAssignment(assignment);
  }

  async startDriverRun(userId: string, assignmentId: string): Promise<ReturnType<OperationalService['mapDriverAssignment']>> {
    const driver = await this.resolveActiveDriver(userId);
    const assignment = await this.prisma.serviceAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, driverId: true, vehicleId: true },
    });
    if (!assignment) throw new NotFoundException('Service assignment not found');
    if (assignment.driverId !== driver.id) {
      throw new ForbiddenException('Service assignment does not belong to the authenticated driver');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockOperationalResources(tx, [
        `assignment:${assignment.id}`,
        `driver:${assignment.driverId}`,
        `vehicle:${assignment.vehicleId}`,
      ]);
      const locked = await tx.serviceAssignment.findUnique({
        where: { id: assignment.id },
        include: assignmentInclude,
      });
      if (!locked) throw new NotFoundException('Service assignment not found');
      if (locked.status !== ServiceAssignmentStatus.ASSIGNED) {
        throw new ConflictException('Service assignment is not available to start');
      }
      if (locked.serviceRun) {
        if (locked.serviceRun.status === ServiceRunStatus.IN_PROGRESS) return locked;
        throw new ConflictException('ALREADY_COMPLETED: assignment already has a completed service run');
      }

      const currentRun = await tx.serviceRun.findFirst({
        where: {
          status: ServiceRunStatus.IN_PROGRESS,
          serviceAssignment: {
            OR: [{ driverId: locked.driverId }, { vehicleId: locked.vehicleId }],
          },
        },
        select: { id: true },
      });
      if (currentRun) {
        throw new ConflictException('Driver or vehicle already has a service run in progress');
      }

      return tx.serviceAssignment.update({
        where: { id: locked.id },
        data: { serviceRun: { create: { status: ServiceRunStatus.IN_PROGRESS, startedAt: new Date() } } },
        include: assignmentInclude,
      });
    });

    await this.auditLogsService.logAction(userId, 'SERVICE_RUN_START', 'ServiceRun', result.serviceRun?.id, {
      serviceAssignmentId: result.id,
      vehicleId: result.vehicleId,
      driverId: result.driverId,
    });
    return this.mapDriverAssignment(result);
  }

  async getCurrentDriverRun(userId: string): Promise<ReturnType<OperationalService['mapDriverAssignment']> | null> {
    const driver = await this.resolveActiveDriver(userId);
    const assignment = await this.prisma.serviceAssignment.findFirst({
      where: { driverId: driver.id, serviceRun: { is: { status: ServiceRunStatus.IN_PROGRESS } } },
      orderBy: { plannedStartAt: 'desc' },
      include: assignmentInclude,
    });
    return assignment ? this.mapDriverAssignment(assignment) : null;
  }

  async finishDriverRun(userId: string, runId: string): Promise<ReturnType<OperationalService['mapDriverAssignment']>> {
    const driver = await this.resolveActiveDriver(userId);
    const run = await this.prisma.serviceRun.findUnique({
      where: { id: runId },
      include: { serviceAssignment: { select: { id: true, driverId: true } } },
    });
    if (!run) throw new NotFoundException('Service run not found');
    if (run.serviceAssignment.driverId !== driver.id) {
      throw new ForbiddenException('Service run does not belong to the authenticated driver');
    }

    const completedAt = new Date();
    const updated = await this.prisma.serviceRun.updateMany({
      where: { id: run.id, status: ServiceRunStatus.IN_PROGRESS },
      data: { status: ServiceRunStatus.COMPLETED, completedAt },
    });
    const assignment = await this.prisma.serviceAssignment.findUnique({
      where: { id: run.serviceAssignmentId },
      include: assignmentInclude,
    });
    if (!assignment?.serviceRun) throw new NotFoundException('Service assignment for run not found');
    if (updated.count === 0 && assignment.serviceRun.status !== ServiceRunStatus.COMPLETED) {
      throw new ConflictException('Service run is not in progress');
    }

    if (updated.count === 1) {
      await this.auditLogsService.logAction(userId, 'SERVICE_RUN_FINISH', 'ServiceRun', run.id, {
        serviceAssignmentId: assignment.id,
      });
    }
    return this.mapDriverAssignment(assignment);
  }

  private async resolveActiveDriver(userId: string): Promise<{ id: string }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!driver) throw new NotFoundException('Driver profile not found for authenticated user');
    if (driver.status !== DriverStatus.ACTIVE) throw new ForbiddenException('Driver profile is inactive');
    return driver;
  }

  private requiredCivilDate(value: string): Date {
    const date = parseCivilDate(value);
    if (!date) throw new BadRequestException('date must use a real YYYY-MM-DD civil date');
    return date;
  }

  private async lockOperationalResources(tx: Prisma.TransactionClient, resources: string[]): Promise<void> {
    for (const resource of [...resources].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${resource}, 0))`;
    }
  }

  private mapAdminAssignment(assignment: AssignmentRecord) {
    return {
      id: assignment.id,
      status: assignment.status,
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      departure: {
        id: assignment.scheduledDeparture.id,
        serviceDate: civilDateToIso(assignment.scheduledDeparture.serviceDate),
        scheduledTime: formatTime(assignment.scheduledDeparture.scheduledTime),
        direction: assignment.scheduledDeparture.direction,
        serviceLine: assignment.scheduledDeparture.serviceLine,
      },
      vehicle: assignment.vehicle,
      driver: assignment.driver,
      journeyTemplate: {
        id: assignment.journeyTemplate.id,
        routePath: assignment.journeyTemplate.routePath,
      },
      operation: assignment.serviceRun
        ? {
            id: assignment.serviceRun.id,
            status: assignment.serviceRun.status,
            startedAt: assignment.serviceRun.startedAt,
            completedAt: assignment.serviceRun.completedAt,
          }
        : null,
    };
  }

  private mapStudentDeparture(departure: {
    id: string;
    serviceDate: Date;
    scheduledTime: Date;
    direction: 'IDA' | 'RETORNO';
    serviceLine: {
      id: string;
      code: string;
      name: string;
      description: string | null;
      campus: { id: string; code: string; name: string };
    };
    serviceAssignments: AssignmentRecord[];
  }) {
    const assignments = departure.serviceAssignments.map((assignment) => this.mapStudentAssignment(assignment));
    const states = assignments.map((assignment) => assignment.operationStatus);
    return {
      id: departure.id,
      serviceDate: civilDateToIso(departure.serviceDate),
      scheduledTime: formatTime(departure.scheduledTime),
      direction: departure.direction,
      state: states.includes('IN_PROGRESS')
        ? 'IN_PROGRESS'
        : states.includes('COMPLETED')
          ? 'COMPLETED'
          : states.includes('ASSIGNED')
            ? 'ASSIGNED'
            : 'SCHEDULED',
      serviceLine: departure.serviceLine,
      assignments,
    };
  }

  private mapStudentAssignment(assignment: AssignmentRecord) {
    return {
      id: assignment.id,
      operationStatus: operationalState(assignment),
      vehicle: { code: assignment.vehicle.code, plate: assignment.vehicle.plate, capacity: assignment.vehicle.capacity },
      driverName: assignment.driver.name,
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      journey: {
        routePathId: assignment.journeyTemplate.routePath.id,
        code: assignment.journeyTemplate.routePath.code,
        displayName: assignment.journeyTemplate.routePath.displayName,
        direction: assignment.journeyTemplate.routePath.direction,
        stops: assignment.journeyTemplate.routePath.stops.map((routePathStop) => ({
          order: routePathStop.stopOrder,
          id: routePathStop.stop.id,
          name: routePathStop.stop.name,
          reference: routePathStop.stop.reference,
        })),
      },
      run: assignment.serviceRun
        ? {
            status: assignment.serviceRun.status,
            startedAt: assignment.serviceRun.startedAt,
            completedAt: assignment.serviceRun.completedAt,
          }
        : null,
    };
  }

  private mapDriverAssignment(assignment: AssignmentRecord) {
    return {
      id: assignment.id,
      operationalStatus: operationalState(assignment),
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      departure: {
        id: assignment.scheduledDeparture.id,
        serviceDate: civilDateToIso(assignment.scheduledDeparture.serviceDate),
        scheduledTime: formatTime(assignment.scheduledDeparture.scheduledTime),
        direction: assignment.scheduledDeparture.direction,
        serviceLine: assignment.scheduledDeparture.serviceLine,
      },
      vehicle: assignment.vehicle,
      journey: {
        id: assignment.journeyTemplate.id,
        routePath: assignment.journeyTemplate.routePath,
      },
      run: assignment.serviceRun,
    };
  }
}
