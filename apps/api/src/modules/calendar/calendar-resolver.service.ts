import { Injectable } from '@nestjs/common';
import { CalendarRepository } from './calendar.repository';
import { resolverError } from './calendar.errors';
import { parseLocalDate, localDateToDatabaseDate, resolveCalendarAggregate } from './calendar-resolver.functions';
import {
  CalendarResolverError,
  ResolveScheduleInput,
  ResolvedSchedule,
  Result,
} from './calendar.types';

@Injectable()
export class CalendarResolverService {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  async resolveSchedule(
    input: ResolveScheduleInput,
  ): Promise<Result<ResolvedSchedule, CalendarResolverError>> {
    const localDateResult = parseLocalDate(input.serviceDate);
    if (!localDateResult.ok) return localDateResult;

    const serviceLine = await this.calendarRepository.findServiceLine(input.serviceLineId);
    if (!serviceLine) {
      return resolverError('SERVICE_LINE_NOT_FOUND', 'ServiceLine was not found', {
        serviceLineId: input.serviceLineId,
      });
    }
    if (!serviceLine.isActive) {
      return resolverError('SERVICE_LINE_INACTIVE', 'ServiceLine is inactive', {
        serviceLineId: input.serviceLineId,
      });
    }

    const databaseDate = localDateToDatabaseDate(localDateResult.value);
    const candidates = await this.calendarRepository.findPublishedCalendarCandidates(
      input.serviceLineId,
      databaseDate,
    );

    if (candidates.length === 0) {
      return resolverError('NO_PUBLISHED_CALENDAR', 'No published calendar matches the service date', {
        serviceLineId: input.serviceLineId,
        serviceDate: input.serviceDate,
      });
    }
    if (candidates.length > 1) {
      return resolverError('AMBIGUOUS_CALENDAR', 'More than one published calendar matches the service date', {
        serviceLineId: input.serviceLineId,
        serviceDate: input.serviceDate,
      });
    }

    const calendar = await this.calendarRepository.findCalendarAggregate(candidates[0]?.id ?? '');
    if (!calendar) {
      return resolverError('INVALID_CALENDAR_CONFIGURATION', 'Selected calendar could not be loaded', {
        serviceLineId: input.serviceLineId,
        serviceDate: input.serviceDate,
      });
    }

    return resolveCalendarAggregate(input, localDateResult.value, calendar);
  }
}
