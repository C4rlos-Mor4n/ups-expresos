import 'dotenv/config';

import { Direction } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { CalendarRepository } from '../src/modules/calendar/calendar.repository';
import { CalendarResolverService } from '../src/modules/calendar/calendar-resolver.service';
import { ScheduledDepartureMaterializerService } from '../src/modules/calendar/scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from '../src/modules/calendar/scheduled-departure.repository';
import { MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS } from '../src/modules/calendar/scheduled-departure-materializer.types';

/**
 * Genera las salidas programadas de todas las líneas activas para un rango de fechas.
 * NO destructivo: solo crea las que faltan; las existentes (y sus asignaciones y
 * recorridos) se conservan. Úsalo para extender la ventana de salidas.
 *
 *   node dist/scripts/materialize-departures.js                 # hoy + 30 días
 *   node dist/scripts/materialize-departures.js --from=2026-11-01 --to=2026-12-15
 */

const DEFAULT_WINDOW_DAYS = 30;

const guayaquilDate = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'America/Guayaquil',
  });

const shiftDate = (value: string, days: number): string => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Parte el rango en tramos que respetan el máximo del materializador. */
export const chunkRange = (fromDate: string, toDate: string): Array<[string, string]> => {
  const chunks: Array<[string, string]> = [];
  let start = fromDate;
  while (start <= toDate) {
    const end = shiftDate(start, MAX_SCHEDULED_DEPARTURE_MATERIALIZATION_DAYS - 1);
    chunks.push([start, end < toDate ? end : toDate]);
    start = shiftDate(end, 1);
  }
  return chunks;
};

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const main = async (): Promise<void> => {
  const fromDate = argumentValue('from') ?? guayaquilDate(0);
  const toDate = argumentValue('to') ?? guayaquilDate(DEFAULT_WINDOW_DAYS);
  const prisma = new PrismaService();
  try {
    const materializer = new ScheduledDepartureMaterializerService(
      new CalendarResolverService(new CalendarRepository(prisma)),
      new ScheduledDepartureRepository(prisma),
    );
    const lines = await prisma.serviceLine.findMany({
      where: { isActive: true, campus: { isActive: true } },
      select: { id: true, code: true },
    });

    const totals = { created: 0, existing: 0, needsReview: 0, errors: 0 };
    for (const line of lines) {
      for (const direction of [Direction.IDA, Direction.RETORNO]) {
        for (const [from, to] of chunkRange(fromDate, toDate)) {
          const result = await materializer.materialize({
            serviceLineId: line.id,
            direction,
            fromDate: from,
            toDate: to,
          });
          totals.created += result.created;
          totals.existing += result.existingSame;
          totals.needsReview += result.existingDifferent + result.missingFromCurrentResolution;
          totals.errors += result.errors;
        }
      }
    }
    console.log(JSON.stringify({ fromDate, toDate, lines: lines.length, ...totals }, null, 2));
    if (totals.errors > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
