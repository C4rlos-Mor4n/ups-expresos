import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Endpoints transversales del panel administrativo: resumen, usuarios y auditoría. */
@Module({
  imports: [AuditLogsModule, TrackingModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
