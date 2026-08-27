import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RouteAssignmentsService } from './route-assignments.service';
import { RouteAssignmentsController } from './route-assignments.controller';

@Module({
  imports: [AuditLogsModule],
  providers: [RouteAssignmentsService],
  controllers: [RouteAssignmentsController],
  exports: [RouteAssignmentsService],
})
export class RouteAssignmentsModule {}