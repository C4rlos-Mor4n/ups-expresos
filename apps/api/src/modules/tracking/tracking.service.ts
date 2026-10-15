import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TrackingProvider } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppConfig } from '../../config/app.config';
import { NormalizedTrackingReport, trackingDedupKey } from './hunter/hunter-payload';
import { classifyFreshness, positionAgeSeconds, TrackingFreshness } from './tracking-freshness';

export interface IngestResult {
  accepted: number;
  duplicates: number;
}

export interface VehiclePosition {
  deviceId: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number | null;
  ignition: boolean | null;
  gpsQuality: number | null;
  occurredAt: Date;
  receivedAt: Date | null;
  ageSeconds: number;
  freshness: TrackingFreshness;
}

type DeviceWithLast = {
  id: string;
  lastOccurredAt: Date | null;
  lastReceivedAt: Date | null;
  lastLatitude: Prisma.Decimal | null;
  lastLongitude: Prisma.Decimal | null;
  lastSpeedKph: Prisma.Decimal | null;
  lastHeading: number | null;
  lastIgnition: boolean | null;
  lastGpsQuality: number | null;
};

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  get settings(): AppConfig['tracking'] {
    return this.config.get<AppConfig>('app', { infer: true })!.tracking;
  }

  /**
   * Registra reportes ya normalizados. Idempotente: un reenvío del proveedor (mismo dispositivo,
   * misma hora, mismo suceso) no crea otro punto. La "última posición" del dispositivo solo avanza
   * con reportes más nuevos que tengan GPS válido (los reportes atrasados quedan en el historial).
   */
  async ingest(
    reports: NormalizedTrackingReport[],
    provider: TrackingProvider = TrackingProvider.HUNTER,
  ): Promise<IngestResult> {
    let accepted = 0;
    let duplicates = 0;
    const receivedAt = new Date();

    for (const report of reports) {
      const device = await this.prisma.trackingDevice.upsert({
        where: { provider_externalId: { provider, externalId: report.externalId } },
        create: {
          provider,
          externalId: report.externalId,
          alias: report.alias,
          label: report.label,
        },
        update: {
          ...(report.alias ? { alias: report.alias } : {}),
          ...(report.label ? { label: report.label } : {}),
        },
        select: { id: true, vehicleId: true, isActive: true },
      });

      try {
        await this.prisma.trackingPoint.create({
          data: {
            deviceId: device.id,
            vehicleId: device.vehicleId,
            kind: report.kind,
            dedupKey: trackingDedupKey(report),
            occurredAt: report.occurredAt,
            receivedAt,
            latitude: report.latitude,
            longitude: report.longitude,
            speedKph: report.speedKph,
            heading: report.heading,
            altitudeMeters: report.altitudeMeters,
            satellites: report.satellites,
            gpsQuality: report.gpsQuality,
            ignition: report.ignition,
            eventCode: report.eventCode,
            occurrenceCode: report.occurrenceCode,
            description: report.description,
            raw: report.raw as Prisma.InputJsonValue,
          },
        });
        accepted += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          duplicates += 1;
          continue;
        }
        throw error;
      }

      if (!report.hasValidPosition) continue;
      // Avanza la última posición solo si este reporte es más reciente (los reintentos pueden llegar
      // fuera de orden).
      await this.prisma.trackingDevice.updateMany({
        where: {
          id: device.id,
          OR: [{ lastOccurredAt: null }, { lastOccurredAt: { lt: report.occurredAt } }],
        },
        data: {
          lastOccurredAt: report.occurredAt,
          lastReceivedAt: receivedAt,
          lastLatitude: report.latitude,
          lastLongitude: report.longitude,
          lastSpeedKph: report.speedKph,
          lastHeading: report.heading,
          lastIgnition: report.ignition,
          lastGpsQuality: report.gpsQuality,
          lastSatellites: report.satellites,
          lastAddress: report.address,
        },
      });
    }
    return { accepted, duplicates };
  }

  toPosition(device: DeviceWithLast, now = new Date()): VehiclePosition | null {
    if (!device.lastOccurredAt || device.lastLatitude === null || device.lastLongitude === null) {
      return null;
    }
    const ageSeconds = positionAgeSeconds(device.lastOccurredAt, device.lastReceivedAt, now);
    return {
      deviceId: device.id,
      latitude: Number(device.lastLatitude),
      longitude: Number(device.lastLongitude),
      speedKph: Number(device.lastSpeedKph ?? 0),
      heading: device.lastHeading,
      ignition: device.lastIgnition,
      gpsQuality: device.lastGpsQuality,
      occurredAt: device.lastOccurredAt,
      receivedAt: device.lastReceivedAt,
      ageSeconds,
      freshness: classifyFreshness(ageSeconds, this.settings),
    };
  }

  /** Última posición por vehículo (solo dispositivos activos vinculados). */
  async positionsForVehicles(vehicleIds: string[]): Promise<Map<string, VehiclePosition | null>> {
    const result = new Map<string, VehiclePosition | null>();
    if (vehicleIds.length === 0) return result;
    const devices = await this.prisma.trackingDevice.findMany({
      where: { vehicleId: { in: vehicleIds }, isActive: true },
    });
    const now = new Date();
    for (const vehicleId of vehicleIds) result.set(vehicleId, null);
    for (const device of devices) {
      if (device.vehicleId) result.set(device.vehicleId, this.toPosition(device, now));
    }
    return result;
  }

  /** Vehículos con dispositivo vinculado (para distinguir "sin GPS instalado" de "sin datos"). */
  async vehiclesWithDevice(vehicleIds: string[]): Promise<Set<string>> {
    const devices = await this.prisma.trackingDevice.findMany({
      where: { vehicleId: { in: vehicleIds }, isActive: true },
      select: { vehicleId: true },
    });
    return new Set(devices.map((d) => d.vehicleId!).filter(Boolean));
  }

  /** Borra historial más antiguo que TRACKING_HISTORY_DAYS. */
  async purgeHistory(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.settings.historyDays * 86_400_000);
    const { count } = await this.prisma.trackingPoint.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Purged ${count} tracking points older than ${cutoff.toISOString()}`);
    return count;
  }
}
