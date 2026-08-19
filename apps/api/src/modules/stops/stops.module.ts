import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { StopsService } from './stops.service';
import { StopsController } from './stops.controller';

@Module({
  imports: [AuditLogsModule],
  providers: [StopsService],
  controllers: [StopsController],
  exports: [StopsService],
})
export class StopsModule {}
