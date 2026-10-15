import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OperationalModule } from '../operational/operational.module';
import { HunterWebhookController } from './hunter/hunter-webhook.controller';
import { OperationsAutoRunService } from './operations-auto-run.service';
import { AdminTrackingController, DriverTrackingController, StudentTrackingController } from './tracking.controllers';
import { TrackingLiveService } from './tracking-live.service';
import { TrackingService } from './tracking.service';

/**
 * Tracking en tiempo real (Hunter DataForward): ingesta por webhook, última posición por vehículo,
 * consultas en vivo para estudiante/conductor/administración y operación automática de recorridos.
 */
@Module({
  imports: [AuditLogsModule, OperationalModule],
  providers: [TrackingService, TrackingLiveService, OperationsAutoRunService],
  controllers: [
    HunterWebhookController,
    StudentTrackingController,
    DriverTrackingController,
    AdminTrackingController,
  ],
  exports: [TrackingService],
})
export class TrackingModule {}
