import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MaterializerInvariantError } from './scheduled-departure-materializer.errors';
import {
  ExistingScheduledDeparture,
  ScheduledDeparturePersistenceResult,
  ScheduledDepartureWriteInput,
} from './scheduled-departure-materializer.types';

const scheduledDepartureSelect = {
  id: true,
  sourceScheduleTimeId: true,
  serviceCalendarId: true,
  serviceLineId: true,
  serviceDate: true,
  scheduledTime: true,
  direction: true,
  source: true,
  sourceExceptionId: true,
} satisfies Prisma.ScheduledDepartureSelect;

type ScheduledDepartureRow = Prisma.ScheduledDepartureGetPayload<{
  select: typeof scheduledDepartureSelect;
}>;

type ScheduledDepartureDelegate = Pick<
  PrismaService['scheduledDeparture'],
  'createMany' | 'findMany'
>;

export interface ScheduledDepartureTransactionPort {
  scheduledDeparture: ScheduledDepartureDelegate;
}

export interface ScheduledDeparturePrismaPort {
  $transaction<T>(
    callback: (transaction: ScheduledDepartureTransactionPort) => Promise<T>,
  ): Promise<T>;
  scheduledDeparture: Pick<PrismaService['scheduledDeparture'], 'findMany'>;
}

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const toTime = (value: Date): string => value.toISOString().slice(11, 19);

const mapRow = (row: ScheduledDepartureRow): ExistingScheduledDeparture => ({
  id: row.id,
  sourceScheduleTimeId: row.sourceScheduleTimeId,
  serviceCalendarId: row.serviceCalendarId,
  serviceLineId: row.serviceLineId,
  serviceDate: toIsoDate(row.serviceDate),
  scheduledTime: toTime(row.scheduledTime),
  direction: row.direction,
  source: row.source,
  sourceExceptionId: row.sourceExceptionId,
});

const scopeWhere = (input: ScheduledDepartureWriteInput) => ({
  serviceLineId: input.serviceLineId,
  serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
  direction: input.direction,
});

const assertSingleScope = (writes: ScheduledDepartureWriteInput[]): ScheduledDepartureWriteInput => {
  const first = writes[0];
  if (!first) {
    throw new MaterializerInvariantError('ScheduledDepartureRepository requires at least one write');
  }

  const sourceScheduleTimeIds = new Set<string>();
  for (const write of writes) {
    if (
      write.serviceLineId !== first.serviceLineId ||
      write.serviceDate !== first.serviceDate ||
      write.direction !== first.direction
    ) {
      throw new MaterializerInvariantError('ScheduledDepartureRepository received writes from multiple scopes');
    }
    if (sourceScheduleTimeIds.has(write.sourceScheduleTimeId)) {
      throw new MaterializerInvariantError('ScheduledDepartureRepository received duplicate natural identities');
    }
    sourceScheduleTimeIds.add(write.sourceScheduleTimeId);
  }

  return first;
};

@Injectable()
export class ScheduledDepartureRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: ScheduledDeparturePrismaPort,
  ) {}

  async materializeDate(
    writes: ScheduledDepartureWriteInput[],
  ): Promise<ScheduledDeparturePersistenceResult> {
    const first = assertSingleScope(writes);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scheduledDeparture.createMany({
        data: writes.map(({ serviceDate, scheduledTimeValue, ...write }) => ({
          ...write,
          serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
          scheduledTime: scheduledTimeValue,
        })),
        skipDuplicates: true,
      });
      const expectedRows = await tx.scheduledDeparture.findMany({
        where: {
          serviceDate: new Date(`${first.serviceDate}T00:00:00.000Z`),
          sourceScheduleTimeId: { in: writes.map((write) => write.sourceScheduleTimeId) },
        },
        select: scheduledDepartureSelect,
      });
      const scopeRows = await tx.scheduledDeparture.findMany({
        where: scopeWhere(first),
        select: scheduledDepartureSelect,
      });

      return {
        createdCount: created.count,
        expectedRows: expectedRows.map(mapRow),
        scopeRows: scopeRows.map(mapRow),
      };
    });
  }

  async findScopeByInput(input: {
    serviceLineId: string;
    serviceDate: string;
    direction: ScheduledDepartureWriteInput['direction'];
  }): Promise<ExistingScheduledDeparture[]> {
    const rows = await this.prisma.scheduledDeparture.findMany({
      where: {
        serviceLineId: input.serviceLineId,
        serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
        direction: input.direction,
      },
      select: scheduledDepartureSelect,
    });
    return rows.map(mapRow);
  }
}
