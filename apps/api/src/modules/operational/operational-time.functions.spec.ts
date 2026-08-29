import {
  calculatePlannedWindow,
  guayaquilToday,
  nextCivilDate,
  parseCivilDate,
} from './operational-time.functions';

describe('operational planned-window functions', () => {
  it('creates a Guayaquil civil planned window without host-timezone dependence', () => {
    const window = calculatePlannedWindow(
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('1970-01-01T23:50:00.000Z'),
      30,
    );

    expect(window).toEqual({
      plannedStartAt: new Date('2026-09-02T04:50:00.000Z'),
      plannedEndAt: new Date('2026-09-02T05:20:00.000Z'),
    });
  });

  it('accepts only real YYYY-MM-DD civil dates', () => {
    expect(parseCivilDate('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(parseCivilDate('2026-02-30')).toBeNull();
    expect(parseCivilDate('2026-2-28')).toBeNull();
  });

  it('uses the Guayaquil civil day and advances dates with UTC calendar arithmetic', () => {
    expect(guayaquilToday(new Date('2026-09-02T04:30:00.000Z'))).toBe('2026-09-01');
    expect(nextCivilDate(new Date('2026-02-28T00:00:00.000Z')).toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
  });
});
