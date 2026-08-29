import { Direction, ScheduledDepartureSource } from '@prisma/client';
import { MaterializerInputError, MaterializerInvariantError } from './scheduled-departure-materializer.errors';
import {
  enumerateMaterializationDates,
  prepareScheduledDepartureWrites,
  validateMaterializationInput,
} from './scheduled-departure-materializer.functions';
import { ResolvedSchedule } from './calendar.types';

const ids = {
  line: '11111111-1111-4111-8111-111111111111',
  calendar: '22222222-2222-4222-8222-222222222222',
  regularTime: '33333333-3333-4333-8333-333333333333',
  replaceTime: '44444444-4444-4444-8444-444444444444',
  addTime: '55555555-5555-4555-8555-555555555555',
  exception: '66666666-6666-4666-8666-666666666666',
};

const makeSchedule = (overrides: Partial<ResolvedSchedule> = {}): ResolvedSchedule => ({
  serviceLineId: ids.line,
  serviceCalendarId: ids.calendar,
  direction: Direction.IDA,
  serviceDate: '2026-09-01',
  timezone: 'America/Guayaquil',
  serviceAvailable: true,
  resolution: 'REGULAR',
  timetableCompleteness: 'COMPLETE',
  departures: [
    {
      patternId: 'regular-pattern',
      scheduleTimeId: ids.regularTime,
      departureTime: '06:40:00',
      approximateArrivalTime: null,
      source: 'REGULAR',
      journeys: [],
    },
  ],
  warnings: [],
  ...overrides,
});

const input = {
  serviceLineId: ids.line,
  direction: Direction.IDA,
  fromDate: '2026-09-01',
};

describe('scheduled departure materializer functions', () => {
  it('accepts a single civil date and an inclusive 31-day range', () => {
    expect(validateMaterializationInput(input)).toEqual({ ...input, toDate: '2026-09-01' });

    const range = validateMaterializationInput({ ...input, toDate: '2026-10-01' });
    expect(enumerateMaterializationDates(range)).toHaveLength(31);
    expect(enumerateMaterializationDates(range)[0]).toBe('2026-09-01');
    expect(enumerateMaterializationDates(range)[30]).toBe('2026-10-01');
  });

  it.each([
    [{ ...input, serviceLineId: 'not-a-uuid' }, 'INVALID_SERVICE_LINE_ID'],
    [{ ...input, direction: 'OTHER' as Direction }, 'INVALID_DIRECTION'],
    [{ ...input, fromDate: '2026-02-30' }, 'INVALID_FROM_DATE'],
    [{ ...input, toDate: '2026-08-31' }, 'INVALID_DATE_RANGE'],
    [{ ...input, toDate: '2026-10-02' }, 'MATERIALIZATION_RANGE_TOO_LARGE'],
  ])('rejects invalid materialization input %#', (invalidInput, code) => {
    expect(() => validateMaterializationInput(invalidInput)).toThrow(MaterializerInputError);
    try {
      validateMaterializationInput(invalidInput);
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });

  it('maps regular and exception provenance exactly once per resolved departure', () => {
    const schedule = makeSchedule({
      resolution: 'ADD_TIMES',
      exception: { id: ids.exception, reason: 'HOLIDAY', effect: 'ADD_TIMES' },
      departures: [
        {
          patternId: 'regular-pattern',
          scheduleTimeId: ids.regularTime,
          departureTime: '06:40:00',
          approximateArrivalTime: null,
          source: 'REGULAR',
          journeys: [{ journeyTemplateId: 'journey-a', routePathId: 'path-a', direction: Direction.IDA, scheduledStopTimes: [] }],
        },
        {
          patternId: 'add-pattern',
          scheduleTimeId: ids.addTime,
          departureTime: '06:40:00',
          approximateArrivalTime: null,
          source: 'EXCEPTION_ADD',
          sourceExceptionId: ids.exception,
          journeys: [
            { journeyTemplateId: 'journey-b', routePathId: 'path-b', direction: Direction.IDA, scheduledStopTimes: [] },
            { journeyTemplateId: 'journey-c', routePathId: 'path-c', direction: Direction.IDA, scheduledStopTimes: [] },
          ],
        },
      ],
    });

    const writes = prepareScheduledDepartureWrites(validateMaterializationInput(input), schedule);

    expect(writes).toHaveLength(2);
    expect(writes.map((write) => write.source)).toEqual([
      ScheduledDepartureSource.REGULAR,
      ScheduledDepartureSource.EXCEPTION_ADD,
    ]);
    expect(writes[0]).toMatchObject({ sourceExceptionId: null, sourceScheduleTimeId: ids.regularTime });
    expect(writes[1]).toMatchObject({ sourceExceptionId: ids.exception, sourceScheduleTimeId: ids.addTime });
  });

  it('maps EXCEPTION_REPLACE only when it matches the resolved exception', () => {
    const schedule = makeSchedule({
      resolution: 'REPLACE_TIMES',
      exception: { id: ids.exception, reason: 'HOLIDAY', effect: 'REPLACE_TIMES' },
      departures: [
        {
          patternId: 'replace-pattern',
          scheduleTimeId: ids.replaceTime,
          departureTime: '09:10:00',
          approximateArrivalTime: null,
          source: 'EXCEPTION_REPLACE',
          sourceExceptionId: ids.exception,
          journeys: [],
        },
      ],
    });

    expect(prepareScheduledDepartureWrites(validateMaterializationInput(input), schedule)).toMatchObject([
      { source: ScheduledDepartureSource.EXCEPTION_REPLACE, sourceExceptionId: ids.exception },
    ]);
  });

  it('fails closed on duplicate source identities and invalid exception provenance', () => {
    const duplicate = makeSchedule({
      departures: [
        makeSchedule().departures[0]!,
        { ...makeSchedule().departures[0]!, journeys: [] },
      ],
    });
    expect(() => prepareScheduledDepartureWrites(validateMaterializationInput(input), duplicate)).toThrow(
      MaterializerInvariantError,
    );

    const invalidException = makeSchedule({
      resolution: 'ADD_TIMES',
      exception: { id: ids.exception, reason: 'HOLIDAY', effect: 'ADD_TIMES' },
      departures: [
        {
          ...makeSchedule().departures[0]!,
          source: 'EXCEPTION_ADD',
          sourceExceptionId: ids.regularTime,
        },
      ],
    });
    expect(() => prepareScheduledDepartureWrites(validateMaterializationInput(input), invalidException)).toThrow(
      MaterializerInvariantError,
    );

    const regularWithException = makeSchedule({
      departures: [
        {
          ...makeSchedule().departures[0]!,
          sourceExceptionId: ids.exception,
        },
      ],
    });
    expect(() => prepareScheduledDepartureWrites(validateMaterializationInput(input), regularWithException)).toThrow(
      MaterializerInvariantError,
    );

    expect(() =>
      prepareScheduledDepartureWrites(
        validateMaterializationInput(input),
        makeSchedule({ departures: [] }),
      ),
    ).toThrow(MaterializerInvariantError);
  });

  it('fails closed on an out-of-scope schedule and an invalid resolved time', () => {
    expect(() =>
      prepareScheduledDepartureWrites(
        validateMaterializationInput(input),
        makeSchedule({ serviceLineId: ids.calendar }),
      ),
    ).toThrow(MaterializerInvariantError);

    expect(() =>
      prepareScheduledDepartureWrites(
        validateMaterializationInput(input),
        makeSchedule({
          departures: [
            {
              ...makeSchedule().departures[0]!,
              departureTime: '25:00:00',
            },
          ],
        }),
      ),
    ).toThrow(MaterializerInvariantError);
  });
});
