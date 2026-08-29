import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CalendarRepository } from './calendar.repository';
import { CalendarResolverService } from './calendar-resolver.service';
import { ScheduledDepartureMaterializerService } from './scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from './scheduled-departure.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    CalendarRepository,
    CalendarResolverService,
    ScheduledDepartureRepository,
    ScheduledDepartureMaterializerService,
  ],
  exports: [CalendarResolverService],
})
export class CalendarModule {}
