import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';
import { CalendarRepository } from '../src/modules/calendar/calendar.repository';
import { CalendarResolverService } from '../src/modules/calendar/calendar-resolver.service';
import { parseLocalDate } from '../src/modules/calendar/calendar-resolver.functions';
import { ScheduledDepartureMaterializerService } from '../src/modules/calendar/scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from '../src/modules/calendar/scheduled-departure.repository';
import { PrismaService } from '../src/database/prisma.service';
import { OperationalService } from '../src/modules/operational/operational.service';
import { guayaquilToday, parseCivilDate } from '../src/modules/operational/operational-time.functions';

const PREFIX = 'DEVQA-P6';
const campusCode = `${PREFIX}-CENTENARIO`;
const lineCode = `${PREFIX}-NORTE`;
const calendarName = `${PREFIX} calendar`;
const vehicleCodes = [`${PREFIX}-BUS001`, `${PREFIX}-BUS002`, `${PREFIX}-BUS003`];
const driverEmails = [`${PREFIX.toLowerCase()}-driver1@ups.edu.ec`, `${PREFIX.toLowerCase()}-driver2@ups.edu.ec`, `${PREFIX.toLowerCase()}-driver3@ups.edu.ec`];
const stopNames = ['Garzota', 'Samanes', 'Sauces', 'Campus'].map((name) => `${PREFIX} ${name}`);

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;

const localTime = (hours: number, minutes: number): Date => new Date(Date.UTC(1970, 0, 1, hours, minutes));

const requireDevQaEnvironment = (): void => {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Phase 6 DEV/QA dataset is blocked in production');
  }
};

const ensureStop = async (name: string, latitude: number, longitude: number): Promise<string> => {
  const existing = await prisma.stop.findFirst({ where: { name } });
  if (existing) return existing.id;
  return (await prisma.stop.create({ data: { name, latitude, longitude } })).id;
};

const ensureRoutePath = async (serviceLineId: string, code: string, displayName: string, direction: 'IDA' | 'RETORNO', originStopId: string, destinationStopId: string): Promise<string> => {
  const existing = await prisma.routePath.findUnique({ where: { serviceLineId_code: { serviceLineId, code } } });
  const routePath = existing ?? await prisma.routePath.create({ data: { serviceLineId, code, displayName, direction } });
  for (const [stopId, stopOrder] of [[originStopId, 1], [destinationStopId, 2]] as const) {
    const routePathStop = await prisma.routePathStop.findUnique({ where: { routePathId_stopId: { routePathId: routePath.id, stopId } } });
    if (!routePathStop) {
      await prisma.routePathStop.create({ data: { routePathId: routePath.id, stopId, stopOrder } });
    }
  }
  return routePath.id;
};

const ensurePattern = async (calendarId: string, direction: 'IDA' | 'RETORNO', weekday: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'): Promise<string> => {
  const existing = await prisma.schedulePattern.findFirst({ where: { serviceCalendarId: calendarId, direction, exceptionId: null } });
  const pattern = existing ?? await prisma.schedulePattern.create({ data: { serviceCalendarId: calendarId, direction, status: 'PUBLISHED' } });
  await prisma.schedulePatternDay.upsert({
    where: { schedulePatternId_weekday: { schedulePatternId: pattern.id, weekday } },
    update: {},
    create: { schedulePatternId: pattern.id, weekday },
  });
  return pattern.id;
};

const ensureTimeAndJourney = async (patternId: string, time: Date, routePathId: string, offsetMinutes: number): Promise<string> => {
  const existingTime = await prisma.scheduleTime.findFirst({ where: { schedulePatternId: patternId, departureTime: time } });
  const scheduleTime = existingTime ?? await prisma.scheduleTime.create({ data: { schedulePatternId: patternId, departureTime: time } });
  const journey = await prisma.scheduleJourneyTemplate.upsert({
    where: { scheduleTimeId_routePathId: { scheduleTimeId: scheduleTime.id, routePathId } },
    update: {},
    create: { scheduleTimeId: scheduleTime.id, routePathId },
  });
  const routePathStops = await prisma.routePathStop.findMany({ where: { routePathId }, orderBy: { stopOrder: 'asc' } });
  for (const [index, routePathStop] of routePathStops.entries()) {
    const isFirst = index === 0;
    await prisma.scheduledStopTime.upsert({
      where: { journeyTemplateId_routePathStopId: { journeyTemplateId: journey.id, routePathStopId: routePathStop.id } },
      update: { offsetMinutes: isFirst ? 0 : offsetMinutes },
      create: { journeyTemplateId: journey.id, routePathStopId: routePathStop.id, offsetMinutes: isFirst ? 0 : offsetMinutes },
    });
  }
  return scheduleTime.id;
};

const ensureDataset = async (): Promise<void> => {
  requireDevQaEnvironment();
  const today = guayaquilToday();
  const serviceDate = parseCivilDate(today);
  const parsed = parseLocalDate(today);
  if (!serviceDate || !parsed.ok) throw new Error('Unable to calculate DEV/QA civil date');

  const campus = await prisma.campus.upsert({
    where: { code: campusCode },
    update: { name: `${PREFIX} Campus Centenario`, isActive: true },
    create: { code: campusCode, name: `${PREFIX} Campus Centenario` },
  });
  const existingLine = await prisma.serviceLine.findUnique({ where: { campusId_code: { campusId: campus.id, code: lineCode } } });
  const line = existingLine
    ? await prisma.serviceLine.update({ where: { id: existingLine.id }, data: { name: `${PREFIX} Ruta Norte`, isActive: true } })
    : await prisma.serviceLine.create({ data: { campusId: campus.id, code: lineCode, name: `${PREFIX} Ruta Norte` } });

  const [garzota, samanes, sauces, campusStop] = await Promise.all([
    ensureStop(stopNames[0]!, -2.147, -79.892),
    ensureStop(stopNames[1]!, -2.127, -79.908),
    ensureStop(stopNames[2]!, -2.159, -79.898),
    ensureStop(stopNames[3]!, -2.182, -79.894),
  ]);
  const [garzotaPath, samanesPath, saucesPath, returnPath] = await Promise.all([
    ensureRoutePath(line.id, `${PREFIX}-GARZOTA`, `${PREFIX} Garzota`, 'IDA', garzota, campusStop),
    ensureRoutePath(line.id, `${PREFIX}-SAMANES`, `${PREFIX} Samanes`, 'IDA', samanes, campusStop),
    ensureRoutePath(line.id, `${PREFIX}-SAUCES`, `${PREFIX} Sauces`, 'IDA', sauces, campusStop),
    ensureRoutePath(line.id, `${PREFIX}-RETORNO`, `${PREFIX} Retorno`, 'RETORNO', campusStop, garzota),
  ]);

  const existingCalendar = await prisma.serviceCalendar.findFirst({ where: { serviceLineId: line.id, name: calendarName } });
  const calendar = existingCalendar
    ? await prisma.serviceCalendar.update({ where: { id: existingCalendar.id }, data: { validFrom: serviceDate, validUntil: new Date(serviceDate.getTime() + 31 * 86_400_000), status: 'PUBLISHED', timezone: 'America/Guayaquil' } })
    : await prisma.serviceCalendar.create({ data: { serviceLineId: line.id, name: calendarName, validFrom: serviceDate, validUntil: new Date(serviceDate.getTime() + 31 * 86_400_000), status: 'PUBLISHED', timezone: 'America/Guayaquil' } });
  const [idaPattern, returnPattern] = await Promise.all([
    ensurePattern(calendar.id, 'IDA', parsed.value.weekday),
    ensurePattern(calendar.id, 'RETORNO', parsed.value.weekday),
  ]);
  const [ida0640, ida0720, return1700] = await Promise.all([
    ensureTimeAndJourney(idaPattern, localTime(6, 40), garzotaPath, 50),
    ensureTimeAndJourney(idaPattern, localTime(7, 20), samanesPath, 45),
    ensureTimeAndJourney(returnPattern, localTime(17, 0), returnPath, 55),
  ]);
  await ensureTimeAndJourney(idaPattern, localTime(6, 40), samanesPath, 55);
  await ensureTimeAndJourney(idaPattern, localTime(6, 40), saucesPath, 60);
  await ensureTimeAndJourney(returnPattern, localTime(18, 0), returnPath, 55);

  const resolver = new CalendarResolverService(new CalendarRepository(prismaService));
  const materializer = new ScheduledDepartureMaterializerService(resolver, new ScheduledDepartureRepository(prismaService));
  await materializer.materialize({ serviceLineId: line.id, direction: 'IDA', fromDate: today });
  await materializer.materialize({ serviceLineId: line.id, direction: 'RETORNO', fromDate: today });

  const vehicles = await Promise.all(vehicleCodes.map((code, index) => prisma.vehicle.upsert({
    where: { code },
    update: { status: 'ACTIVE' },
    create: { code, plate: `${PREFIX.replace(/-/g, '')}${index + 1}`, capacity: 30 },
  })));
  const drivers = await Promise.all(driverEmails.map(async (email, index) => {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: UserRole.DRIVER, emailVerified: true, isActive: true },
      create: { email, name: `${PREFIX} Driver ${index + 1}`, role: UserRole.DRIVER, emailVerified: true },
    });
    const existing = await prisma.driver.findUnique({ where: { userId: user.id } });
    const driver = existing ?? await prisma.driver.create({ data: { userId: user.id, name: `${PREFIX} Driver ${index + 1}` } });
    return { driver, userId: user.id };
  }));
  const departure = await prisma.scheduledDeparture.findFirstOrThrow({ where: { sourceScheduleTimeId: ida0640, serviceDate }, orderBy: { id: 'asc' } });
  const journeys = await prisma.scheduleJourneyTemplate.findMany({ where: { scheduleTimeId: ida0640 }, orderBy: { id: 'asc' } });
  const operational = new OperationalService(prismaService, new AuditLogsService(prismaService));
  for (let index = 0; index < vehicles.length; index += 1) {
    const vehicle = vehicles[index]!;
    const driver = drivers[index]!;
    const journey = journeys[index];
    if (!journey) throw new Error('DEV/QA journey template configuration is incomplete');
    const existing = await prisma.serviceAssignment.findFirst({ where: { scheduledDepartureId: departure.id, vehicleId: vehicle.id } });
    if (!existing) {
      await operational.createAssignment({ scheduledDepartureId: departure.id, vehicleId: vehicle.id, driverId: driver.driver.id, journeyTemplateId: journey.id }, driver.userId);
    }
  }
  const firstAssignment = await prisma.serviceAssignment.findFirstOrThrow({ where: { scheduledDepartureId: departure.id, vehicleId: vehicles[0]!.id } });
  await operational.startDriverRun(drivers[0]!.userId, firstAssignment.id);
  console.log(`Phase 6 DEV/QA dataset ready for ${today}: ${line.name}, 3 assigned buses, 1 active ServiceRun.`);

  void ida0720;
  void return1700;
};

const cleanupDataset = async (): Promise<void> => {
  requireDevQaEnvironment();
  if (process.env['PHASE6_QA_CONFIRM'] !== 'DELETE') {
    throw new Error('Set PHASE6_QA_CONFIRM=DELETE to remove only the Phase 6 DEV/QA dataset');
  }
  const campus = await prisma.campus.findUnique({ where: { code: campusCode } });
  if (!campus) return;
  const line = await prisma.serviceLine.findUnique({ where: { campusId_code: { campusId: campus.id, code: lineCode } } });
  if (!line) return;
  const departures = await prisma.scheduledDeparture.findMany({ where: { serviceLineId: line.id }, select: { id: true } });
  const assignmentIds = (await prisma.serviceAssignment.findMany({ where: { scheduledDepartureId: { in: departures.map((departure) => departure.id) } }, select: { id: true } })).map((assignment) => assignment.id);
  const runIds = (await prisma.serviceRun.findMany({ where: { serviceAssignmentId: { in: assignmentIds } }, select: { id: true } })).map((run) => run.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...assignmentIds, ...runIds] } } });
  await prisma.serviceRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.serviceAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.scheduledDeparture.deleteMany({ where: { id: { in: departures.map((departure) => departure.id) } } });
  const calendar = await prisma.serviceCalendar.findFirst({ where: { serviceLineId: line.id, name: calendarName } });
  if (calendar) {
    const patterns = await prisma.schedulePattern.findMany({ where: { serviceCalendarId: calendar.id }, select: { id: true } });
    const times = await prisma.scheduleTime.findMany({ where: { schedulePatternId: { in: patterns.map((pattern) => pattern.id) } }, select: { id: true } });
    const journeys = await prisma.scheduleJourneyTemplate.findMany({ where: { scheduleTimeId: { in: times.map((time) => time.id) } }, select: { id: true } });
    await prisma.scheduledStopTime.deleteMany({ where: { journeyTemplateId: { in: journeys.map((journey) => journey.id) } } });
    await prisma.scheduleJourneyTemplate.deleteMany({ where: { id: { in: journeys.map((journey) => journey.id) } } });
    await prisma.scheduleTime.deleteMany({ where: { id: { in: times.map((time) => time.id) } } });
    await prisma.schedulePatternDay.deleteMany({ where: { schedulePatternId: { in: patterns.map((pattern) => pattern.id) } } });
    await prisma.schedulePattern.deleteMany({ where: { id: { in: patterns.map((pattern) => pattern.id) } } });
    await prisma.serviceCalendar.delete({ where: { id: calendar.id } });
  }
  const paths = await prisma.routePath.findMany({ where: { serviceLineId: line.id }, select: { id: true } });
  await prisma.routePathStop.deleteMany({ where: { routePathId: { in: paths.map((path) => path.id) } } });
  await prisma.routePath.deleteMany({ where: { id: { in: paths.map((path) => path.id) } } });
  await prisma.serviceLine.delete({ where: { id: line.id } });
  await prisma.campus.delete({ where: { id: campus.id } });
  await prisma.driver.deleteMany({ where: { user: { email: { in: driverEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: driverEmails } } });
  await prisma.vehicle.deleteMany({ where: { code: { in: vehicleCodes } } });
  await prisma.stop.deleteMany({ where: { name: { in: stopNames }, routePathStops: { none: {} } } });
  console.log('Phase 6 DEV/QA dataset removed.');
};

async function main(): Promise<void> {
  try {
    if (process.env['PHASE6_QA_MODE'] === 'cleanup') await cleanupDataset();
    else await ensureDataset();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Phase 6 DEV/QA dataset failed');
  process.exitCode = 1;
});
