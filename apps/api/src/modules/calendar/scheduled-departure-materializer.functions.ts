import {
  Direction,
  ScheduledDepartureSource,
} from '@prisma/client';
import {
  MaterializerInputError,
  MaterializerInvariantError,
} from './scheduled-departure-materializer.errors';
import {
  ExistingDifference,
  ExistingScheduledDeparture,
  MaterializeScheduledDeparturesInput,
  MaterializerValidatedInput,
  MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS,
  ScheduledDepartureDifferenceField,
  ScheduledDepartureSnapshot,
  ScheduledDepartureWriteInput,
} from './scheduled-departure-materializer.types';
import { parseLocalDate } from './calendar-resolver.functions';
import { ResolvedDeparture, ResolvedSchedule } from './calendar.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const toUtcDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const validateDate = (
  value: unknown,
  code: 'INVALID_FROM_DATE' | 'INVALID_TO_DATE',
  name: 'fromDate' | 'toDate',
): string => {
  if (typeof value !== 'string') {
    throw new MaterializerInputError(code, `${name} must use YYYY-MM-DD format`);
  }

  const parsed = parseLocalDate(value);
  if (!parsed.ok) {
    throw new MaterializerInputError(code, `${name} must be a valid civil date`);
  }

  return parsed.value.iso;
};

export const validateMaterializationInput = (
  input: MaterializeScheduledDeparturesInput,
): MaterializerValidatedInput => {
  if (!isUuid(input.serviceLineId)) {
    throw new MaterializerInputError('INVALID_SERVICE_LINE_ID', 'serviceLineId must be a UUID');
  }
  if (input.direction !== Direction.IDA && input.direction !== Direction.RETORNO) {
    throw new MaterializerInputError('INVALID_DIRECTION', 'direction must be IDA or RETORNO');
  }

  const fromDate = validateDate(input.fromDate, 'INVALID_FROM_DATE', 'fromDate');
  const toDate = validateDate(input.toDate ?? input.fromDate, 'INVALID_TO_DATE', 'toDate');
  if (fromDate > toDate) {
    throw new MaterializerInputError('INVALID_DATE_RANGE', 'fromDate must not be after toDate');
  }

  const days = Math.floor((toUtcDate(toDate).getTime() - toUtcDate(fromDate).getTime()) / 86_400_000) + 1;
  if (days > MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS) {
    throw new MaterializerInputError(
      'MATERIALIZATION_RANGE_TOO_LARGE',
      `materialization range must not exceed ${MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS} days`,
    );
  }

  return { serviceLineId: input.serviceLineId, direction: input.direction, fromDate, toDate };
};

export const enumerateMaterializationDates = (
  input: MaterializerValidatedInput,
): string[] => {
  const current = toUtcDate(input.fromDate);
  const end = toUtcDate(input.toDate);
  const dates: string[] = [];

  while (current <= end) {
    dates.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

const mapSource = (source: ResolvedDeparture['source']): ScheduledDepartureSource => {
  switch (source) {
    case 'REGULAR':
      return ScheduledDepartureSource.REGULAR;
    case 'EXCEPTION_REPLACE':
      return ScheduledDepartureSource.EXCEPTION_REPLACE;
    case 'EXCEPTION_ADD':
      return ScheduledDepartureSource.EXCEPTION_ADD;
  }
};

const toTimeValue = (value: string): Date => {
  if (!TIME_PATTERN.test(value)) {
    throw new MaterializerInvariantError('Resolved departure has an invalid departureTime');
  }

  const [hours, minutes, seconds] = value.split(':').map(Number);
  if (hours === undefined || minutes === undefined || seconds === undefined) {
    throw new MaterializerInvariantError('Resolved departure has an incomplete departureTime');
  }

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
};

const assertResolvedScope = (
  input: MaterializerValidatedInput,
  schedule: ResolvedSchedule,
): void => {
  if (
    schedule.serviceLineId !== input.serviceLineId ||
    schedule.direction !== input.direction ||
    schedule.serviceDate !== input.fromDate
  ) {
    throw new MaterializerInvariantError('Calendar resolver returned a schedule outside the requested scope');
  }
  if (!isUuid(schedule.serviceCalendarId)) {
    throw new MaterializerInvariantError('Calendar resolver returned an invalid serviceCalendarId');
  }
  if (schedule.serviceAvailable && schedule.resolution === 'NO_SERVICE') {
    throw new MaterializerInvariantError('Calendar resolver marked NO_SERVICE as available');
  }
  if (!schedule.serviceAvailable && (schedule.resolution !== 'NO_SERVICE' || schedule.departures.length > 0)) {
    throw new MaterializerInvariantError('Calendar resolver returned unavailable service with departures');
  }
};

const assertDepartureProvenance = (
  departure: ResolvedDeparture,
  schedule: ResolvedSchedule,
): string | null => {
  if (!isUuid(departure.scheduleTimeId)) {
    throw new MaterializerInvariantError('Calendar resolver returned an invalid scheduleTimeId');
  }

  if (departure.source === 'REGULAR') {
    if (departure.sourceExceptionId !== undefined) {
      throw new MaterializerInvariantError('REGULAR departure must not include sourceExceptionId');
    }
    return null;
  }

  const exceptionId = departure.sourceExceptionId;
  if (!isUuid(exceptionId) || schedule.exception?.id !== exceptionId) {
    throw new MaterializerInvariantError('Exception departure provenance does not match the resolved exception');
  }
  if (
    (departure.source === 'EXCEPTION_REPLACE' && schedule.resolution !== 'REPLACE_TIMES') ||
    (departure.source === 'EXCEPTION_ADD' && schedule.resolution !== 'ADD_TIMES')
  ) {
    throw new MaterializerInvariantError('Exception departure source does not match the resolved schedule');
  }

  return exceptionId;
};

export const prepareScheduledDepartureWrites = (
  input: MaterializerValidatedInput,
  schedule: ResolvedSchedule,
): ScheduledDepartureWriteInput[] => {
  assertResolvedScope(input, schedule);
  if (!schedule.serviceAvailable) return [];
  if (schedule.departures.length === 0) {
    throw new MaterializerInvariantError('Available service must contain at least one resolved departure');
  }

  const sourceScheduleTimeIds = new Set<string>();
  const writes = schedule.departures.map((departure) => {
    if (sourceScheduleTimeIds.has(departure.scheduleTimeId)) {
      throw new MaterializerInvariantError('Calendar resolver returned duplicate scheduleTimeId values');
    }
    sourceScheduleTimeIds.add(departure.scheduleTimeId);

    const sourceExceptionId = assertDepartureProvenance(departure, schedule);
    return {
      sourceScheduleTimeId: departure.scheduleTimeId,
      serviceCalendarId: schedule.serviceCalendarId,
      serviceLineId: schedule.serviceLineId,
      serviceDate: schedule.serviceDate,
      scheduledTime: departure.departureTime,
      scheduledTimeValue: toTimeValue(departure.departureTime),
      direction: schedule.direction,
      source: mapSource(departure.source),
      sourceExceptionId,
    };
  });

  return [...writes].sort((left, right) => {
    const timeOrder = left.scheduledTime.localeCompare(right.scheduledTime);
    if (timeOrder !== 0) return timeOrder;
    return left.sourceScheduleTimeId.localeCompare(right.sourceScheduleTimeId);
  });
};

const compareFields: ScheduledDepartureDifferenceField[] = [
  'serviceCalendarId',
  'serviceLineId',
  'scheduledTime',
  'direction',
  'source',
  'sourceExceptionId',
];

export const compareScheduledDepartureSnapshots = (
  expected: ScheduledDepartureSnapshot,
  existing: ExistingScheduledDeparture,
): ExistingDifference | null => {
  if (
    expected.sourceScheduleTimeId !== existing.sourceScheduleTimeId ||
    expected.serviceDate !== existing.serviceDate
  ) {
    throw new MaterializerInvariantError('ScheduledDeparture comparison used different natural identities');
  }

  const fields = compareFields.filter((field) => expected[field] !== existing[field]);
  if (fields.length === 0) return null;

  return { sourceScheduleTimeId: expected.sourceScheduleTimeId, fields, expected, existing };
};

const compareExistingRows = (
  left: ExistingScheduledDeparture,
  right: ExistingScheduledDeparture,
): number => {
  const timeOrder = left.scheduledTime.localeCompare(right.scheduledTime);
  if (timeOrder !== 0) return timeOrder;
  return left.sourceScheduleTimeId.localeCompare(right.sourceScheduleTimeId);
};

export const sortExistingRows = (
  rows: ExistingScheduledDeparture[],
): ExistingScheduledDeparture[] => [...rows].sort(compareExistingRows);
