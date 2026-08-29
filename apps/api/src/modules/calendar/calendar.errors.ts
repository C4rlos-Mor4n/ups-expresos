import {
  CalendarResolverError,
  CalendarResolverErrorCode,
  Result,
} from './calendar.types';

export const resolverError = (
  code: CalendarResolverErrorCode,
  message: string,
  details?: Record<string, string>,
): Result<never, CalendarResolverError> => ({
  ok: false,
  error: details ? { code, message, details } : { code, message },
});

export const resolverOk = <T>(value: T): Result<T, CalendarResolverError> => ({
  ok: true,
  value,
});

export const resolverWarning = (
  code: 'PARTIAL_TIMETABLE' | 'INVALID_TIMETABLE_RELATION' | 'INVALID_STOP_TIMETABLE',
  message: string,
  details: Record<string, string>,
) => ({ code, message, details });
