import { Test, TestingModule } from '@nestjs/testing';
import { Direction, SchedulePublicationStatus, Weekday } from '@prisma/client';
import { CalendarRepository } from './calendar.repository';
import { CalendarResolverService } from './calendar-resolver.service';
import { CalendarAggregate } from './calendar.types';

const calendar: CalendarAggregate = {
  id: 'calendar-1',
  serviceLineId: 'line-1',
  validFrom: new Date('2026-01-01T00:00:00.000Z'),
  validUntil: new Date('2026-12-31T00:00:00.000Z'),
  timezone: 'America/Guayaquil',
  status: SchedulePublicationStatus.PUBLISHED,
  patterns: [
    {
      id: 'pattern-1',
      serviceCalendarId: 'calendar-1',
      direction: Direction.IDA,
      type: 'EXPLICIT_TIMES',
      status: SchedulePublicationStatus.PUBLISHED,
      exceptionId: null,
      days: [Weekday.FRIDAY],
      times: [
        {
          id: 'time-1',
          patternId: 'pattern-1',
          departureTime: '06:40:00',
          approximateArrivalTime: null,
          journeyTemplates: [],
        },
      ],
    },
  ],
  exceptions: [],
};

describe('CalendarResolverService', () => {
  let service: CalendarResolverService;
  const repository = {
    findServiceLine: jest.fn(),
    findPublishedCalendarCandidates: jest.fn(),
    findCalendarAggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarResolverService,
        { provide: CalendarRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<CalendarResolverService>(CalendarResolverService);
    jest.clearAllMocks();
  });

  it('rejects malformed service dates before repository access', async () => {
    const result = await service.resolveSchedule({
      serviceLineId: 'line-1',
      direction: Direction.IDA,
      serviceDate: '2026-02-30',
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_DATE' } });
    expect(repository.findServiceLine).not.toHaveBeenCalled();
  });

  it('distinguishes missing and inactive service lines', async () => {
    repository.findServiceLine.mockResolvedValueOnce(null);
    await expect(
      service.resolveSchedule({ serviceLineId: 'missing', direction: Direction.IDA, serviceDate: '2026-08-28' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'SERVICE_LINE_NOT_FOUND' } });

    repository.findServiceLine.mockResolvedValueOnce({ id: 'line-1', isActive: false });
    await expect(
      service.resolveSchedule({ serviceLineId: 'line-1', direction: Direction.IDA, serviceDate: '2026-08-28' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'SERVICE_LINE_INACTIVE' } });
  });

  it('fails closed for zero and multiple published calendar candidates', async () => {
    repository.findServiceLine.mockResolvedValue({ id: 'line-1', isActive: true });
    repository.findPublishedCalendarCandidates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'calendar-1' }, { id: 'calendar-2' }]);

    const input = { serviceLineId: 'line-1', direction: Direction.IDA, serviceDate: '2026-08-28' };
    await expect(service.resolveSchedule(input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'NO_PUBLISHED_CALENDAR' },
    });
    await expect(service.resolveSchedule(input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'AMBIGUOUS_CALENDAR' },
    });
    expect(repository.findCalendarAggregate).not.toHaveBeenCalled();
  });

  it('resolves a selected calendar without exposing an HTTP boundary', async () => {
    repository.findServiceLine.mockResolvedValue({ id: 'line-1', isActive: true });
    repository.findPublishedCalendarCandidates.mockResolvedValue([{ id: 'calendar-1' }]);
    repository.findCalendarAggregate.mockResolvedValue(calendar);

    const result = await service.resolveSchedule({
      serviceLineId: 'line-1',
      direction: Direction.IDA,
      serviceDate: '2026-08-28',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        serviceCalendarId: 'calendar-1',
        serviceAvailable: true,
        resolution: 'REGULAR',
      },
    });
    expect(repository.findPublishedCalendarCandidates).toHaveBeenCalledWith(
      'line-1',
      new Date('2026-08-28T00:00:00.000Z'),
    );
  });
});
