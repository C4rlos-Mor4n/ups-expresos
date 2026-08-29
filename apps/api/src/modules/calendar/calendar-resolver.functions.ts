import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  ServiceExceptionEffect,
  ServiceExceptionStatus,
  Weekday,
} from '@prisma/client';
import { resolverError, resolverOk, resolverWarning } from './calendar.errors';
import {
  CalendarAggregate,
  CalendarExceptionRecord,
  CalendarJourneyTemplateRecord,
  CalendarPatternRecord,
  CalendarResolverError,
  CalendarResolverWarning,
  CalendarTimeRecord,
  LocalDate,
  ResolvedDeparture,
  ResolvedException,
  ResolvedJourney,
  ResolvedSchedule,
  ResolvedStopTime,
  ResolveScheduleInput,
  Result,
} from './calendar.types';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const SUPPORTED_TIMEZONE = 'America/Guayaquil';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const positiveModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;

const weekdayFromIsoDate = (year: number, month: number, day: number): Weekday => {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const sundayFirst = positiveModulo(
    adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      (offsets[month - 1] ?? 0) +
      day,
    7,
  );

  const weekdays: Weekday[] = [
    Weekday.SUNDAY,
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
    Weekday.SATURDAY,
  ];

  return weekdays[sundayFirst] ?? Weekday.SUNDAY;
};

export const parseLocalDate = (value: string): Result<LocalDate, CalendarResolverError> => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return resolverError('INVALID_DATE', 'serviceDate must use YYYY-MM-DD format', {
      serviceDate: value,
    });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxDay = (DAYS_IN_MONTH[month - 1] ?? 0) + (month === 2 && isLeapYear(year) ? 1 : 0);

  if (month < 1 || month > 12 || day < 1 || day > maxDay) {
    return resolverError('INVALID_DATE', 'serviceDate is not a valid calendar date', {
      serviceDate: value,
    });
  }

  return resolverOk({
    iso: value,
    weekday: weekdayFromIsoDate(year, month, day),
  });
};

export const localDateToDatabaseDate = (localDate: LocalDate): Date =>
  new Date(`${localDate.iso}T00:00:00.000Z`);

const dateToIso = (value: Date): string => value.toISOString().slice(0, 10);

const isTime = (value: string): boolean => TIME_PATTERN.test(value);

const timeToSeconds = (value: string): number | null => {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isTime(value)) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

const secondsToTime = (totalSeconds: number): { time: string; dayOffset: number } => {
  const daySeconds = 24 * 60 * 60;
  const dayOffset = Math.floor(totalSeconds / daySeconds);
  const secondsInDay = positiveModulo(totalSeconds, daySeconds);
  const hours = Math.floor(secondsInDay / 3600);
  const minutes = Math.floor((secondsInDay % 3600) / 60);
  const seconds = secondsInDay % 60;

  return {
    time: [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':'),
    dayOffset,
  };
};

const sourceRank = (source: ResolvedDeparture['source']): number =>
  source === 'REGULAR' ? 0 : source === 'EXCEPTION_ADD' ? 1 : 2;

const sortJourneys = (journeys: ResolvedJourney[]): ResolvedJourney[] =>
  [...journeys].sort((left, right) =>
    left.journeyTemplateId.localeCompare(right.journeyTemplateId),
  );

const sortDepartures = (departures: ResolvedDeparture[]): ResolvedDeparture[] =>
  [...departures].sort((left, right) => {
    const timeOrder = left.departureTime.localeCompare(right.departureTime);
    if (timeOrder !== 0) return timeOrder;

    const idOrder = left.scheduleTimeId.localeCompare(right.scheduleTimeId);
    if (idOrder !== 0) return idOrder;

    return sourceRank(left.source) - sourceRank(right.source);
  });

const exceptionToResolved = (exception: CalendarExceptionRecord): ResolvedException => ({
  id: exception.id,
  reason: exception.reason,
  effect: exception.effect,
});

const selectEffectiveException = (
  calendar: CalendarAggregate,
  input: ResolveScheduleInput,
  localDate: LocalDate,
): Result<CalendarExceptionRecord | null, CalendarResolverError> => {
  const candidates = calendar.exceptions.filter(
    (exception) =>
      exception.serviceCalendarId === calendar.id &&
      dateToIso(exception.serviceDate) === localDate.iso &&
      exception.status === ServiceExceptionStatus.PUBLISHED,
  );

  const specific = candidates.filter((exception) => exception.direction === input.direction);
  if (specific.length > 1) {
    return resolverError(
      'INVALID_EXCEPTION_CONFIGURATION',
      'Multiple published directional exceptions match the resolution',
      { serviceCalendarId: calendar.id, serviceDate: localDate.iso, direction: input.direction },
    );
  }

  const global = candidates.filter((exception) => exception.direction === null);
  if (global.length > 1) {
    return resolverError(
      'INVALID_EXCEPTION_CONFIGURATION',
      'Multiple published global exceptions match the resolution',
      { serviceCalendarId: calendar.id, serviceDate: localDate.iso },
    );
  }

  return resolverOk(specific[0] ?? global[0] ?? null);
};

const selectRegularPattern = (
  calendar: CalendarAggregate,
  input: ResolveScheduleInput,
  localDate: LocalDate,
): Result<CalendarPatternRecord | null, CalendarResolverError> => {
  const candidates = calendar.patterns.filter(
    (pattern) =>
      pattern.serviceCalendarId === calendar.id &&
      pattern.direction === input.direction &&
      pattern.status === SchedulePublicationStatus.PUBLISHED &&
      pattern.type === SchedulePatternType.EXPLICIT_TIMES &&
      pattern.exceptionId === null &&
      pattern.days.includes(localDate.weekday),
  );

  if (candidates.length > 1) {
    return resolverError('AMBIGUOUS_PATTERN', 'Multiple published regular patterns match the day', {
      serviceCalendarId: calendar.id,
      direction: input.direction,
      weekday: localDate.weekday,
    });
  }

  const pattern = candidates[0] ?? null;
  if (pattern && pattern.times.length === 0) {
    return resolverError('INVALID_CALENDAR_CONFIGURATION', 'Regular pattern has no schedule times', {
      patternId: pattern.id,
    });
  }

  return resolverOk(pattern);
};

const selectExceptionPattern = (
  calendar: CalendarAggregate,
  exception: CalendarExceptionRecord,
  direction: Direction,
): Result<CalendarPatternRecord, CalendarResolverError> => {
  const candidates = calendar.patterns.filter(
    (pattern) =>
      pattern.exceptionId === exception.id &&
      pattern.serviceCalendarId === calendar.id &&
      pattern.direction === direction &&
      pattern.status === SchedulePublicationStatus.PUBLISHED &&
      pattern.type === SchedulePatternType.EXPLICIT_TIMES,
  );

  if (candidates.length > 1) {
    return resolverError(
      'AMBIGUOUS_PATTERN',
      'Multiple published exception patterns match the direction',
      { exceptionId: exception.id, serviceCalendarId: calendar.id, direction },
    );
  }

  const pattern = candidates[0];
  if (!pattern) {
    return resolverError(
      'INVALID_EXCEPTION_CONFIGURATION',
      'Exception with times must have one published pattern for the direction',
      { exceptionId: exception.id, direction },
    );
  }

  if (pattern.days.length > 0) {
    return resolverError(
      'INVALID_EXCEPTION_CONFIGURATION',
      'Exception patterns must not depend on SchedulePatternDay',
      { patternId: pattern.id, exceptionId: exception.id },
    );
  }

  if (pattern.times.length === 0) {
    return resolverError('INVALID_EXCEPTION_CONFIGURATION', 'Exception pattern has no schedule times', {
      patternId: pattern.id,
      exceptionId: exception.id,
    });
  }

  return resolverOk(pattern);
};

const invalidJourneyWarning = (
  code: 'INVALID_TIMETABLE_RELATION' | 'INVALID_STOP_TIMETABLE',
  message: string,
  template: CalendarJourneyTemplateRecord,
): CalendarResolverWarning =>
  resolverWarning(code, message, {
    journeyTemplateId: template.id,
    routePathId: template.routePathId,
  });

const resolveJourney = (
  template: CalendarJourneyTemplateRecord,
  serviceLineId: string,
  direction: Direction,
  departureTime: string,
): Result<ResolvedJourney, CalendarResolverError> => {
  const routePath = template.routePath;
  if (
    routePath.id !== template.routePathId ||
    routePath.serviceLineId !== serviceLineId ||
    routePath.direction !== direction
  ) {
    return resolverError(
      'INVALID_TIMETABLE_RELATION',
      'Journey template route path does not match the resolved service',
      { journeyTemplateId: template.id, routePathId: template.routePathId },
    );
  }

  const orderedStops = [...routePath.stops].sort((left, right) => left.stopOrder - right.stopOrder);
  if (orderedStops.length === 0 || template.stopTimes.length !== orderedStops.length) {
    return resolverError('INVALID_STOP_TIMETABLE', 'Journey template does not cover the full route path', {
      journeyTemplateId: template.id,
      routePathId: template.routePathId,
    });
  }
  if (
    orderedStops.some((stop, index) => stop.routePathId !== routePath.id || orderedStops[index - 1]?.stopOrder === stop.stopOrder)
  ) {
    return resolverError('INVALID_TIMETABLE_RELATION', 'Route path stops do not belong to a unique route path sequence', {
      journeyTemplateId: template.id,
      routePathId: template.routePathId,
    });
  }

  const stopTimesByStop = new Map<string, typeof template.stopTimes[number]>();
  for (const stopTime of template.stopTimes) {
    if (
      stopTime.journeyTemplateId !== template.id ||
      stopTimesByStop.has(stopTime.routePathStopId)
    ) {
      return resolverError('INVALID_STOP_TIMETABLE', 'Journey template has duplicate or foreign stop times', {
        journeyTemplateId: template.id,
      });
    }
    stopTimesByStop.set(stopTime.routePathStopId, stopTime);
  }

  const orderedStopTimes = orderedStops.map((stop) => stopTimesByStop.get(stop.id));
  if (orderedStopTimes.some((stopTime) => !stopTime)) {
    return resolverError('INVALID_STOP_TIMETABLE', 'Journey template is missing a route path stop time', {
      journeyTemplateId: template.id,
    });
  }

  const firstStopTime = orderedStopTimes[0];
  if (!firstStopTime || firstStopTime.offsetMinutes !== 0) {
    return resolverError('INVALID_STOP_TIMETABLE', 'The first route path stop must have offset zero', {
      journeyTemplateId: template.id,
    });
  }

  const departureSeconds = timeToSeconds(departureTime);
  if (departureSeconds === null) {
    return resolverError('INVALID_CALENDAR_CONFIGURATION', 'ScheduleTime has an invalid departure time', {
      journeyTime: departureTime,
    });
  }

  const resolvedStopTimes: ResolvedStopTime[] = [];
  let previousOffset = -1;
  for (let index = 0; index < orderedStops.length; index += 1) {
    const stop = orderedStops[index];
    const stopTime = orderedStopTimes[index];
    if (!stop || !stopTime) {
      return resolverError('INVALID_STOP_TIMETABLE', 'Journey template stop data is incomplete', {
        journeyTemplateId: template.id,
      });
    }
    if (!Number.isInteger(stopTime.offsetMinutes) || stopTime.offsetMinutes < 0) {
      return resolverError('INVALID_STOP_TIMETABLE', 'Stop offsets must be non-negative integers', {
        journeyTemplateId: template.id,
      });
    }
    if (stopTime.offsetMinutes < previousOffset) {
      return resolverError('INVALID_STOP_TIMETABLE', 'Stop offsets must not decrease by stop order', {
        journeyTemplateId: template.id,
      });
    }

    const calculated = secondsToTime(departureSeconds + stopTime.offsetMinutes * 60);
    resolvedStopTimes.push({
      routePathStopId: stop.id,
      stopOrder: stop.stopOrder,
      offsetMinutes: stopTime.offsetMinutes,
      plannedTime: calculated.time,
      dayOffset: calculated.dayOffset,
    });
    previousOffset = stopTime.offsetMinutes;
  }

  return resolverOk({
    journeyTemplateId: template.id,
    routePathId: template.routePathId,
    direction,
    scheduledStopTimes: resolvedStopTimes,
  });
};

type SourceTime = {
  pattern: CalendarPatternRecord;
  time: CalendarTimeRecord;
  source: ResolvedDeparture['source'];
  sourceExceptionId?: string;
};

type ResolvedTimeBatch = {
  departures: ResolvedDeparture[];
  warnings: CalendarResolverWarning[];
  partial: boolean;
};

const resolveScheduleTime = (
  sourceTime: SourceTime,
  serviceLineId: string,
  direction: Direction,
): Result<
  { departure: ResolvedDeparture; warnings: CalendarResolverWarning[]; partial: boolean },
  CalendarResolverError
> => {
  if (!isTime(sourceTime.time.departureTime)) {
    return resolverError('INVALID_CALENDAR_CONFIGURATION', 'ScheduleTime departureTime is invalid', {
      scheduleTimeId: sourceTime.time.id,
    });
  }

  const warnings: CalendarResolverWarning[] = [];
  const journeys: ResolvedJourney[] = [];
  let partial = false;
  let firstJourneyError: CalendarResolverError | null = null;

  if (sourceTime.time.journeyTemplates.length === 0) {
    partial = true;
    warnings.push(
      resolverWarning('PARTIAL_TIMETABLE', 'ScheduleTime has no journey templates', {
        scheduleTimeId: sourceTime.time.id,
      }),
    );
  }

  const orderedJourneyTemplates = [...sourceTime.time.journeyTemplates].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const template of orderedJourneyTemplates) {
    const result = resolveJourney(
      template,
      serviceLineId,
      direction,
      sourceTime.time.departureTime,
    );
    if (!result.ok) {
      firstJourneyError ??= result.error;
      partial = true;
      warnings.push(
        invalidJourneyWarning(
          result.error.code === 'INVALID_STOP_TIMETABLE'
            ? 'INVALID_STOP_TIMETABLE'
            : 'INVALID_TIMETABLE_RELATION',
          result.error.message,
          template,
        ),
      );
      continue;
    }
    journeys.push(result.value);
  }

  if (sourceTime.time.journeyTemplates.length > 0 && journeys.length === 0) {
    return firstJourneyError
      ? { ok: false, error: firstJourneyError }
      : resolverError(
          'INVALID_TIMETABLE_RELATION',
          'All journey templates for a schedule time are invalid',
          { scheduleTimeId: sourceTime.time.id },
        );
  }

  const departure: ResolvedDeparture = {
    patternId: sourceTime.pattern.id,
    scheduleTimeId: sourceTime.time.id,
    departureTime: sourceTime.time.departureTime,
    approximateArrivalTime: sourceTime.time.approximateArrivalTime,
    source: sourceTime.source,
    ...(sourceTime.sourceExceptionId ? { sourceExceptionId: sourceTime.sourceExceptionId } : {}),
    journeys: sortJourneys(journeys),
  };

  return resolverOk({ departure, warnings, partial });
};

const resolveSourceTimes = (
  sourceTimes: SourceTime[],
  serviceLineId: string,
  direction: Direction,
): Result<ResolvedTimeBatch, CalendarResolverError> => {
  const departures: ResolvedDeparture[] = [];
  const warnings: CalendarResolverWarning[] = [];
  let partial = false;

  for (const sourceTime of sourceTimes) {
    const result = resolveScheduleTime(sourceTime, serviceLineId, direction);
    if (!result.ok) return result;
    departures.push(result.value.departure);
    warnings.push(...result.value.warnings);
    partial ||= result.value.partial;
  }

  return resolverOk({ departures: sortDepartures(departures), warnings, partial });
};

const sourceTimesFromPattern = (
  pattern: CalendarPatternRecord,
  source: ResolvedDeparture['source'],
  sourceExceptionId?: string,
): SourceTime[] =>
  pattern.times.map((time) => ({
    pattern,
    time,
    source,
    ...(sourceExceptionId ? { sourceExceptionId } : {}),
  }));

export const resolveCalendarAggregate = (
  input: ResolveScheduleInput,
  localDate: LocalDate,
  calendar: CalendarAggregate,
): Result<ResolvedSchedule, CalendarResolverError> => {
  if (
    calendar.serviceLineId !== input.serviceLineId ||
    calendar.status !== SchedulePublicationStatus.PUBLISHED ||
    calendar.timezone !== SUPPORTED_TIMEZONE ||
    dateToIso(calendar.validFrom) > localDate.iso ||
    dateToIso(calendar.validUntil) < localDate.iso
  ) {
    return resolverError('INVALID_CALENDAR_CONFIGURATION', 'Selected calendar is not valid for resolution', {
      serviceCalendarId: calendar.id,
    });
  }

  const exceptionResult = selectEffectiveException(calendar, input, localDate);
  if (!exceptionResult.ok) return exceptionResult;
  const exception = exceptionResult.value;

  if (exception?.effect === ServiceExceptionEffect.NO_SERVICE) {
    return resolverOk({
      serviceLineId: input.serviceLineId,
      serviceCalendarId: calendar.id,
      direction: input.direction,
      serviceDate: localDate.iso,
      timezone: calendar.timezone,
      serviceAvailable: false,
      resolution: 'NO_SERVICE',
      timetableCompleteness: 'COMPLETE',
      exception: exceptionToResolved(exception),
      departures: [],
      warnings: [],
    });
  }

  let regularPattern: CalendarPatternRecord | null = null;
  if (!exception || exception.effect === ServiceExceptionEffect.ADD_TIMES) {
    const regularResult = selectRegularPattern(calendar, input, localDate);
    if (!regularResult.ok) return regularResult;
    regularPattern = regularResult.value;
  }

  let selectedPatterns: SourceTime[] = [];
  let resolution: ResolvedSchedule['resolution'] = 'REGULAR';

  if (!exception) {
    if (!regularPattern) {
      return resolverOk({
        serviceLineId: input.serviceLineId,
        serviceCalendarId: calendar.id,
        direction: input.direction,
        serviceDate: localDate.iso,
        timezone: calendar.timezone,
        serviceAvailable: false,
        resolution: 'NO_SERVICE',
        timetableCompleteness: 'COMPLETE',
        departures: [],
        warnings: [],
      });
    }
    selectedPatterns = sourceTimesFromPattern(regularPattern, 'REGULAR');
  } else {
    const exceptionPatternResult = selectExceptionPattern(calendar, exception, input.direction);
    if (!exceptionPatternResult.ok) return exceptionPatternResult;
    const exceptionPattern = exceptionPatternResult.value;

    if (exception.effect === ServiceExceptionEffect.REPLACE_TIMES) {
      resolution = 'REPLACE_TIMES';
      selectedPatterns = sourceTimesFromPattern(
        exceptionPattern,
        'EXCEPTION_REPLACE',
        exception.id,
      );
    } else if (exception.effect === ServiceExceptionEffect.ADD_TIMES) {
      resolution = 'ADD_TIMES';
      selectedPatterns = [
        ...(regularPattern ? sourceTimesFromPattern(regularPattern, 'REGULAR') : []),
        ...sourceTimesFromPattern(exceptionPattern, 'EXCEPTION_ADD', exception.id),
      ];
    }
  }

  const sourceResult = resolveSourceTimes(selectedPatterns, input.serviceLineId, input.direction);
  if (!sourceResult.ok) return sourceResult;

  return resolverOk({
    serviceLineId: input.serviceLineId,
    serviceCalendarId: calendar.id,
    direction: input.direction,
    serviceDate: localDate.iso,
    timezone: calendar.timezone,
    serviceAvailable: true,
    resolution,
    timetableCompleteness: sourceResult.value.partial ? 'PARTIAL' : 'COMPLETE',
    ...(exception ? { exception: exceptionToResolved(exception) } : {}),
    departures: sourceResult.value.departures,
    warnings: sourceResult.value.warnings,
  });
};
