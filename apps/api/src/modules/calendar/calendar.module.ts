import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CalendarRepository } from './calendar.repository';
import { CalendarResolverService } from './calendar-resolver.service';
import { ScheduledDepartureMaterializerService } from './scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from './scheduled-departure.repository';
import { AdminScheduleController } from './admin-schedule.controller';
import { AdminScheduleService } from './admin-schedule.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  providers: [
    CalendarRepository,
    CalendarResolverService,
    ScheduledDepartureRepository,
    ScheduledDepartureMaterializerService,
    AdminScheduleService,
  ],
  controllers: [AdminScheduleController],
  exports: [CalendarResolverService, ScheduledDepartureMaterializerService],
})
export class CalendarModule {}
