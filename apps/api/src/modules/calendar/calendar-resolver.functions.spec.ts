import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  ServiceExceptionEffect,
  ServiceExceptionReason,
  ServiceExceptionStatus,
  Weekday,
} from '@prisma/client';
import {
  parseLocalDate,
  resolveCalendarAggregate,
} from './calendar-resolver.functions';
import {
  CalendarAggregate,
  CalendarJourneyTemplateRecord,
  CalendarPatternRecord,
  CalendarTimeRecord,
  ResolveScheduleInput,
} from './calendar.types';

const input: ResolveScheduleInput = {
  serviceLineId: 'line-1',
  direction: Direction.IDA,
  serviceDate: '2026-08-28',
};

const makeTime = (
  id: string,
  departureTime = '06:40:00',
  journeyTemplates: CalendarJourneyTemplateRecord[] = [],
): CalendarTimeRecord => ({
  id,
  patternId: 'pattern-1',
  departureTime,
  approximateArrivalTime: null,
  journeyTemplates,
});

const makePattern = (
  overrides: Partial<CalendarPatternRecord> = {},
): CalendarPatternRecord => ({
  id: 'pattern-1',
  serviceCalendarId: 'calendar-1',
  direction: Direction.IDA,
  type: SchedulePatternType.EXPLICIT_TIMES,
  status: SchedulePublicationStatus.PUBLISHED,
  exceptionId: null,
  days: [Weekday.FRIDAY],
  times: [makeTime('time-1')],
  ...overrides,
});

const makeCalendar = (overrides: Partial<CalendarAggregate> = {}): CalendarAggregate => ({
  id: 'calendar-1',
  serviceLineId: 'line-1',
  validFrom: new Date('2026-01-01T00:00:00.000Z'),
  validUntil: new Date('2026-12-31T00:00:00.000Z'),
  timezone: 'America/Guayaquil',
  status: SchedulePublicationStatus.PUBLISHED,
  patterns: [makePattern()],
  exceptions: [],
  ...overrides,
});

const makeJourney = (overrides: Partial<CalendarJourneyTemplateRecord> = {}): CalendarJourneyTemplateRecord => ({
  id: 'journey-1',
  scheduleTimeId: 'time-1',
  routePathId: 'path-1',
  routePath: {
    id: 'path-1',
    serviceLineId: 'line-1',
    direction: Direction.IDA,
    stops: [
      { id: 'stop-2', routePathId: 'path-1', stopOrder: 2 },
      { id: 'stop-1', routePathId: 'path-1', stopOrder: 1 },
    ],
  },
  stopTimes: [
    { id: 'stop-time-2', journeyTemplateId: 'journey-1', routePathStopId: 'stop-2', offsetMinutes: 30 },
    { id: 'stop-time-1', journeyTemplateId: 'journey-1', routePathStopId: 'stop-1', offsetMinutes: 0 },
  ],
  ...overrides,
});

const makeException = (
  effect: ServiceExceptionEffect,
  direction: Direction | null = null,
  overrides: Partial<{
    id: string;
    serviceCalendarId: string;
    serviceDate: Date;
    status: ServiceExceptionStatus;
  }> = {},
) => ({
  id: `exception-${direction ?? 'global'}`,
  serviceCalendarId: 'calendar-1',
  serviceDate: new Date('2026-08-28T00:00:00.000Z'),
  direction,
  reason: ServiceExceptionReason.HOLIDAY,
  effect,
  status: ServiceExceptionStatus.PUBLISHED,
  ...overrides,
});

const makeJourneyForId = (id: string): CalendarJourneyTemplateRecord =>
  makeJourney({
    id,
    stopTimes: [
      { id: `${id}-stop-time-2`, journeyTemplateId: id, routePathStopId: 'stop-2', offsetMinutes: 30 },
      { id: `${id}-stop-time-1`, journeyTemplateId: id, routePathStopId: 'stop-1', offsetMinutes: 0 },
    ],
  });

describe('calendar resolver pure functions', () => {
  it.each([
    ['2026-02-30', false],
    ['2026-13-01', false],
    ['2026-08-28T10:00:00', false],
    ['28/08/2026', false],
    ['2026-08-28', true],
    ['2024-02-29', true],
    ['2023-02-29', false],
  ])('validates local date %s', (value, valid) => {
    expect(parseLocalDate(value).ok).toBe(valid);
  });

  it.each([
    ['2026-08-24', Weekday.MONDAY],
    ['2026-08-25', Weekday.TUESDAY],
    ['2026-08-26', Weekday.WEDNESDAY],
    ['2026-08-27', Weekday.THURSDAY],
    ['2026-08-28', Weekday.FRIDAY],
    ['2026-08-29', Weekday.SATURDAY],
    ['2026-08-30', Weekday.SUNDAY],
  ])('maps %s to the explicit Weekday enum', (value, weekday) => {
    const result = parseLocalDate(value);
    expect(result).toEqual({ ok: true, value: { iso: value, weekday } });
  });

  it('accepts inclusive calendar boundaries and rejects dates outside the range', () => {
    const boundaryCalendar = makeCalendar({
      validFrom: new Date('2026-08-28T00:00:00.000Z'),
      validUntil: new Date('2026-08-28T00:00:00.000Z'),
    });

    expect(
      resolveCalendarAggregate(
        input,
        { iso: '2026-08-28', weekday: Weekday.FRIDAY },
        boundaryCalendar,
      ),
    ).toMatchObject({ ok: true });
    expect(
      resolveCalendarAggregate(
        { ...input, serviceDate: '2026-08-29' },
        { iso: '2026-08-29', weekday: Weekday.SATURDAY },
        boundaryCalendar,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_CALENDAR_CONFIGURATION' } });
  });

  it('rejects calendars outside the supported timezone', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({ timezone: 'UTC' }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_CALENDAR_CONFIGURATION' } });
  });

  it('returns NO_SERVICE when no regular pattern matches the weekday', () => {
    const result = resolveCalendarAggregate(
      { ...input, serviceDate: '2026-08-30' },
      { iso: '2026-08-30', weekday: Weekday.SUNDAY },
      makeCalendar(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resolution).toBe('NO_SERVICE');
      expect(result.value.departures).toHaveLength(0);
    }
  });

  it('fails closed when regular patterns are ambiguous', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({ patterns: [makePattern(), makePattern({ id: 'pattern-2' })] }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'AMBIGUOUS_PATTERN' } });
  });

  it('uses only the exception pattern for REPLACE_TIMES', () => {
    const exception = makeException(ServiceExceptionEffect.REPLACE_TIMES);
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({ times: [makeTime('regular-time', '06:40:00')] }),
          makePattern({
            id: 'exception-pattern',
            exceptionId: exception.id,
            days: [],
            times: [makeTime('exception-time', '09:10:00')],
          }),
        ],
        exceptions: [exception],
      }),
    );

    expect(result).toMatchObject({ ok: true, value: { resolution: 'REPLACE_TIMES' } });
    if (result.ok) expect(result.value.departures.map((departure) => departure.departureTime)).toEqual(['09:10:00']);
  });

  it('does not evaluate ambiguous regular patterns during REPLACE_TIMES', () => {
    const exception = makeException(ServiceExceptionEffect.REPLACE_TIMES);
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({ id: 'regular-1' }),
          makePattern({ id: 'regular-2' }),
          makePattern({ id: 'exception-pattern', exceptionId: exception.id, days: [] }),
        ],
        exceptions: [exception],
      }),
    );

    expect(result).toMatchObject({ ok: true, value: { resolution: 'REPLACE_TIMES' } });
  });

  it('uses the direction-specific exception instead of a global exception', () => {
    const global = makeException(ServiceExceptionEffect.NO_SERVICE);
    const specific = makeException(ServiceExceptionEffect.ADD_TIMES, Direction.IDA);
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern(),
          makePattern({
            id: 'exception-pattern',
            exceptionId: specific.id,
            days: [],
            times: [makeTime('extra-time', '10:00:00')],
          }),
        ],
        exceptions: [global, specific],
      }),
    );

    expect(result).toMatchObject({ ok: true, value: { resolution: 'ADD_TIMES' } });
    if (result.ok) {
      expect(result.value.serviceAvailable).toBe(true);
      expect(result.value.departures.map((departure) => departure.departureTime)).toEqual([
        '06:40:00',
        '10:00:00',
      ]);
    }
  });

  it('ignores DRAFT and CANCELLED exceptions', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [],
        exceptions: [
          makeException(ServiceExceptionEffect.NO_SERVICE, null, {
            id: 'draft-exception',
            status: ServiceExceptionStatus.DRAFT,
          }),
          makeException(ServiceExceptionEffect.NO_SERVICE, Direction.IDA, {
            id: 'cancelled-exception',
            status: ServiceExceptionStatus.CANCELLED,
          }),
        ],
      }),
    );

    expect(result).toMatchObject({ ok: true, value: { resolution: 'NO_SERVICE', serviceAvailable: false } });
  });

  it('returns NO_SERVICE without evaluating regular times when the exception cancels service', () => {
    const exception = makeException(ServiceExceptionEffect.NO_SERVICE);
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [makePattern({ times: [makeTime('invalid-time', '25:00:00')] })],
        exceptions: [exception],
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { resolution: 'NO_SERVICE', serviceAvailable: false, departures: [] },
    });
  });

  it('rejects missing and multiple published exception patterns', () => {
    const exception = makeException(ServiceExceptionEffect.REPLACE_TIMES);
    const missing = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({ patterns: [], exceptions: [exception] }),
    );
    expect(missing).toMatchObject({ ok: false, error: { code: 'INVALID_EXCEPTION_CONFIGURATION' } });

    const multiple = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({ id: 'exception-pattern-a', exceptionId: exception.id, days: [] }),
          makePattern({ id: 'exception-pattern-b', exceptionId: exception.id, days: [] }),
        ],
        exceptions: [exception],
      }),
    );
    expect(multiple).toMatchObject({ ok: false, error: { code: 'AMBIGUOUS_PATTERN' } });
  });

  it('preserves nominal collisions from different schedule time identities', () => {
    const exception = makeException(ServiceExceptionEffect.ADD_TIMES);
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({ times: [makeTime('regular-time', '16:50:00')] }),
          makePattern({
            id: 'exception-pattern',
            exceptionId: exception.id,
            days: [],
            times: [makeTime('exception-time', '16:50:00')],
          }),
        ],
        exceptions: [exception],
      }),
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.departures).toHaveLength(2);
      expect(new Set(result.value.departures.map((departure) => departure.scheduleTimeId)).size).toBe(2);
    }
  });

  it('marks zero journeys as a partial timetable instead of NO_SERVICE', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar(),
    );

    expect(result).toMatchObject({ ok: true, value: { timetableCompleteness: 'PARTIAL' } });
    if (result.ok) expect(result.value.warnings[0]?.code).toBe('PARTIAL_TIMETABLE');
  });

  it('returns all valid journeys and sorts stops by stopOrder', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [makeTime('time-1', '23:50:00', [makeJourney()])],
          }),
        ],
      }),
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      const stops = result.value.departures[0]?.journeys[0]?.scheduledStopTimes;
      expect(stops?.map((stop) => stop.routePathStopId)).toEqual(['stop-1', 'stop-2']);
      expect(stops?.[1]).toMatchObject({ plannedTime: '00:20:00', dayOffset: 1 });
    }
  });

  it('sorts journeys by journeyTemplateId independently of input order', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourneyForId('journey-C'),
                makeJourneyForId('journey-A'),
                makeJourneyForId('journey-B'),
              ]),
            ],
          }),
        ],
      }),
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.departures[0]?.journeys.map((journey) => journey.journeyTemplateId)).toEqual([
        'journey-A',
        'journey-B',
        'journey-C',
      ]);
    }
  });

  it('rejects incomplete, foreign-stop, foreign-service and wrong-direction journeys', () => {
    const incomplete = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [makeTime('time-1', '06:40:00', [makeJourney({ stopTimes: [] })])],
          }),
        ],
      }),
    );
    expect(incomplete).toMatchObject({ ok: false, error: { code: 'INVALID_STOP_TIMETABLE' } });

    const foreignStop = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  stopTimes: [
                    { id: 'stop-time-1', journeyTemplateId: 'journey-1', routePathStopId: 'foreign-stop', offsetMinutes: 0 },
                    { id: 'stop-time-2', journeyTemplateId: 'journey-1', routePathStopId: 'stop-2', offsetMinutes: 30 },
                  ],
                }),
              ]),
            ],
          }),
        ],
      }),
    );
    expect(foreignStop).toMatchObject({ ok: false, error: { code: 'INVALID_STOP_TIMETABLE' } });

    const foreignService = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  routePath: { ...makeJourney().routePath, serviceLineId: 'other-line' },
                }),
              ]),
            ],
          }),
        ],
      }),
    );
    expect(foreignService).toMatchObject({ ok: false, error: { code: 'INVALID_TIMETABLE_RELATION' } });

    const wrongDirection = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  routePath: { ...makeJourney().routePath, direction: Direction.RETORNO },
                }),
              ]),
            ],
          }),
        ],
      }),
    );
    expect(wrongDirection).toMatchObject({ ok: false, error: { code: 'INVALID_TIMETABLE_RELATION' } });
  });

  it('rejects a non-zero first stop offset', () => {
    const result = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  stopTimes: [
                    { id: 'stop-time-1', journeyTemplateId: 'journey-1', routePathStopId: 'stop-1', offsetMinutes: 1 },
                    { id: 'stop-time-2', journeyTemplateId: 'journey-1', routePathStopId: 'stop-2', offsetMinutes: 30 },
                  ],
                }),
              ]),
            ],
          }),
        ],
      }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_STOP_TIMETABLE' } });
  });

  it('returns the same semantic result on repeated resolution', () => {
    const calendar = makeCalendar({
      patterns: [
        makePattern({
          times: [makeTime('time-1', '23:50:00', [makeJourney()])],
        }),
      ],
    });

    const first = resolveCalendarAggregate(input, { iso: input.serviceDate, weekday: Weekday.FRIDAY }, calendar);
    const second = resolveCalendarAggregate(input, { iso: input.serviceDate, weekday: Weekday.FRIDAY }, calendar);

    expect(second).toEqual(first);
  });

  it('rejects a decreasing offset and accepts equal offsets', () => {
    const decreasing = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  stopTimes: [
                    { id: 'stop-time-1', journeyTemplateId: 'journey-1', routePathStopId: 'stop-1', offsetMinutes: 0 },
                    { id: 'stop-time-2', journeyTemplateId: 'journey-1', routePathStopId: 'stop-2', offsetMinutes: -1 },
                  ],
                }),
              ]),
            ],
          }),
        ],
      }),
    );
    expect(decreasing).toMatchObject({ ok: false, error: { code: 'INVALID_STOP_TIMETABLE' } });

    const equal = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [
          makePattern({
            times: [
              makeTime('time-1', '06:40:00', [
                makeJourney({
                  stopTimes: [
                    { id: 'stop-time-1', journeyTemplateId: 'journey-1', routePathStopId: 'stop-1', offsetMinutes: 0 },
                    { id: 'stop-time-2', journeyTemplateId: 'journey-1', routePathStopId: 'stop-2', offsetMinutes: 0 },
                  ],
                }),
              ]),
            ],
          }),
        ],
      }),
    );
    expect(equal).toMatchObject({ ok: true, value: { timetableCompleteness: 'COMPLETE' } });
  });

  it('rejects exception patterns from another calendar or with weekdays', () => {
    const exception = makeException(ServiceExceptionEffect.REPLACE_TIMES);
    const foreign = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [makePattern({ id: 'foreign', exceptionId: exception.id, serviceCalendarId: 'other-calendar' })],
        exceptions: [exception],
      }),
    );
    expect(foreign).toMatchObject({ ok: false, error: { code: 'INVALID_EXCEPTION_CONFIGURATION' } });

    const withDays = resolveCalendarAggregate(
      input,
      { iso: input.serviceDate, weekday: Weekday.FRIDAY },
      makeCalendar({
        patterns: [makePattern({ id: 'exception', exceptionId: exception.id, days: [Weekday.FRIDAY] })],
        exceptions: [exception],
      }),
    );
    expect(withDays).toMatchObject({ ok: false, error: { code: 'INVALID_EXCEPTION_CONFIGURATION' } });
  });
});
