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
  TrackingPointKind,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { liveBusPhase } from './tracking-freshness';
import { TrackingService, VehiclePosition } from './tracking.service';
import type { LiveBusDto, LivePositionDto, LiveTrackingDto } from './dto/tracking.dto';

/** Intervalo de consulta sugerido a las apps (polling) mientras hay un bus en vivo. */
export const LIVE_REFRESH_SECONDS = 10;
const IDLE_REFRESH_SECONDS = 60;
/** Sucesos Hunter que la administración debe ver como alerta aunque lleguen como "evento". */
const CRITICAL_OCCURRENCES = [9, 10, 11, 21, 1000, 1001, 1002, 1003, 1004];

const liveAssignmentSelect = {
  id: true,
  plannedStartAt: true,
  plannedEndAt: true,
  vehicle: { select: { id: true, code: true, plate: true } },
  serviceRun: { select: { status: true, startedAt: true, startSource: true } },
} satisfies Prisma.ServiceAssignmentSelect;

type LiveAssignment = Prisma.ServiceAssignmentGetPayload<{ select: typeof liveAssignmentSelect }>;

function publicPosition(position: VehiclePosition): LivePositionDto {
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    speedKph: position.speedKph,
    heading: position.heading,
    occurredAt: position.occurredAt,
    ageSeconds: position.ageSeconds,
    freshness: position.freshness,
  };
}

@Injectable()
export class TrackingLiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private trackingFor(
    phase: LiveBusDto['phase'],
    hasDevice: boolean,
    position: VehiclePosition | null,
    showOutsideWindow: boolean,
  ): LiveTrackingDto {
    if (phase === 'NOT_LIVE' && !showOutsideWindow) return { status: 'NOT_LIVE', position: null };
    if (!hasDevice) return { status: 'NO_DEVICE', position: null };
    if (!position || position.freshness === 'OFFLINE') return { status: 'NO_SIGNAL', position: null };
    return { status: 'AVAILABLE', position: publicPosition(position) };
  }

  private async buildBuses(
    assignments: LiveAssignment[],
    showOutsideWindow: boolean,
  ): Promise<LiveBusDto[]> {
    const vehicleIds = [...new Set(assignments.map((a) => a.vehicle.id))];
    const [positions, withDevice] = await Promise.all([
      this.tracking.positionsForVehicles(vehicleIds),
      this.tracking.vehiclesWithDevice(vehicleIds),
    ]);
    const now = new Date();
    return assignments.map((assignment) => {
      const phase = liveBusPhase(
        {
          plannedStartAt: assignment.plannedStartAt,
          plannedEndAt: assignment.plannedEndAt,
          runStatus: assignment.serviceRun?.status ?? null,
        },
        now,
      );
      return {
        assignmentId: assignment.id,
        vehicle: assignment.vehicle,
        phase,
        plannedStartAt: assignment.plannedStartAt,
        plannedEndAt: assignment.plannedEndAt,
        startedAt: assignment.serviceRun?.startedAt ?? null,
        startSource: assignment.serviceRun?.startSource ?? null,
        tracking: this.trackingFor(
          phase,
          withDevice.has(assignment.vehicle.id),
          positions.get(assignment.vehicle.id) ?? null,
          showOutsideWindow,
        ),
      };
    });
  }

  private refreshFor(buses: LiveBusDto[]): number {
    return buses.some((bus) => bus.phase !== 'NOT_LIVE') ? LIVE_REFRESH_SECONDS : IDLE_REFRESH_SECONDS;
  }

  /** Estudiante: ubicación de los buses asignados a una salida (solo dentro de la ventana del servicio). */
  async departureLive(departureId: string) {
    const departure = await this.prisma.scheduledDeparture.findFirst({
      where: { id: departureId, serviceLine: { isActive: true, campus: { isActive: true } } },
      select: {
        id: true,
        serviceAssignments: {
          where: { status: ServiceAssignmentStatus.ASSIGNED },
          orderBy: { createdAt: 'asc' },
          select: liveAssignmentSelect,
        },
      },
    });
    if (!departure) throw new NotFoundException('Scheduled departure not found');
    const buses = await this.buildBuses(departure.serviceAssignments, false);
    return {
      departureId: departure.id,
      generatedAt: new Date(),
      refreshAfterSeconds: this.refreshFor(buses),
      buses,
    };
  }

  /** Conductor: estado del GPS de su bus (lo ve siempre, aunque el servicio aún no abra la ventana). */
  async driverAssignmentLive(userId: string, assignmentId: string): Promise<LiveBusDto> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!driver) throw new NotFoundException('Driver profile not found for authenticated user');
    if (driver.status !== DriverStatus.ACTIVE) throw new ForbiddenException('Driver profile is inactive');
    const assignment = await this.prisma.serviceAssignment.findUnique({
      where: { id: assignmentId },
      select: { ...liveAssignmentSelect, driverId: true },
    });
    if (!assignment) throw new NotFoundException('Service assignment not found');
    if (assignment.driverId !== driver.id) {
      throw new ForbiddenException('Service assignment does not belong to the authenticated driver');
    }
    const [bus] = await this.buildBuses([assignment], true);
    return bus!;
  }

  // ── Administración ──────────────────────────────────────────────────────────

  async listDevices() {
    const devices = await this.prisma.trackingDevice.findMany({
      orderBy: [{ vehicleId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      include: { vehicle: { select: { id: true, code: true, plate: true } } },
    });
    const now = new Date();
    return devices.map((device) => {
      const position = this.tracking.toPosition(device, now);
      return {
        id: device.id,
        provider: device.provider,
        externalId: device.externalId,
        alias: device.alias,
        label: device.label,
        isActive: device.isActive,
        vehicle: device.vehicle,
        position: position ? publicPosition(position) : null,
        ignition: device.lastIgnition,
        address: device.lastAddress,
        createdAt: device.createdAt,
      };
    });
  }

  async bindDevice(actorId: string, deviceId: string, vehicleId: string | null) {
    const device = await this.prisma.trackingDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Tracking device not found');
    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      const other = await this.prisma.trackingDevice.findUnique({ where: { vehicleId }, select: { id: true } });
      if (other && other.id !== deviceId) {
        throw new ConflictException('VEHICLE_ALREADY_TRACKED: the vehicle already has another device');
      }
    }
    await this.prisma.trackingDevice.update({ where: { id: deviceId }, data: { vehicleId } });
    await this.auditLogs.logAction(actorId, vehicleId ? 'TRACKING_DEVICE_BIND' : 'TRACKING_DEVICE_UNBIND', 'TrackingDevice', deviceId, {
      externalId: device.externalId,
      previousVehicleId: device.vehicleId,
      vehicleId,
    });
    return (await this.listDevices()).find((d) => d.id === deviceId)!;
  }

  async setDeviceActive(actorId: string, deviceId: string, isActive: boolean) {
    const device = await this.prisma.trackingDevice.findUnique({ where: { id: deviceId }, select: { id: true } });
    if (!device) throw new NotFoundException('Tracking device not found');
    await this.prisma.trackingDevice.update({ where: { id: deviceId }, data: { isActive } });
    await this.auditLogs.logAction(actorId, 'TRACKING_DEVICE_UPDATE', 'TrackingDevice', deviceId, { isActive });
    return (await this.listDevices()).find((d) => d.id === deviceId)!;
  }

  /** Flota en vivo: vehículos con GPS vinculado, su última posición y el recorrido en curso. */
  async fleet() {
    const devices = await this.prisma.trackingDevice.findMany({
      where: { vehicleId: { not: null }, isActive: true },
      include: { vehicle: { select: { id: true, code: true, plate: true } } },
      orderBy: { vehicle: { code: 'asc' } },
    });
    const vehicleIds = devices.map((d) => d.vehicleId!);
    const runs = await this.prisma.serviceAssignment.findMany({
      where: { vehicleId: { in: vehicleIds }, serviceRun: { is: { status: ServiceRunStatus.IN_PROGRESS } } },
      select: {
        id: true,
        vehicleId: true,
        driver: { select: { name: true } },
        serviceRun: { select: { id: true, startSource: true } },
        scheduledDeparture: {
          select: { scheduledTime: true, direction: true, serviceLine: { select: { name: true } } },
        },
      },
    });
    const runByVehicle = new Map(runs.map((r) => [r.vehicleId, r]));
    const now = new Date();
    return devices.map((device) => {
      const position = this.tracking.toPosition(device, now);
      const run = runByVehicle.get(device.vehicleId!);
      return {
        vehicle: device.vehicle!,
        deviceId: device.id,
        position: position ? publicPosition(position) : null,
        ignition: device.lastIgnition,
        currentRun: run
          ? {
              assignmentId: run.id,
              runId: run.serviceRun!.id,
              serviceLineName: run.scheduledDeparture.serviceLine.name,
              scheduledTime: run.scheduledDeparture.scheduledTime.toISOString().slice(11, 16),
              direction: run.scheduledDeparture.direction,
              driverName: run.driver.name,
              startSource: run.serviceRun!.startSource,
            }
          : null,
      };
    });
  }

  /** Alertas Hunter + eventos críticos (pánico, exceso de velocidad, jamming, impactos…). */
  async alerts(hours = 24) {
    const since = new Date(Date.now() - hours * 3_600_000);
    const points = await this.prisma.trackingPoint.findMany({
      where: {
        occurredAt: { gte: since },
        OR: [{ kind: TrackingPointKind.ALERT }, { occurrenceCode: { in: CRITICAL_OCCURRENCES } }],
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: {
        vehicle: { select: { id: true, code: true, plate: true } },
        device: { select: { alias: true } },
      },
    });
    return points.map((p) => ({
      id: p.id,
      kind: p.kind,
      occurredAt: p.occurredAt,
      description: p.description,
      occurrenceCode: p.occurrenceCode,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      speedKph: Number(p.speedKph),
      vehicle: p.vehicle,
      deviceAlias: p.device.alias,
    }));
  }

  /** Recorrido histórico de un vehículo (máx. 24 h y 5000 puntos). */
  async trail(vehicleId: string, fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!(from < to) || to.getTime() - from.getTime() > 86_400_000) {
      throw new BadRequestException('from must be before to and the range at most 24 hours');
    }
    const points = await this.prisma.trackingPoint.findMany({
      where: {
        vehicleId,
        occurredAt: { gte: from, lte: to },
        OR: [{ gpsQuality: null }, { gpsQuality: { not: 9 } }],
      },
      orderBy: { occurredAt: 'asc' },
      take: 5000,
      select: { occurredAt: true, latitude: true, longitude: true, speedKph: true, heading: true },
    });
    return points.map((p) => ({
      occurredAt: p.occurredAt,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      speedKph: Number(p.speedKph),
      heading: p.heading,
    }));
  }
}
