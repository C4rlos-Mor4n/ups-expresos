import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceAssignmentStatus, ServiceRunStatus } from '@prisma/client';
import { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../database/prisma.service';
import { OperationalService } from '../operational/operational.service';
import { TrackingService, VehiclePosition } from './tracking.service';

export type AutoRunMode = AppConfig['operations']['autoRun'];

/** Velocidad mínima (km/h) para considerar que el bus "se movió" cuando no hay dato de ignición. */
const MOVING_SPEED_KPH = 5;

/**
 * Regla de inicio automático:
 * - `schedule`: a la hora planificada, siempre (el conductor puede iniciarlo antes desde la app).
 * - `schedule_with_gps`: a la hora planificada solo si el GPS del bus está EN VIVO y con ignición
 *   encendida (o en movimiento). Nunca se infiere un recorrido solo por GPS fuera de su ventana.
 */
export function shouldAutoStart(mode: AutoRunMode, position: VehiclePosition | null): boolean {
  if (mode === 'off') return false;
  if (mode === 'schedule') return true;
  if (!position || position.freshness !== 'LIVE') return false;
  return position.ignition === true || position.speedKph >= MOVING_SPEED_KPH;
}

@Injectable()
export class OperationsAutoRunService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationsAutoRunService.name);
  private timer?: NodeJS.Timeout;
  private purgeTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig>,
    private readonly operational: OperationalService,
    private readonly tracking: TrackingService,
  ) {}

  private get settings() {
    return this.config.get<AppConfig>('app', { infer: true })!;
  }

  onModuleInit(): void {
    if (this.settings.nodeEnv === 'test') return;
    const mode = this.settings.operations.autoRun;
    if (mode !== 'off') {
      this.logger.log(`Automatic runs enabled (mode=${mode})`);
      this.timer = setInterval(() => void this.safeTick(), 60_000);
    }
    this.purgeTimer = setInterval(() => void this.tracking.purgeHistory().catch(() => undefined), 3_600_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  private async safeTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.tick();
    } catch (error) {
      this.logger.error('Automatic run tick failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Un ciclo: inicia los recorridos que tocan y cierra los que quedaron abiertos. */
  async tick(now = new Date()): Promise<{ started: number; finished: number }> {
    const { autoRun, autoStartGraceMinutes, autoFinishAfterMinutes } = this.settings.operations;
    if (autoRun === 'off') return { started: 0, finished: 0 };

    const due = await this.prisma.serviceAssignment.findMany({
      where: {
        status: ServiceAssignmentStatus.ASSIGNED,
        serviceRun: { is: null },
        plannedStartAt: { lte: now, gte: new Date(now.getTime() - autoStartGraceMinutes * 60_000) },
      },
      select: { id: true, vehicleId: true },
      orderBy: { plannedStartAt: 'asc' },
    });
    const positions =
      autoRun === 'schedule_with_gps'
        ? await this.tracking.positionsForVehicles([...new Set(due.map((a) => a.vehicleId))])
        : new Map<string, VehiclePosition | null>();

    let started = 0;
    for (const assignment of due) {
      if (!shouldAutoStart(autoRun, positions.get(assignment.vehicleId) ?? null)) continue;
      if (await this.operational.startRunAutomatically(assignment.id)) started += 1;
    }

    const overdue = await this.prisma.serviceRun.findMany({
      where: {
        status: ServiceRunStatus.IN_PROGRESS,
        serviceAssignment: { plannedEndAt: { lte: new Date(now.getTime() - autoFinishAfterMinutes * 60_000) } },
      },
      select: { id: true },
    });
    let finished = 0;
    for (const run of overdue) {
      if (await this.operational.finishRunAutomatically(run.id)) finished += 1;
    }

    if (started || finished) this.logger.log(`Automatic runs: started=${started} finished=${finished}`);
    return { started, finished };
  }
}
