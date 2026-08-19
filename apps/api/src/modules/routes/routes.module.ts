import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { RouteStopsService } from './route-stops.service';
import { RouteStopsController } from './route-stops.controller';

@Module({
  imports: [AuditLogsModule],
  providers: [RoutesService, RouteStopsService],
  controllers: [RoutesController, RouteStopsController],
  exports: [RoutesService],
})
export class RoutesModule {}
