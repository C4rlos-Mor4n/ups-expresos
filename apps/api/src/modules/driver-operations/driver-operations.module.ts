import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TripsModule } from '../trips/trips.module';
import { DriverOperationsService } from './driver-operations.service';
import { DriverOperationsController } from './driver-operations.controller';

@Module({
  imports: [AuditLogsModule, TripsModule],
  providers: [DriverOperationsService],
  controllers: [DriverOperationsController],
  exports: [DriverOperationsService],
})
export class DriverOperationsModule {}