import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  ServiceLineType,
  Weekday,
} from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { CalendarRepository } from '../src/modules/calendar/calendar.repository';
import { CalendarResolverService } from '../src/modules/calendar/calendar-resolver.service';
import { ScheduledDepartureMaterializerService } from '../src/modules/calendar/scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from '../src/modules/calendar/scheduled-departure.repository';

const DATABASE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_FROM_DATE = '2026-09-05';
const DEFAULT_TO_DATE = '2026-09-12';
const REFERENCE_PATH = resolve(
  __dirname,
  '../../../docs/ups_go_routes_reference_guayaquil.json',
);

interface ReferenceCampus {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

interface ReferenceStop {
  id: string;
  name: string;
  coordinateBasis?: string;
  latitude: number;
  longitude: number;
}

interface ReferenceLine {
  code: string;
  name: string;
  campusScope: string;
  typeCandidate: 'CAMPUS_ROUTE' | 'INTERCAMPUS';
}

interface ReferencePath {
  code: string;
  lineCode: string;
  direction: Direction;
  displayName: string;
  note?: string;
  stopIds: string[];
}

interface ReferenceTrip {
  departureTime: string;
  arrivalTime: string;
  stopTimes: Array<{ stopId: string; time: string }>;
}

interface ReferenceService {
  code: string;
  lineCode: string;
  direction: Direction;
  routePathCode: string;
  operatingDays: Weekday[];
  trips: ReferenceTrip[];
}

interface ReferenceDataset {
  timezone: string;
  campuses: ReferenceCampus[];
  stops: ReferenceStop[];
  serviceLines: ReferenceLine[];
  routePaths: ReferencePath[];
  services: ReferenceService[];
}

export interface ReferenceSeedOptions {
  fromDate: string;
  toDate: string;
}

export interface ReferenceSeedResult {
  campuses: number;
  serviceLines: number;
  servedCampuses: number;
  stops: number;
  routePaths: number;
  calendars: number;
  schedulePatterns: number;
  scheduledDepartures: number;
  departuresByDate: Record<string, number>;
}

interface PatternGroup {
  suffix: 'WEEKDAY' | 'SATURDAY';
  days: Weekday[];
}

const PATTERN_GROUPS: PatternGroup[] = [
  {
    suffix: 'WEEKDAY',
    days: [
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
    ],
  },
  { suffix: 'SATURDAY', days: [Weekday.SATURDAY] },
];

const parseDataset = (): ReferenceDataset => {
  const dataset = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')) as ReferenceDataset;
  if (dataset.timezone !== 'America/Guayaquil') {
    throw new Error(`Unexpected reference timezone: ${dataset.timezone}`);
  }
  if (
    dataset.campuses.length !== 2 ||
    dataset.serviceLines.length !== 3 ||
    dataset.stops.length !== 14 ||
    dataset.routePaths.length !== 7
  ) {
    throw new Error('Reference dataset cardinality does not match the approved fixture');
  }
  return dataset;
};

const databaseDate = (value: string): Date => {
  if (!DATABASE_DATE.test(value)) throw new Error(`Invalid database date: ${value}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid database date: ${value}`);
  }
  return parsed;
};

const databaseTime = (value: string): Date => {
  if (!CLOCK_TIME.test(value)) throw new Error(`Invalid clock time: ${value}`);
  return new Date(`1970-01-01T${value}:00.000Z`);
};

const minutesSinceMidnight = (value: string): number => {
  if (!CLOCK_TIME.test(value)) throw new Error(`Invalid clock time: ${value}`);
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const offsetMinutes = (departureTime: string, stopTime: string): number => {
  const departure = minutesSinceMidnight(departureTime);
  const stop = minutesSinceMidnight(stopTime);
  return stop >= departure ? stop - departure : stop + 24 * 60 - departure;
};

const clearCalendarHierarchy = async (
  prisma: PrismaService,
  serviceLineIds: string[],
): Promise<void> => {
  if (serviceLineIds.length === 0) return;
  const departureWhere = { serviceLineId: { in: serviceLineIds } };
  const calendarWhere = { serviceLineId: { in: serviceLineIds } };

  await prisma.$transaction(async (tx) => {
    await tx.serviceRun.deleteMany({
      where: { serviceAssignment: { scheduledDeparture: departureWhere } },
    });
    await tx.serviceAssignment.deleteMany({
      where: { scheduledDeparture: departureWhere },
    });
    await tx.scheduledDeparture.deleteMany({ where: departureWhere });
    await tx.scheduledStopTime.deleteMany({
      where: { journeyTemplate: { scheduleTime: { pattern: { serviceCalendar: calendarWhere } } } },
    });
    await tx.scheduleJourneyTemplate.deleteMany({
      where: { scheduleTime: { pattern: { serviceCalendar: calendarWhere } } },
    });
    await tx.scheduleTime.deleteMany({
      where: { pattern: { serviceCalendar: calendarWhere } },
    });
    await tx.schedulePatternDay.deleteMany({
      where: { pattern: { serviceCalendar: calendarWhere } },
    });
    await tx.schedulePattern.deleteMany({
      where: { serviceCalendar: calendarWhere },
    });
    await tx.serviceException.deleteMany({
      where: { serviceCalendar: calendarWhere },
    });
    await tx.serviceCalendar.deleteMany({ where: calendarWhere });
  });
};

export const seedReferenceDataset = async (
  prisma: PrismaService,
  options: ReferenceSeedOptions,
): Promise<ReferenceSeedResult> => {
  const fromDate = databaseDate(options.fromDate);
  const toDate = databaseDate(options.toDate);
  if (fromDate > toDate) throw new Error('fromDate must not be after toDate');

  const dataset = parseDataset();
  const campusIds = new Map<string, string>();
  for (const campus of dataset.campuses) {
    const row = await prisma.campus.upsert({
      where: { code: campus.id },
      update: {
        name: campus.name,
        address: campus.address ?? null,
        latitude: campus.latitude,
        longitude: campus.longitude,
        isActive: true,
      },
      create: {
        code: campus.id,
        name: campus.name,
        address: campus.address ?? null,
        latitude: campus.latitude,
        longitude: campus.longitude,
        isActive: true,
      },
      select: { id: true },
    });
    campusIds.set(campus.id, row.id);
  }

  const stopIds = new Map<string, string>();
  for (const stop of dataset.stops) {
    const existing = await prisma.stop.findFirst({ where: { name: stop.name }, select: { id: true } });
    const row = existing
      ? await prisma.stop.update({
          where: { id: existing.id },
          data: {
            reference: stop.coordinateBasis ?? null,
            latitude: stop.latitude,
            longitude: stop.longitude,
            isActive: true,
          },
          select: { id: true },
        })
      : await prisma.stop.create({
          data: {
            name: stop.name,
            reference: stop.coordinateBasis ?? null,
            latitude: stop.latitude,
            longitude: stop.longitude,
            isActive: true,
          },
          select: { id: true },
        });
    stopIds.set(stop.id, row.id);
  }

  const lineIds = new Map<string, string>();
  const mariaAuxiliadoraId = campusIds.get('UPS_MARIA_AUXILIADORA');
  const centenarioId = campusIds.get('UPS_CENTENARIO');
  if (!mariaAuxiliadoraId || !centenarioId) throw new Error('Required campuses were not seeded');

  for (const line of dataset.serviceLines) {
    const campusId = campusIds.get(line.campusScope);
    if (!campusId) throw new Error(`Unknown campus scope for ${line.code}`);
    const existing = await prisma.serviceLine.findFirst({ where: { code: line.code }, select: { id: true } });
    const data = {
      campusId,
      code: line.code,
      name: line.name,
      type:
        line.typeCandidate === 'INTERCAMPUS'
          ? ServiceLineType.INTERCAMPUS
          : ServiceLineType.CAMPUS_ROUTE,
      destinationCampusId: line.code === 'SUR' ? centenarioId : null,
      isActive: true,
    };
    const row = existing
      ? await prisma.serviceLine.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.serviceLine.create({ data, select: { id: true } });
    lineIds.set(line.code, row.id);
  }

  await clearCalendarHierarchy(prisma, [...lineIds.values()]);

  await prisma.serviceLineCampus.deleteMany({
    where: { serviceLineId: { in: [...lineIds.values()] } },
  });
  await prisma.serviceLineCampus.createMany({
    data: [
      { serviceLineId: lineIds.get('NORTE')!, campusId: mariaAuxiliadoraId },
      { serviceLineId: lineIds.get('SUR')!, campusId: mariaAuxiliadoraId },
      { serviceLineId: lineIds.get('SUR')!, campusId: centenarioId },
      { serviceLineId: lineIds.get('URB_LA_JOYA')!, campusId: mariaAuxiliadoraId },
    ],
  });

  const canonicalPathCodes = dataset.routePaths.map((path) => path.code);
  await prisma.routePathStop.deleteMany({
    where: {
      routePath: {
        serviceLineId: { in: [...lineIds.values()] },
        code: { notIn: canonicalPathCodes },
      },
    },
  });
  await prisma.routePath.deleteMany({
    where: {
      serviceLineId: { in: [...lineIds.values()] },
      code: { notIn: canonicalPathCodes },
    },
  });

  const pathIds = new Map<string, string>();
  for (const path of dataset.routePaths) {
    const serviceLineId = lineIds.get(path.lineCode);
    if (!serviceLineId) throw new Error(`Unknown line for path ${path.code}`);
    const routePath = await prisma.routePath.upsert({
      where: { serviceLineId_code: { serviceLineId, code: path.code } },
      update: {
        displayName: path.displayName,
        description: path.note ?? null,
        direction: path.direction,
        isActive: true,
      },
      create: {
        serviceLineId,
        code: path.code,
        displayName: path.displayName,
        description: path.note ?? null,
        direction: path.direction,
        isActive: true,
      },
      select: { id: true },
    });
    pathIds.set(path.code, routePath.id);
    await prisma.routePathStop.deleteMany({ where: { routePathId: routePath.id } });
    await prisma.routePathStop.createMany({
      data: path.stopIds.map((referenceStopId, index) => {
        const stopId = stopIds.get(referenceStopId);
        if (!stopId) throw new Error(`Unknown stop ${referenceStopId} in ${path.code}`);
        return { routePathId: routePath.id, stopId, stopOrder: index + 1 };
      }),
    });
  }

  let calendarCount = 0;
  let patternCount = 0;
  for (const line of dataset.serviceLines) {
    const serviceLineId = lineIds.get(line.code);
    if (!serviceLineId) throw new Error(`Missing line ${line.code}`);
    const calendar = await prisma.serviceCalendar.create({
      data: {
        serviceLineId,
        name: `${line.name} - QA showcase 2026`,
        validFrom: fromDate,
        validUntil: databaseDate('2026-12-31'),
        timezone: dataset.timezone,
        status: SchedulePublicationStatus.PUBLISHED,
      },
      select: { id: true },
    });
    calendarCount += 1;

    for (const direction of [Direction.IDA, Direction.RETORNO]) {
      for (const group of PATTERN_GROUPS) {
        const services = dataset.services.filter(
          (service) =>
            service.lineCode === line.code &&
            service.direction === direction &&
            service.operatingDays.some((day) => group.days.includes(day)),
        );
        if (services.length === 0) {
          throw new Error(`Missing ${group.suffix} ${direction} schedule for ${line.code}`);
        }
        const pattern = await prisma.schedulePattern.create({
          data: {
            serviceCalendarId: calendar.id,
            direction,
            type: SchedulePatternType.EXPLICIT_TIMES,
            status: SchedulePublicationStatus.PUBLISHED,
            name: `${line.code}_${direction}_${group.suffix}`,
            days: { create: group.days.map((weekday) => ({ weekday })) },
          },
          select: { id: true },
        });
        patternCount += 1;

        const tripsByDeparture = new Map<
          string,
          Array<{ serviceCode: string; routePathCode: string; trip: ReferenceTrip }>
        >();
        for (const service of services) {
          for (const trip of service.trips) {
            const candidates = tripsByDeparture.get(trip.departureTime) ?? [];
            candidates.push({ serviceCode: service.code, routePathCode: service.routePathCode, trip });
            tripsByDeparture.set(trip.departureTime, candidates);
          }
        }

        for (const [departureTime, candidates] of [...tripsByDeparture].sort(([a], [b]) => a.localeCompare(b))) {
          const scheduleTime = await prisma.scheduleTime.create({
            data: {
              schedulePatternId: pattern.id,
              departureTime: databaseTime(departureTime),
              approximateArrivalTime: databaseTime(candidates[0]!.trip.arrivalTime),
            },
            select: { id: true },
          });
          const candidatesByPath = new Map<string, typeof candidates[number]>();
          for (const candidate of candidates) {
            const previous = candidatesByPath.get(candidate.routePathCode);
            if (previous && JSON.stringify(previous.trip) !== JSON.stringify(candidate.trip)) {
              throw new Error(
                `Conflicting ${line.code} ${direction} ${departureTime} definitions: ${previous.serviceCode} and ${candidate.serviceCode}`,
              );
            }
            candidatesByPath.set(candidate.routePathCode, candidate);
          }
          for (const candidate of candidatesByPath.values()) {
            const routePathId = pathIds.get(candidate.routePathCode);
            if (!routePathId) throw new Error(`Unknown route path ${candidate.routePathCode}`);
            const routePathStops = await prisma.routePathStop.findMany({
              where: { routePathId },
              select: { id: true, stopId: true, stopOrder: true },
              orderBy: { stopOrder: 'asc' },
            });
            const referencePath = dataset.routePaths.find((path) => path.code === candidate.routePathCode);
            if (!referencePath || referencePath.stopIds.length !== routePathStops.length) {
              throw new Error(`Invalid stop mapping for ${candidate.routePathCode}`);
            }
            const journey = await prisma.scheduleJourneyTemplate.create({
              data: { scheduleTimeId: scheduleTime.id, routePathId },
              select: { id: true },
            });
            await prisma.scheduledStopTime.createMany({
              data: candidate.trip.stopTimes.map((stopTime) => {
                const referenceIndex = referencePath.stopIds.indexOf(stopTime.stopId);
                const routePathStop = routePathStops[referenceIndex];
                if (referenceIndex < 0 || !routePathStop) {
                  throw new Error(`Stop ${stopTime.stopId} is outside ${candidate.routePathCode}`);
                }
                return {
                  journeyTemplateId: journey.id,
                  routePathStopId: routePathStop.id,
                  offsetMinutes: offsetMinutes(departureTime, stopTime.time),
                };
              }),
            });
          }
        }
      }
    }
  }

  const calendarRepository = new CalendarRepository(prisma);
  const resolver = new CalendarResolverService(calendarRepository);
  const departureRepository = new ScheduledDepartureRepository(prisma);
  const materializer = new ScheduledDepartureMaterializerService(resolver, departureRepository);
  for (const serviceLineId of lineIds.values()) {
    for (const direction of [Direction.IDA, Direction.RETORNO]) {
      const result = await materializer.materialize({
        serviceLineId,
        direction,
        fromDate: options.fromDate,
        toDate: options.toDate,
      });
      if (result.errors > 0 || result.existingDifferent > 0 || result.missingFromCurrentResolution > 0) {
        throw new Error(`Materialization failed for ${serviceLineId} ${direction}`);
      }
    }
  }

  const departures = await prisma.scheduledDeparture.findMany({
    where: { serviceDate: { gte: fromDate, lte: toDate } },
    select: { serviceDate: true },
  });
  const departuresByDate: Record<string, number> = {};
  for (const departure of departures) {
    const key = departure.serviceDate.toISOString().slice(0, 10);
    departuresByDate[key] = (departuresByDate[key] ?? 0) + 1;
  }

  return {
    campuses: await prisma.campus.count(),
    serviceLines: await prisma.serviceLine.count(),
    servedCampuses: await prisma.serviceLineCampus.count(),
    stops: await prisma.stop.count(),
    routePaths: await prisma.routePath.count(),
    calendars: calendarCount,
    schedulePatterns: patternCount,
    scheduledDepartures: departures.length,
    departuresByDate,
  };
};

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const main = async (): Promise<void> => {
  const prisma = new PrismaService();
  try {
    const result = await seedReferenceDataset(prisma, {
      fromDate: argumentValue('from') ?? DEFAULT_FROM_DATE,
      toDate: argumentValue('to') ?? DEFAULT_TO_DATE,
    });
    console.log(JSON.stringify({ source: REFERENCE_PATH, ...result }, null, 2));
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
