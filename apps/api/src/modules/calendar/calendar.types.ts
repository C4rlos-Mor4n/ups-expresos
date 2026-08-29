import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  ServiceExceptionEffect,
  ServiceExceptionReason,
  ServiceExceptionStatus,
  Weekday,
} from '@prisma/client';

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type ResolveScheduleInput = {
  serviceLineId: string;
  direction: Direction;
  serviceDate: string;
};

export type LocalDate = {
  iso: string;
  weekday: Weekday;
};

export type CalendarResolverErrorCode =
  | 'INVALID_DATE'
  | 'SERVICE_LINE_NOT_FOUND'
  | 'SERVICE_LINE_INACTIVE'
  | 'NO_PUBLISHED_CALENDAR'
  | 'AMBIGUOUS_CALENDAR'
  | 'INVALID_CALENDAR_CONFIGURATION'
  | 'AMBIGUOUS_PATTERN'
  | 'INVALID_EXCEPTION_CONFIGURATION'
  | 'INVALID_TIMETABLE_RELATION'
  | 'INVALID_STOP_TIMETABLE';

export type CalendarResolverError = {
  code: CalendarResolverErrorCode;
  message: string;
  details?: Record<string, string>;
};

export type CalendarResolverWarningCode =
  | 'PARTIAL_TIMETABLE'
  | 'INVALID_TIMETABLE_RELATION'
  | 'INVALID_STOP_TIMETABLE';

export type CalendarResolverWarning = {
  code: CalendarResolverWarningCode;
  message: string;
  details: Record<string, string>;
};

export type CalendarExceptionRecord = {
  id: string;
  serviceCalendarId: string;
  serviceDate: Date;
  direction: Direction | null;
  reason: ServiceExceptionReason;
  effect: ServiceExceptionEffect;
  status: ServiceExceptionStatus;
};

export type CalendarPatternRecord = {
  id: string;
  serviceCalendarId: string;
  direction: Direction;
  type: SchedulePatternType;
  status: SchedulePublicationStatus;
  exceptionId: string | null;
  days: Weekday[];
  times: CalendarTimeRecord[];
};

export type CalendarTimeRecord = {
  id: string;
  patternId: string;
  departureTime: string;
  approximateArrivalTime: string | null;
  journeyTemplates: CalendarJourneyTemplateRecord[];
};

export type CalendarJourneyTemplateRecord = {
  id: string;
  scheduleTimeId: string;
  routePathId: string;
  routePath: CalendarRoutePathRecord;
  stopTimes: CalendarStopTimeRecord[];
};

export type CalendarRoutePathRecord = {
  id: string;
  serviceLineId: string;
  direction: Direction;
  stops: CalendarRoutePathStopRecord[];
};

export type CalendarRoutePathStopRecord = {
  id: string;
  routePathId: string;
  stopOrder: number;
};

export type CalendarStopTimeRecord = {
  id: string;
  journeyTemplateId: string;
  routePathStopId: string;
  offsetMinutes: number;
};

export type CalendarAggregate = {
  id: string;
  serviceLineId: string;
  validFrom: Date;
  validUntil: Date;
  timezone: string;
  status: SchedulePublicationStatus;
  patterns: CalendarPatternRecord[];
  exceptions: CalendarExceptionRecord[];
};

export type ResolvedException = {
  id: string;
  reason: ServiceExceptionReason;
  effect: ServiceExceptionEffect;
};

export type ResolvedStopTime = {
  routePathStopId: string;
  stopOrder: number;
  offsetMinutes: number;
  plannedTime: string;
  dayOffset: number;
};

export type ResolvedJourney = {
  journeyTemplateId: string;
  routePathId: string;
  direction: Direction;
  scheduledStopTimes: ResolvedStopTime[];
};

export type ResolvedDeparture = {
  patternId: string;
  scheduleTimeId: string;
  departureTime: string;
  approximateArrivalTime: string | null;
  source: 'REGULAR' | 'EXCEPTION_REPLACE' | 'EXCEPTION_ADD';
  sourceExceptionId?: string;
  journeys: ResolvedJourney[];
};

export type ResolvedSchedule = {
  serviceLineId: string;
  serviceCalendarId: string;
  direction: Direction;
  serviceDate: string;
  timezone: string;
  serviceAvailable: boolean;
  resolution: 'REGULAR' | 'REPLACE_TIMES' | 'ADD_TIMES' | 'NO_SERVICE';
  timetableCompleteness: 'COMPLETE' | 'PARTIAL';
  exception?: ResolvedException;
  departures: ResolvedDeparture[];
  warnings: CalendarResolverWarning[];
};
