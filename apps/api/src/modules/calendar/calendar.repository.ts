import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SchedulePublicationStatus,
  ServiceExceptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CalendarAggregate,
  CalendarExceptionRecord,
  CalendarJourneyTemplateRecord,
  CalendarPatternRecord,
  CalendarRoutePathRecord,
  CalendarRoutePathStopRecord,
  CalendarStopTimeRecord,
  CalendarTimeRecord,
} from './calendar.types';

const calendarAggregateSelect = {
  id: true,
  serviceLineId: true,
  validFrom: true,
  validUntil: true,
  timezone: true,
  status: true,
  patterns: {
    where: { status: SchedulePublicationStatus.PUBLISHED },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      serviceCalendarId: true,
      direction: true,
      type: true,
      status: true,
      exceptionId: true,
      days: { select: { weekday: true } },
      times: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          schedulePatternId: true,
          departureTime: true,
          approximateArrivalTime: true,
          journeyTemplates: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              scheduleTimeId: true,
              routePathId: true,
              routePath: {
                select: {
                  id: true,
                  serviceLineId: true,
                  direction: true,
                  stops: {
                    select: { id: true, routePathId: true, stopOrder: true },
                  },
                },
              },
              stopTimes: {
                select: {
                  id: true,
                  journeyTemplateId: true,
                  routePathStopId: true,
                  offsetMinutes: true,
                },
              },
            },
          },
        },
      },
    },
  },
  exceptions: {
    where: { status: ServiceExceptionStatus.PUBLISHED },
    select: {
      id: true,
      serviceCalendarId: true,
      serviceDate: true,
      direction: true,
      reason: true,
      effect: true,
      status: true,
    },
  },
} satisfies Prisma.ServiceCalendarSelect;

type CalendarAggregateRow = Prisma.ServiceCalendarGetPayload<{
  select: typeof calendarAggregateSelect;
}>;

const formatTime = (value: Date): string => {
  const parts = [value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds()];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
};

const mapStop = (stop: CalendarAggregateRow['patterns'][number]['times'][number]['journeyTemplates'][number]['routePath']['stops'][number]): CalendarRoutePathStopRecord => ({
  id: stop.id,
  routePathId: stop.routePathId,
  stopOrder: stop.stopOrder,
});

const mapStopTime = (stopTime: CalendarAggregateRow['patterns'][number]['times'][number]['journeyTemplates'][number]['stopTimes'][number]): CalendarStopTimeRecord => ({
  id: stopTime.id,
  journeyTemplateId: stopTime.journeyTemplateId,
  routePathStopId: stopTime.routePathStopId,
  offsetMinutes: stopTime.offsetMinutes,
});

const mapRoutePath = (routePath: CalendarAggregateRow['patterns'][number]['times'][number]['journeyTemplates'][number]['routePath']): CalendarRoutePathRecord => ({
  id: routePath.id,
  serviceLineId: routePath.serviceLineId,
  direction: routePath.direction,
  stops: routePath.stops.map(mapStop),
});

const mapJourneyTemplate = (template: CalendarAggregateRow['patterns'][number]['times'][number]['journeyTemplates'][number]): CalendarJourneyTemplateRecord => ({
  id: template.id,
  scheduleTimeId: template.scheduleTimeId,
  routePathId: template.routePathId,
  routePath: mapRoutePath(template.routePath),
  stopTimes: template.stopTimes.map(mapStopTime),
});

const mapTime = (time: CalendarAggregateRow['patterns'][number]['times'][number]): CalendarTimeRecord => ({
  id: time.id,
  patternId: time.schedulePatternId,
  departureTime: formatTime(time.departureTime),
  approximateArrivalTime: time.approximateArrivalTime ? formatTime(time.approximateArrivalTime) : null,
  journeyTemplates: time.journeyTemplates.map(mapJourneyTemplate),
});

const mapPattern = (pattern: CalendarAggregateRow['patterns'][number]): CalendarPatternRecord => ({
  id: pattern.id,
  serviceCalendarId: pattern.serviceCalendarId,
  direction: pattern.direction,
  type: pattern.type,
  status: pattern.status,
  exceptionId: pattern.exceptionId,
  days: pattern.days.map((day) => day.weekday),
  times: pattern.times.map(mapTime),
});

const mapException = (exception: CalendarAggregateRow['exceptions'][number]): CalendarExceptionRecord => ({
  id: exception.id,
  serviceCalendarId: exception.serviceCalendarId,
  serviceDate: exception.serviceDate,
  direction: exception.direction,
  reason: exception.reason,
  effect: exception.effect,
  status: exception.status,
});

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findServiceLine(id: string): Promise<{ id: string; isActive: boolean } | null> {
    return this.prisma.serviceLine.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
  }

  async findPublishedCalendarCandidates(
    serviceLineId: string,
    serviceDate: Date,
  ): Promise<Array<{ id: string }>> {
    return this.prisma.serviceCalendar.findMany({
      where: {
        serviceLineId,
        status: SchedulePublicationStatus.PUBLISHED,
        validFrom: { lte: serviceDate },
        validUntil: { gte: serviceDate },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
  }

  async findCalendarAggregate(id: string): Promise<CalendarAggregate | null> {
    const row = await this.prisma.serviceCalendar.findUnique({
      where: { id },
      select: calendarAggregateSelect,
    });

    if (!row) return null;

    return {
      id: row.id,
      serviceLineId: row.serviceLineId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      timezone: row.timezone,
      status: row.status,
      patterns: row.patterns.map(mapPattern),
      exceptions: row.exceptions.map(mapException),
    };
  }
}
