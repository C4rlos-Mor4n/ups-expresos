import 'dotenv/config';
import { UserRole } from '@prisma/client';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';
import { CalendarRepository } from '../src/modules/calendar/calendar.repository';
import { CalendarResolverService } from '../src/modules/calendar/calendar-resolver.service';
import { parseLocalDate } from '../src/modules/calendar/calendar-resolver.functions';
import { ScheduledDepartureMaterializerService } from '../src/modules/calendar/scheduled-departure-materializer.service';
import { ScheduledDepartureRepository } from '../src/modules/calendar/scheduled-departure.repository';
import { PrismaService } from '../src/database/prisma.service';
import { OperationalService } from '../src/modules/operational/operational.service';
import { guayaquilToday, parseCivilDate } from '../src/modules/operational/operational-time.functions';

const PREFIX = 'UPS-GO-DEMO';
const campusCode = `${PREFIX}-MARIA-AUXILIADORA`;
const lineCode = 'NORTE';
const calendarName = `${PREFIX} · horario operativo`;
const vehicleCode = `${PREFIX}-BUS-01`;
const vehiclePlate = 'GUA-0001';

const superAdminEmail = 'carlitosmoran245@gmail.com';
const driverEmail = 'carlosmoran.v28@gmail.com';
const studentEmail = 'carlosmoranvasquez26@gmail.com';
const demoEmails = [superAdminEmail, driverEmail, studentEmail];

const stopDefinitions = [
  { name: `${PREFIX} · Avícola Fernández`, latitude: -2.1423125, longitude: -79.882671875 },
  { name: `${PREFIX} · Confecciones Don Lucho`, latitude: -2.1444375, longitude: -79.892984375 },
  { name: `${PREFIX} · Colegio Americano`, latitude: -2.1384375, longitude: -79.9303125 },
  { name: `${PREFIX} · Paso Peatonal Puerto Azul`, latitude: -2.1917875, longitude: -79.972359375 },
  { name: `${PREFIX} · Mi Comisariato Vía a la Costa`, latitude: -2.1818125, longitude: -79.995859375 },
  { name: `${PREFIX} · UPS Campus María Auxiliadora`, latitude: -2.198611111, longitude: -80.041944444 },
] as const;

const prisma = new PrismaService();

const localTime = (hours: number, minutes: number): Date => new Date(Date.UTC(1970, 0, 1, hours, minutes));

const requireDemoEnvironment = (): void => {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('UPS GO demo data is blocked in production');
  }
};

const ensureStop = async (name: string, latitude: number, longitude: number): Promise<string> => {
  const existing = await prisma.stop.findFirst({ where: { name } });
  if (existing) {
    await prisma.stop.update({ where: { id: existing.id }, data: { latitude, longitude, isActive: true } });
    return existing.id;
  }
  return (await prisma.stop.create({ data: { name, latitude, longitude } })).id;
};

const ensureRoutePath = async (
  serviceLineId: string,
  code: string,
  displayName: string,
  direction: 'IDA' | 'RETORNO',
  stopIds: string[],
): Promise<string> => {
  const existing = await prisma.routePath.findUnique({ where: { serviceLineId_code: { serviceLineId, code } } });
  const routePath = existing
    ? await prisma.routePath.update({ where: { id: existing.id }, data: { displayName, direction, isActive: true } })
    : await prisma.routePath.create({ data: { serviceLineId, code, displayName, direction } });

  for (const [index, stopId] of stopIds.entries()) {
    await prisma.routePathStop.upsert({
      where: { routePathId_stopId: { routePathId: routePath.id, stopId } },
      update: { stopOrder: index + 1 },
      create: { routePathId: routePath.id, stopId, stopOrder: index + 1 },
    });
  }
  return routePath.id;
};

const ensurePattern = async (
  calendarId: string,
  direction: 'IDA' | 'RETORNO',
  weekday: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
): Promise<string> => {
  const existing = await prisma.schedulePattern.findFirst({ where: { serviceCalendarId: calendarId, direction, exceptionId: null } });
  const pattern = existing
    ? await prisma.schedulePattern.update({ where: { id: existing.id }, data: { status: 'PUBLISHED' } })
    : await prisma.schedulePattern.create({ data: { serviceCalendarId: calendarId, direction, status: 'PUBLISHED' } });
  await prisma.schedulePatternDay.upsert({
    where: { schedulePatternId_weekday: { schedulePatternId: pattern.id, weekday } },
    update: {},
    create: { schedulePatternId: pattern.id, weekday },
  });
  return pattern.id;
};

const ensureTimeAndJourney = async (
  patternId: string,
  departureTime: Date,
  routePathId: string,
  finalOffsetMinutes: number,
): Promise<string> => {
  const scheduleTime = await prisma.scheduleTime.upsert({
    where: { schedulePatternId_departureTime: { schedulePatternId: patternId, departureTime } },
    update: {},
    create: { schedulePatternId: patternId, departureTime },
  });
  const journey = await prisma.scheduleJourneyTemplate.upsert({
    where: { scheduleTimeId_routePathId: { scheduleTimeId: scheduleTime.id, routePathId } },
    update: {},
    create: { scheduleTimeId: scheduleTime.id, routePathId },
  });
  const routePathStops = await prisma.routePathStop.findMany({ where: { routePathId }, orderBy: { stopOrder: 'asc' } });
  for (const [index, routePathStop] of routePathStops.entries()) {
    const offsetMinutes = index === 0 ? 0 : Math.round((finalOffsetMinutes * index) / (routePathStops.length - 1));
    await prisma.scheduledStopTime.upsert({
      where: { journeyTemplateId_routePathStopId: { journeyTemplateId: journey.id, routePathStopId: routePathStop.id } },
      update: { offsetMinutes },
      create: { journeyTemplateId: journey.id, routePathStopId: routePathStop.id, offsetMinutes },
    });
  }
  return scheduleTime.id;
};

const removeDemoRuns = async (assignmentIds: string[]): Promise<void> => {
  if (assignmentIds.length === 0) return;
  const runs = await prisma.serviceRun.findMany({ where: { serviceAssignmentId: { in: assignmentIds } }, select: { id: true } });
  const runIds = runs.map((run) => run.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: runIds } } });
  await prisma.serviceRun.deleteMany({ where: { id: { in: runIds } } });
};

const ensureDataset = async (): Promise<void> => {
  requireDemoEnvironment();
  const today = guayaquilToday();
  const serviceDate = parseCivilDate(today);
  const parsed = parseLocalDate(today);
  if (!serviceDate || !parsed.ok) throw new Error('Unable to calculate UPS GO demo civil date');

  const campus = await prisma.campus.upsert({
    where: { code: campusCode },
    update: { name: 'Campus María Auxiliadora · Demo UPS GO', isActive: true },
    create: { code: campusCode, name: 'Campus María Auxiliadora · Demo UPS GO' },
  });
  const existingLine = await prisma.serviceLine.findUnique({ where: { campusId_code: { campusId: campus.id, code: lineCode } } });
  const line = existingLine
    ? await prisma.serviceLine.update({ where: { id: existingLine.id }, data: { name: 'Ruta Norte', isActive: true } })
    : await prisma.serviceLine.create({ data: { campusId: campus.id, code: lineCode, name: 'Ruta Norte' } });

  const stopIds = await Promise.all(stopDefinitions.map((stop) => ensureStop(stop.name, stop.latitude, stop.longitude)));
  const outboundPathId = await ensureRoutePath(line.id, 'NORTE-IDA', 'Ruta Norte · Ida', 'IDA', stopIds);
  const returnPathId = await ensureRoutePath(line.id, 'NORTE-RETORNO', 'Ruta Norte · Retorno', 'RETORNO', [...stopIds].reverse());

  const existingCalendar = await prisma.serviceCalendar.findFirst({ where: { serviceLineId: line.id, name: calendarName } });
  const calendarData = {
    validFrom: serviceDate,
    validUntil: new Date(serviceDate.getTime() + 31 * 86_400_000),
    status: 'PUBLISHED' as const,
    timezone: 'America/Guayaquil',
  };
  const calendar = existingCalendar
    ? await prisma.serviceCalendar.update({ where: { id: existingCalendar.id }, data: calendarData })
    : await prisma.serviceCalendar.create({ data: { serviceLineId: line.id, name: calendarName, ...calendarData } });
  const [outboundPatternId, returnPatternId] = await Promise.all([
    ensurePattern(calendar.id, 'IDA', parsed.value.weekday),
    ensurePattern(calendar.id, 'RETORNO', parsed.value.weekday),
  ]);
  const [outboundTimeId] = await Promise.all([
    ensureTimeAndJourney(outboundPatternId, localTime(6, 40), outboundPathId, 60),
    ensureTimeAndJourney(returnPatternId, localTime(17, 0), returnPathId, 60),
  ]);

  const resolver = new CalendarResolverService(new CalendarRepository(prisma));
  const materializer = new ScheduledDepartureMaterializerService(resolver, new ScheduledDepartureRepository(prisma));
  await materializer.materialize({ serviceLineId: line.id, direction: 'IDA', fromDate: today });
  await materializer.materialize({ serviceLineId: line.id, direction: 'RETORNO', fromDate: today });

  const [superAdmin, driverUser, student] = await Promise.all([
    prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { name: 'Carlos Morán', role: UserRole.SUPER_ADMIN, emailVerified: true, isActive: true },
      create: { email: superAdminEmail, name: 'Carlos Morán', role: UserRole.SUPER_ADMIN, emailVerified: true },
    }),
    prisma.user.upsert({
      where: { email: driverEmail },
      update: { name: 'Carlos Morán', role: UserRole.DRIVER, emailVerified: true, isActive: true },
      create: { email: driverEmail, name: 'Carlos Morán', role: UserRole.DRIVER, emailVerified: true },
    }),
    prisma.user.upsert({
      where: { email: studentEmail },
      update: { name: 'Carlos Morán Vásquez', role: UserRole.STUDENT, emailVerified: true, isActive: true },
      create: { email: studentEmail, name: 'Carlos Morán Vásquez', role: UserRole.STUDENT, emailVerified: true },
    }),
  ]);
  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: { name: 'Carlos Morán', status: 'ACTIVE' },
    create: { userId: driverUser.id, name: 'Carlos Morán' },
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { code: vehicleCode },
    update: { plate: vehiclePlate, capacity: 30, status: 'ACTIVE' },
    create: { code: vehicleCode, plate: vehiclePlate, capacity: 30 },
  });

  const departure = await prisma.scheduledDeparture.findFirstOrThrow({
    where: { sourceScheduleTimeId: outboundTimeId, serviceDate },
    orderBy: { id: 'asc' },
  });
  const existingAssignments = await prisma.serviceAssignment.findMany({ where: { scheduledDepartureId: departure.id }, select: { id: true } });
  const assignmentIds = existingAssignments.map((assignment) => assignment.id);
  await removeDemoRuns(assignmentIds);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: assignmentIds } } });
  await prisma.serviceAssignment.deleteMany({ where: { id: { in: assignmentIds } } });

  const journey = await prisma.scheduleJourneyTemplate.findUniqueOrThrow({
    where: { scheduleTimeId_routePathId: { scheduleTimeId: outboundTimeId, routePathId: outboundPathId } },
  });
  const operational = new OperationalService(prisma, new AuditLogsService(prisma));
  await operational.createAssignment({
    scheduledDepartureId: departure.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    journeyTemplateId: journey.id,
  }, superAdmin.id);

  void student;
  console.log(`UPS GO demo ready for ${today}: Ruta Norte has one bus in ASSIGNED state.`);
};

const cleanupDataset = async (): Promise<void> => {
  requireDemoEnvironment();
  if (process.env['UPS_GO_DEMO_CONFIRM'] !== 'DELETE') {
    throw new Error('Set UPS_GO_DEMO_CONFIRM=DELETE to remove only the UPS GO demo dataset');
  }
  const campus = await prisma.campus.findUnique({ where: { code: campusCode } });
  if (!campus) return;
  const line = await prisma.serviceLine.findUnique({ where: { campusId_code: { campusId: campus.id, code: lineCode } } });
  if (!line) return;

  const departures = await prisma.scheduledDeparture.findMany({ where: { serviceLineId: line.id }, select: { id: true } });
  const departureIds = departures.map((departure) => departure.id);
  const assignments = await prisma.serviceAssignment.findMany({ where: { scheduledDepartureId: { in: departureIds } }, select: { id: true } });
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const runs = await prisma.serviceRun.findMany({ where: { serviceAssignmentId: { in: assignmentIds } }, select: { id: true } });
  const runIds = runs.map((run) => run.id);
  const users = await prisma.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true } });
  const userIds = users.map((user) => user.id);

  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: [...assignmentIds, ...runIds] } }, { actorId: { in: userIds } }] },
  });
  await prisma.serviceRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.serviceAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.scheduledDeparture.deleteMany({ where: { id: { in: departureIds } } });

  const calendar = await prisma.serviceCalendar.findFirst({ where: { serviceLineId: line.id, name: calendarName } });
  if (calendar) {
    const patterns = await prisma.schedulePattern.findMany({ where: { serviceCalendarId: calendar.id }, select: { id: true } });
    const patternIds = patterns.map((pattern) => pattern.id);
    const times = await prisma.scheduleTime.findMany({ where: { schedulePatternId: { in: patternIds } }, select: { id: true } });
    const timeIds = times.map((time) => time.id);
    const journeys = await prisma.scheduleJourneyTemplate.findMany({ where: { scheduleTimeId: { in: timeIds } }, select: { id: true } });
    const journeyIds = journeys.map((journey) => journey.id);
    await prisma.scheduledStopTime.deleteMany({ where: { journeyTemplateId: { in: journeyIds } } });
    await prisma.scheduleJourneyTemplate.deleteMany({ where: { id: { in: journeyIds } } });
    await prisma.scheduleTime.deleteMany({ where: { id: { in: timeIds } } });
    await prisma.schedulePattern.updateMany({ where: { id: { in: patternIds } }, data: { exceptionId: null } });
    await prisma.schedulePatternDay.deleteMany({ where: { schedulePatternId: { in: patternIds } } });
    await prisma.schedulePattern.deleteMany({ where: { id: { in: patternIds } } });
    await prisma.serviceException.deleteMany({ where: { serviceCalendarId: calendar.id } });
    await prisma.serviceCalendar.delete({ where: { id: calendar.id } });
  }

  const paths = await prisma.routePath.findMany({ where: { serviceLineId: line.id }, select: { id: true } });
  const pathIds = paths.map((path) => path.id);
  await prisma.routePathStop.deleteMany({ where: { routePathId: { in: pathIds } } });
  await prisma.routePath.deleteMany({ where: { id: { in: pathIds } } });
  await prisma.serviceLine.delete({ where: { id: line.id } });
  await prisma.campus.delete({ where: { id: campus.id } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.authVerificationCode.deleteMany({ where: { email: { in: demoEmails } } });
  await prisma.driver.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.vehicle.deleteMany({ where: { code: vehicleCode } });
  await prisma.stop.deleteMany({ where: { name: { in: stopDefinitions.map((stop) => stop.name) }, routePathStops: { none: {} } } });
  console.log('UPS GO demo dataset removed.');
};

async function main(): Promise<void> {
  try {
    if (process.env['UPS_GO_DEMO_MODE'] === 'cleanup') await cleanupDataset();
    else await ensureDataset();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'UPS GO demo seed failed');
  process.exitCode = 1;
});
