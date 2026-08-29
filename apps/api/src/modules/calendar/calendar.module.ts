import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CalendarRepository } from './calendar.repository';
import { CalendarResolverService } from './calendar-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [CalendarRepository, CalendarResolverService],
  exports: [CalendarResolverService],
})
export class CalendarModule {}
