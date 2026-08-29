import {
  Direction,
  ScheduledDepartureSource,
} from '@prisma/client';
import {
  CalendarResolverError,
  CalendarResolverWarning,
  ResolvedSchedule,
} from './calendar.types';

export const MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS = 31;

export type MaterializeScheduledDeparturesInput = {
  serviceLineId: string;
  direction: Direction;
  fromDate: string;
  toDate?: string;
};

export type MaterializerValidatedInput = Required<MaterializeScheduledDeparturesInput>;

export type ScheduledDepartureSnapshot = {
  sourceScheduleTimeId: string;
  serviceCalendarId: string;
  serviceLineId: string;
  serviceDate: string;
  scheduledTime: string;
  direction: Direction;
  source: ScheduledDepartureSource;
  sourceExceptionId: string | null;
};

export type ScheduledDepartureWriteInput = ScheduledDepartureSnapshot & {
  scheduledTimeValue: Date;
};

export type ExistingScheduledDeparture = ScheduledDepartureSnapshot & {
  id: string;
};

export type ScheduledDepartureDifferenceField =
  | 'serviceCalendarId'
  | 'serviceLineId'
  | 'scheduledTime'
  | 'direction'
  | 'source'
  | 'sourceExceptionId';

export type ExistingDifference = {
  sourceScheduleTimeId: string;
  fields: ScheduledDepartureDifferenceField[];
  expected: ScheduledDepartureSnapshot;
  existing: ExistingScheduledDeparture;
};

export type ExistingDepartureSummary = ExistingScheduledDeparture;

export type ScheduledDeparturePersistenceResult = {
  createdCount: number;
  expectedRows: ExistingScheduledDeparture[];
  scopeRows: ExistingScheduledDeparture[];
};

export type MaterializationDateOutcome =
  | 'MATERIALIZED'
  | 'NO_SERVICE'
  | 'RECONCILIATION_REQUIRED'
  | 'RESOLUTION_FAILED';

export type MaterializationDateResult = {
  serviceDate: string;
  outcome: MaterializationDateOutcome;
  serviceAvailable: boolean | null;
  resolution: ResolvedSchedule['resolution'] | null;
  resolvedCount: number;
  createdCount: number;
  existingSameCount: number;
  existingDifferent: ExistingDifference[];
  missingFromCurrentResolution: ExistingDepartureSummary[];
  warnings: CalendarResolverWarning[];
  error?: CalendarResolverError;
};

export type MaterializationRangeResult = {
  serviceLineId: string;
  direction: Direction;
  fromDate: string;
  toDate: string;
  totalDates: number;
  processedDates: number;
  noServiceDates: number;
  created: number;
  existingSame: number;
  existingDifferent: number;
  missingFromCurrentResolution: number;
  errors: number;
  dates: MaterializationDateResult[];
};
