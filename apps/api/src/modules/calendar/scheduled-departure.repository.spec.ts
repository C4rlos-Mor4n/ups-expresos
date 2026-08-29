import { Direction, ScheduledDepartureSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ScheduledDepartureRepository } from './scheduled-departure.repository';
import { ScheduledDepartureWriteInput } from './scheduled-departure-materializer.types';

const write: ScheduledDepartureWriteInput = {
  sourceScheduleTimeId: '33333333-3333-4333-8333-333333333333',
  serviceCalendarId: '22222222-2222-4222-8222-222222222222',
  serviceLineId: '11111111-1111-4111-8111-111111111111',
  serviceDate: '2026-09-01',
  scheduledTime: '06:40:00',
  scheduledTimeValue: new Date('1970-01-01T06:40:00.000Z'),
  direction: Direction.IDA,
  source: ScheduledDepartureSource.REGULAR,
  sourceExceptionId: null,
};

const row = {
  id: '77777777-7777-4777-8777-777777777777',
  sourceScheduleTimeId: write.sourceScheduleTimeId,
  serviceCalendarId: write.serviceCalendarId,
  serviceLineId: write.serviceLineId,
  serviceDate: new Date('2026-09-01T00:00:00.000Z'),
  scheduledTime: write.scheduledTimeValue,
  direction: write.direction,
  source: write.source,
  sourceExceptionId: write.sourceExceptionId,
};

describe('ScheduledDepartureRepository', () => {
  it('uses one transaction, bulk insert and two batch reads for a date', async () => {
    const tx = {
      scheduledDeparture: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([row]),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const repository = new ScheduledDepartureRepository(prisma as unknown as PrismaService);

    const result = await repository.materializeDate([write]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.scheduledDeparture.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          serviceDate: new Date('2026-09-01T00:00:00.000Z'),
          scheduledTime: write.scheduledTimeValue,
        }),
      ],
      skipDuplicates: true,
    });
    expect(tx.scheduledDeparture.findMany).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ createdCount: 1, expectedRows: [{ scheduledTime: '06:40:00' }] });
  });

  it('reads NO_SERVICE scope without creating rows', async () => {
    const prisma = {
      scheduledDeparture: { findMany: jest.fn().mockResolvedValue([row]) },
    };
    const repository = new ScheduledDepartureRepository(prisma as unknown as PrismaService);

    const result = await repository.findScopeByInput({
      serviceLineId: write.serviceLineId,
      serviceDate: write.serviceDate,
      direction: write.direction,
    });

    expect(result).toMatchObject([{ sourceScheduleTimeId: write.sourceScheduleTimeId }]);
    expect(prisma.scheduledDeparture.findMany).toHaveBeenCalledTimes(1);
  });
});
