import { Inject, Injectable, Logger } from "@nestjs/common";
import { CalendarResolverService } from "./calendar-resolver.service";
import {
  MaterializerInfrastructureError,
  MaterializerInvariantError,
} from "./scheduled-departure-materializer.errors";
import {
  compareScheduledDepartureSnapshots,
  enumerateMaterializationDates,
  prepareScheduledDepartureWrites,
  sortExistingRows,
  validateMaterializationInput,
} from "./scheduled-departure-materializer.functions";
import { ScheduledDepartureRepository } from "./scheduled-departure.repository";
import {
  ExistingDifference,
  ExistingScheduledDeparture,
  MaterializationDateResult,
  MaterializationRangeResult,
  MaterializeScheduledDeparturesInput,
  MaterializerValidatedInput,
  ScheduledDepartureWriteInput,
} from "./scheduled-departure-materializer.types";

type CalendarResolutionPort = Pick<CalendarResolverService, "resolveSchedule">;
type ScheduledDeparturePersistencePort = Pick<
  ScheduledDepartureRepository,
  "findScopeByInput" | "materializeDate"
>;

@Injectable()
export class ScheduledDepartureMaterializerService {
  private readonly logger = new Logger(
    ScheduledDepartureMaterializerService.name,
  );

  constructor(
    @Inject(CalendarResolverService)
    private readonly calendarResolver: CalendarResolutionPort,
    @Inject(ScheduledDepartureRepository)
    private readonly scheduledDepartureRepository: ScheduledDeparturePersistencePort,
  ) {}

  async materialize(
    input: MaterializeScheduledDeparturesInput,
  ): Promise<MaterializationRangeResult> {
    const validated = validateMaterializationInput(input);
    const dates = enumerateMaterializationDates(validated);
    const results: MaterializationDateResult[] = [];

    this.logger.log(
      `ScheduledDeparture materialization started line=${validated.serviceLineId} direction=${validated.direction} from=${validated.fromDate} to=${validated.toDate} dates=${dates.length}`,
    );

    for (const serviceDate of dates) {
      const dateResult = await this.materializeDate(validated, serviceDate);
      results.push(dateResult);
      if (dateResult.outcome === "RECONCILIATION_REQUIRED") {
        this.logger.warn(
          `ScheduledDeparture reconciliation required line=${validated.serviceLineId} direction=${validated.direction} date=${serviceDate} different=${dateResult.existingDifferent.length} missing=${dateResult.missingFromCurrentResolution.length}`,
        );
      }
    }

    const summary = this.summarizeRange(validated, results);
    this.logger.log(
      `ScheduledDeparture materialization completed line=${validated.serviceLineId} direction=${validated.direction} from=${validated.fromDate} to=${validated.toDate} created=${summary.created} existingSame=${summary.existingSame} different=${summary.existingDifferent} missing=${summary.missingFromCurrentResolution} errors=${summary.errors}`,
    );
    return summary;
  }

  private async materializeDate(
    input: MaterializerValidatedInput,
    serviceDate: string,
  ): Promise<MaterializationDateResult> {
    let resolution;
    try {
      resolution = await this.calendarResolver.resolveSchedule({
        serviceLineId: input.serviceLineId,
        direction: input.direction,
        serviceDate,
      });
    } catch (error) {
      throw this.infrastructureFailure(
        "calendar-resolver",
        input,
        serviceDate,
        error,
      );
    }

    if (!resolution.ok) {
      this.logger.warn(
        `ScheduledDeparture resolution failed line=${input.serviceLineId} direction=${input.direction} date=${serviceDate} code=${resolution.error.code}`,
      );
      return {
        serviceDate,
        outcome: "RESOLUTION_FAILED",
        serviceAvailable: null,
        resolution: null,
        resolvedCount: 0,
        createdCount: 0,
        existingSameCount: 0,
        existingDifferent: [],
        missingFromCurrentResolution: [],
        warnings: [],
        error: resolution.error,
      };
    }

    const dateInput = { ...input, fromDate: serviceDate, toDate: serviceDate };
    const writes = prepareScheduledDepartureWrites(dateInput, resolution.value);
    if (!resolution.value.serviceAvailable) {
      return this.materializeNoServiceDate(
        input,
        serviceDate,
        resolution.value.warnings,
      );
    }

    return this.materializeAvailableDate(input, resolution.value, writes);
  }

  private async materializeNoServiceDate(
    input: MaterializerValidatedInput,
    serviceDate: string,
    warnings: MaterializationDateResult["warnings"],
  ): Promise<MaterializationDateResult> {
    let scopeRows: ExistingScheduledDeparture[];
    try {
      scopeRows = await this.scheduledDepartureRepository.findScopeByInput({
        serviceLineId: input.serviceLineId,
        serviceDate,
        direction: input.direction,
      });
    } catch (error) {
      throw this.infrastructureFailure("scope-read", input, serviceDate, error);
    }

    const missingFromCurrentResolution = sortExistingRows(scopeRows);
    return {
      serviceDate,
      outcome:
        missingFromCurrentResolution.length === 0
          ? "NO_SERVICE"
          : "RECONCILIATION_REQUIRED",
      serviceAvailable: false,
      resolution: "NO_SERVICE",
      resolvedCount: 0,
      createdCount: 0,
      existingSameCount: 0,
      existingDifferent: [],
      missingFromCurrentResolution,
      warnings,
    };
  }

  private async materializeAvailableDate(
    input: MaterializerValidatedInput,
    schedule: {
      serviceDate: string;
      resolution: MaterializationDateResult["resolution"];
      warnings: MaterializationDateResult["warnings"];
    },
    writes: ScheduledDepartureWriteInput[],
  ): Promise<MaterializationDateResult> {
    let persisted;
    try {
      persisted =
        await this.scheduledDepartureRepository.materializeDate(writes);
    } catch (error) {
      if (error instanceof MaterializerInvariantError) throw error;
      throw this.infrastructureFailure(
        "materialization-transaction",
        input,
        schedule.serviceDate,
        error,
      );
    }

    const expectedByIdentity = new Map(
      writes.map((write) => [write.sourceScheduleTimeId, write]),
    );
    const actualByIdentity = new Map(
      persisted.expectedRows.map((row) => [row.sourceScheduleTimeId, row]),
    );
    if (actualByIdentity.size !== expectedByIdentity.size) {
      throw new MaterializerInvariantError(
        "ScheduledDeparture identity read did not return every resolved departure",
      );
    }

    const existingDifferent: ExistingDifference[] = [];
    let semanticallySameCount = 0;
    for (const write of writes) {
      const existing = actualByIdentity.get(write.sourceScheduleTimeId);
      if (!existing) {
        throw new MaterializerInvariantError(
          "ScheduledDeparture identity disappeared after materialization",
        );
      }
      const difference = compareScheduledDepartureSnapshots(write, existing);
      if (difference) {
        existingDifferent.push(difference);
      } else {
        semanticallySameCount += 1;
      }
    }

    if (persisted.createdCount > semanticallySameCount) {
      throw new MaterializerInvariantError(
        "ScheduledDeparture write count exceeds matching snapshots",
      );
    }

    const expectedIds = new Set(
      writes.map((write) => write.sourceScheduleTimeId),
    );
    const missingFromCurrentResolution = sortExistingRows(
      persisted.scopeRows.filter(
        (row) => !expectedIds.has(row.sourceScheduleTimeId),
      ),
    );
    const sortedDifferences = [...existingDifferent].sort((left, right) => {
      const timeOrder = left.existing.scheduledTime.localeCompare(
        right.existing.scheduledTime,
      );
      if (timeOrder !== 0) return timeOrder;
      return left.sourceScheduleTimeId.localeCompare(
        right.sourceScheduleTimeId,
      );
    });

    return {
      serviceDate: schedule.serviceDate,
      outcome:
        sortedDifferences.length > 0 || missingFromCurrentResolution.length > 0
          ? "RECONCILIATION_REQUIRED"
          : "MATERIALIZED",
      serviceAvailable: true,
      resolution: schedule.resolution,
      resolvedCount: writes.length,
      createdCount: persisted.createdCount,
      existingSameCount: semanticallySameCount - persisted.createdCount,
      existingDifferent: sortedDifferences,
      missingFromCurrentResolution,
      warnings: schedule.warnings,
    };
  }

  private summarizeRange(
    input: MaterializerValidatedInput,
    dates: MaterializationDateResult[],
  ): MaterializationRangeResult {
    return {
      serviceLineId: input.serviceLineId,
      direction: input.direction,
      fromDate: input.fromDate,
      toDate: input.toDate,
      totalDates: dates.length,
      processedDates:
        dates.length -
        dates.filter((date) => date.outcome === "RESOLUTION_FAILED").length,
      noServiceDates: dates.filter((date) => date.serviceAvailable === false)
        .length,
      created: dates.reduce((total, date) => total + date.createdCount, 0),
      existingSame: dates.reduce(
        (total, date) => total + date.existingSameCount,
        0,
      ),
      existingDifferent: dates.reduce(
        (total, date) => total + date.existingDifferent.length,
        0,
      ),
      missingFromCurrentResolution: dates.reduce(
        (total, date) => total + date.missingFromCurrentResolution.length,
        0,
      ),
      errors: dates.filter((date) => date.outcome === "RESOLUTION_FAILED")
        .length,
      dates,
    };
  }

  private infrastructureFailure(
    operation: string,
    input: MaterializerValidatedInput,
    serviceDate: string,
    cause: unknown,
  ): MaterializerInfrastructureError {
    this.logger.error(
      `ScheduledDeparture infrastructure failure operation=${operation} line=${input.serviceLineId} direction=${input.direction} date=${serviceDate}`,
    );
    return new MaterializerInfrastructureError(
      `ScheduledDeparture ${operation} failed`,
      cause,
    );
  }
}
