import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminOperationalController } from './admin-operational.controller';
import { DriverOperationalController } from './driver-operational.controller';
import { OperationalService } from './operational.service';
import { StudentOperationalController } from './student-operational.controller';

@Module({
  imports: [AuditLogsModule],
  providers: [OperationalService],
  controllers: [
    StudentOperationalController,
    DriverOperationalController,
    AdminOperationalController,
  ],
})
export class OperationalModule {}
