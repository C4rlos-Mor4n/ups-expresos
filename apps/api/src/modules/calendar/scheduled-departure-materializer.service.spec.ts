import { Direction, ScheduledDepartureSource } from "@prisma/client";
import { Logger } from "@nestjs/common";
import {
  MaterializerInfrastructureError,
  MaterializerInputError,
} from "./scheduled-departure-materializer.errors";
import { ScheduledDepartureMaterializerService } from "./scheduled-departure-materializer.service";
import {
  ExistingScheduledDeparture,
  ScheduledDepartureWriteInput,
} from "./scheduled-departure-materializer.types";
import { ResolvedSchedule } from "./calendar.types";

const ids = {
  line: "11111111-1111-4111-8111-111111111111",
  calendar: "22222222-2222-4222-8222-222222222222",
  timeA: "33333333-3333-4333-8333-333333333333",
  timeB: "44444444-4444-4444-8444-444444444444",
  stale: "55555555-5555-4555-8555-555555555555",
  exception: "66666666-6666-4666-8666-666666666666",
};

const makeSchedule = (
  serviceDate: string,
  overrides: Partial<ResolvedSchedule> = {},
): ResolvedSchedule => ({
  serviceLineId: ids.line,
  serviceCalendarId: ids.calendar,
  direction: Direction.IDA,
  serviceDate,
  timezone: "America/Guayaquil",
  serviceAvailable: true,
  resolution: "REGULAR",
  timetableCompleteness: "COMPLETE",
  departures: [
    {
      patternId: "pattern-a",
      scheduleTimeId: ids.timeA,
      departureTime: "06:40:00",
      approximateArrivalTime: null,
      source: "REGULAR",
      journeys: [],
    },
  ],
  warnings: [],
  ...overrides,
});

const toExisting = (
  write: ScheduledDepartureWriteInput,
  id = "77777777-7777-4777-8777-777777777777",
): ExistingScheduledDeparture => ({
  id,
  sourceScheduleTimeId: write.sourceScheduleTimeId,
  serviceCalendarId: write.serviceCalendarId,
  serviceLineId: write.serviceLineId,
  serviceDate: write.serviceDate,
  scheduledTime: write.scheduledTime,
  direction: write.direction,
  source: write.source,
  sourceExceptionId: write.sourceExceptionId,
});

describe("ScheduledDepartureMaterializerService", () => {
  const loggerLog = jest.spyOn(Logger.prototype, "log").mockImplementation();
  const loggerWarn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  const loggerError = jest
    .spyOn(Logger.prototype, "error")
    .mockImplementation();
  const resolver = { resolveSchedule: jest.fn() };
  const repository = {
    materializeDate: jest.fn(),
    findScopeByInput: jest.fn(),
  };
  const service = new ScheduledDepartureMaterializerService(
    resolver,
    repository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("rejects invalid input before consulting the resolver", async () => {
    await expect(
      service.materialize({
        serviceLineId: "not-a-uuid",
        direction: Direction.IDA,
        fromDate: "2026-09-01",
      }),
    ).rejects.toBeInstanceOf(MaterializerInputError);
    expect(resolver.resolveSchedule).not.toHaveBeenCalled();
  });

  it("continues a range after a resolver domain failure", async () => {
    resolver.resolveSchedule
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "NO_PUBLISHED_CALENDAR", message: "missing" },
      })
      .mockResolvedValueOnce({ ok: true, value: makeSchedule("2026-09-02") });
    repository.materializeDate.mockImplementation(
      async (writes: ScheduledDepartureWriteInput[]) => ({
        createdCount: 1,
        expectedRows: writes.map((write) => toExisting(write)),
        scopeRows: writes.map((write) => toExisting(write)),
      }),
    );

    const result = await service.materialize({
      serviceLineId: ids.line,
      direction: Direction.IDA,
      fromDate: "2026-09-01",
      toDate: "2026-09-02",
    });

    expect(result).toMatchObject({
      totalDates: 2,
      processedDates: 1,
      errors: 1,
      created: 1,
    });
    expect(result.dates.map((date) => date.outcome)).toEqual([
      "RESOLUTION_FAILED",
      "MATERIALIZED",
    ]);
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining("ScheduledDeparture materialization started"),
    );
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining("ScheduledDeparture materialization completed"),
    );
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("ScheduledDeparture resolution failed"),
    );
  });

  it("does not write NO_SERVICE and reports existing rows for reconciliation", async () => {
    resolver.resolveSchedule.mockResolvedValue({
      ok: true,
      value: makeSchedule("2026-09-01", {
        serviceAvailable: false,
        resolution: "NO_SERVICE",
        departures: [],
      }),
    });
    repository.findScopeByInput.mockResolvedValue([
      {
        id: "stale-row",
        sourceScheduleTimeId: ids.stale,
        serviceCalendarId: ids.calendar,
        serviceLineId: ids.line,
        serviceDate: "2026-09-01",
        scheduledTime: "09:00:00",
        direction: Direction.IDA,
        source: ScheduledDepartureSource.REGULAR,
        sourceExceptionId: null,
      },
    ]);

    const result = await service.materialize({ ...baseInput() });

    expect(repository.materializeDate).not.toHaveBeenCalled();
    expect(result.dates[0]).toMatchObject({
      outcome: "RECONCILIATION_REQUIRED",
      serviceAvailable: false,
      missingFromCurrentResolution: [{ sourceScheduleTimeId: ids.stale }],
    });
  });

  it("reports same, different and missing snapshots in deterministic order without mutation", async () => {
    resolver.resolveSchedule.mockResolvedValue({
      ok: true,
      value: makeSchedule("2026-09-01", {
        departures: [
          {
            ...makeSchedule("2026-09-01").departures[0]!,
            departureTime: "08:00:00",
          },
          {
            ...makeSchedule("2026-09-01").departures[0]!,
            scheduleTimeId: ids.timeB,
            departureTime: "06:40:00",
          },
        ],
      }),
    });
    repository.materializeDate.mockImplementation(
      async (writes: ScheduledDepartureWriteInput[]) => {
        const first = writes[0]!;
        const second = writes[1]!;
        return {
          createdCount: 0,
          expectedRows: [
            toExisting(first),
            {
              ...toExisting(second, "different-row"),
              scheduledTime: "07:00:00",
            },
          ],
          scopeRows: [
            toExisting(first),
            {
              ...toExisting(second, "different-row"),
              scheduledTime: "07:00:00",
            },
            {
              ...toExisting(first, "stale-row"),
              sourceScheduleTimeId: ids.stale,
              scheduledTime: "05:00:00",
            },
          ],
        };
      },
    );

    const result = await service.materialize(baseInput());
    const date = result.dates[0]!;

    expect(date.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(date.existingSameCount).toBe(1);
    expect(date.existingDifferent).toMatchObject([
      { sourceScheduleTimeId: ids.timeA },
    ]);
    expect(
      date.missingFromCurrentResolution.map((row) => row.sourceScheduleTimeId),
    ).toEqual([ids.stale]);
  });

  it("preserves nominal collisions and reports idempotent repeated materialization", async () => {
    resolver.resolveSchedule.mockResolvedValue({
      ok: true,
      value: makeSchedule("2026-09-01", {
        departures: [
          makeSchedule("2026-09-01").departures[0]!,
          {
            ...makeSchedule("2026-09-01").departures[0]!,
            scheduleTimeId: ids.timeB,
            departureTime: "06:40:00",
          },
        ],
      }),
    });
    repository.materializeDate
      .mockImplementationOnce(
        async (writes: ScheduledDepartureWriteInput[]) => ({
          createdCount: 2,
          expectedRows: writes.map((write) => toExisting(write)),
          scopeRows: writes.map((write) => toExisting(write)),
        }),
      )
      .mockImplementationOnce(
        async (writes: ScheduledDepartureWriteInput[]) => ({
          createdCount: 0,
          expectedRows: writes.map((write) => toExisting(write)),
          scopeRows: writes.map((write) => toExisting(write)),
        }),
      );

    const first = await service.materialize(baseInput());
    const second = await service.materialize(baseInput());

    expect(repository.materializeDate.mock.calls[0]?.[0]).toHaveLength(2);
    expect(first).toMatchObject({ created: 2, existingSame: 0 });
    expect(second).toMatchObject({ created: 0, existingSame: 2 });
  });

  it("propagates repository failures as infrastructure failures", async () => {
    resolver.resolveSchedule.mockResolvedValue({
      ok: true,
      value: makeSchedule("2026-09-01"),
    });
    const databaseError = new Error("database unavailable");
    repository.materializeDate.mockRejectedValue(databaseError);

    await expect(service.materialize(baseInput())).rejects.toMatchObject({
      name: "MaterializerInfrastructureError",
      cause: databaseError,
    } as MaterializerInfrastructureError);
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("ScheduledDeparture infrastructure failure"),
    );
  });

  it("propagates unexpected resolver failures without consulting persistence", async () => {
    const resolverError = new Error("resolver database unavailable");
    resolver.resolveSchedule.mockRejectedValue(resolverError);

    await expect(service.materialize(baseInput())).rejects.toMatchObject({
      name: "MaterializerInfrastructureError",
      cause: resolverError,
    } as MaterializerInfrastructureError);
    expect(repository.materializeDate).not.toHaveBeenCalled();
    expect(repository.findScopeByInput).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("operation=calendar-resolver"),
    );
  });
});

const baseInput = () => ({
  serviceLineId: ids.line,
  direction: Direction.IDA,
  fromDate: "2026-09-01",
});
