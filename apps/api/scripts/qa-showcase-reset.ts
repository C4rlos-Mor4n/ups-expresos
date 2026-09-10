import 'dotenv/config';

import { ForbiddenException } from '@nestjs/common';
import {
  Direction,
  DriverStatus,
  Prisma,
  ServiceAssignmentStatus,
  ServiceRunStatus,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';
import { OperationalService } from '../src/modules/operational/operational.service';
import { calculatePlannedWindow } from '../src/modules/operational/operational-time.functions';
import { seedReferenceDataset } from './seed-from-reference';

const FROM_DATE = '2026-09-05';
const TO_DATE = '2026-09-12';
const TODAY = '2026-09-05';
const DATABASE_NAME = 'krionix';
const TIMEZONE = 'America/Guayaquil';
const CONFIRMATION = 'YES';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const USERS = {
  superAdmin: {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Carlos Moran',
    email: 'carlitosmoran245@gmail.com',
    role: UserRole.SUPER_ADMIN,
  },
  driver: {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Carlos Moran Vásquez',
    email: 'carlosmoran.v28@gmail.com',
    role: UserRole.DRIVER,
  },
  student: {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Carlos Moran Vásquez',
    email: 'carlosmoranvasquez26@gmail.com',
    role: UserRole.STUDENT,
  },
} as const;

const VEHICLES = [
  { id: '20000000-0000-4000-8000-000000000001', code: 'BUS-01', plate: 'GAA-1001' },
  { id: '20000000-0000-4000-8000-000000000002', code: 'BUS-02', plate: 'GAA-1002' },
  { id: '20000000-0000-4000-8000-000000000003', code: 'BUS-03', plate: 'GAA-1003' },
  { id: '20000000-0000-4000-8000-000000000004', code: 'BUS-04', plate: 'GAA-1004' },
] as const;

const DRIVERS = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Carlos Moran Vásquez',
    userId: USERS.driver.id,
  },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Conductor Demo 02', userId: null },
  { id: '30000000-0000-4000-8000-000000000003', name: 'Conductor Demo 03', userId: null },
  { id: '30000000-0000-4000-8000-000000000004', name: 'Conductor Demo 04', userId: null },
] as const;

interface AssignmentSpec {
  date: string;
  lineCode: 'NORTE' | 'SUR' | 'URB_LA_JOYA';
  direction: Direction;
  time: string;
  vehicleIndex: number;
  driverIndex: number;
  run?: ServiceRunStatus;
}

interface SafetyEvidence {
  nodeEnv: string;
  host: string;
  port: string;
  database: string;
  serverAddress: string | null;
  serverPort: number;
  timezone: string;
  confirmation: 'YES';
}

interface ResetCounts {
  users: number;
  vehicles: number;
  drivers: number;
  stops: number;
  scheduledDepartures: number;
  serviceAssignments: number;
  serviceRuns: number;
}

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`QA assertion failed: ${message}`);
};

const databaseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const databaseTime = (value: string): Date => new Date(`1970-01-01T${value}:00.000Z`);
const dateText = (value: Date): string => value.toISOString().slice(0, 10);

const assignmentId = (index: number): string =>
  `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

const assignmentSpecs = (): AssignmentSpec[] => {
  const specs: AssignmentSpec[] = [
    {
      date: TODAY,
      lineCode: 'NORTE',
      direction: Direction.RETORNO,
      time: '12:30',
      vehicleIndex: 1,
      driverIndex: 1,
      run: ServiceRunStatus.COMPLETED,
    },
    {
      date: TODAY,
      lineCode: 'NORTE',
      direction: Direction.RETORNO,
      time: '14:30',
      vehicleIndex: 0,
      driverIndex: 0,
      run: ServiceRunStatus.IN_PROGRESS,
    },
    {
      date: TODAY,
      lineCode: 'NORTE',
      direction: Direction.RETORNO,
      time: '18:15',
      vehicleIndex: 0,
      driverIndex: 0,
    },
    {
      date: TODAY,
      lineCode: 'SUR',
      direction: Direction.RETORNO,
      time: '18:05',
      vehicleIndex: 1,
      driverIndex: 1,
    },
    {
      date: TODAY,
      lineCode: 'URB_LA_JOYA',
      direction: Direction.RETORNO,
      time: '18:05',
      vehicleIndex: 2,
      driverIndex: 2,
    },
    {
      date: TODAY,
      lineCode: 'URB_LA_JOYA',
      direction: Direction.RETORNO,
      time: '18:05',
      vehicleIndex: 3,
      driverIndex: 3,
    },
  ];

  for (const date of [
    '2026-09-07',
    '2026-09-08',
    '2026-09-09',
    '2026-09-10',
    '2026-09-11',
    '2026-09-12',
  ]) {
    specs.push(
      {
        date,
        lineCode: 'NORTE',
        direction: Direction.IDA,
        time: '06:40',
        vehicleIndex: 0,
        driverIndex: 0,
      },
      {
        date,
        lineCode: 'NORTE',
        direction: Direction.IDA,
        time: '06:40',
        vehicleIndex: 1,
        driverIndex: 1,
      },
      {
        date,
        lineCode: 'SUR',
        direction: Direction.IDA,
        time: '06:40',
        vehicleIndex: 2,
        driverIndex: 2,
      },
      {
        date,
        lineCode: 'URB_LA_JOYA',
        direction: Direction.IDA,
        time: date === '2026-09-12' ? '08:30' : '08:35',
        vehicleIndex: 3,
        driverIndex: 3,
      },
    );
  }
  assert(specs.length === 30, 'assignment specification must contain 30 rows');
  return specs;
};

const verifySafety = async (prisma: PrismaService): Promise<SafetyEvidence> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing QA reset because NODE_ENV is production');
  }
  if (process.env.CONFIRM_LOCAL_QA_RESET !== CONFIRMATION) {
    throw new Error('Refusing QA reset: set CONFIRM_LOCAL_QA_RESET=YES explicitly');
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('Refusing QA reset: DATABASE_URL is missing');
  const url = new URL(rawUrl);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('Refusing QA reset: DATABASE_URL must use PostgreSQL');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing QA reset: database host ${url.hostname} is not local`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== DATABASE_NAME) {
    throw new Error(`Refusing QA reset: database name ${database || '(empty)'} is not ${DATABASE_NAME}`);
  }

  const rows = await prisma.$queryRaw<
    Array<{
      database: string;
      serverAddress: string | null;
      serverPort: number;
      timezone: string;
    }>
  >(Prisma.sql`
    SELECT
      current_database() AS database,
      inet_server_addr()::text AS "serverAddress",
      inet_server_port() AS "serverPort",
      current_setting('TIMEZONE') AS timezone
  `);
  const row = rows[0];
  assert(row?.database === DATABASE_NAME, 'connected database must be krionix');
  assert(row.timezone === TIMEZONE, 'database timezone must be America/Guayaquil');
  return {
    nodeEnv: process.env.NODE_ENV ?? '(unset)',
    host: url.hostname,
    port: url.port || '5432',
    database: row.database,
    serverAddress: row.serverAddress,
    serverPort: row.serverPort,
    timezone: row.timezone,
    confirmation: CONFIRMATION,
  };
};

const countResetScope = async (prisma: PrismaService): Promise<ResetCounts> => ({
  users: await prisma.user.count(),
  vehicles: await prisma.vehicle.count(),
  drivers: await prisma.driver.count(),
  stops: await prisma.stop.count(),
  scheduledDepartures: await prisma.scheduledDeparture.count(),
  serviceAssignments: await prisma.serviceAssignment.count(),
  serviceRuns: await prisma.serviceRun.count(),
});

const resetData = async (prisma: PrismaService): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.serviceRun.deleteMany();
    await tx.serviceAssignment.deleteMany();
    await tx.scheduledDeparture.deleteMany();
    await tx.scheduledStopTime.deleteMany();
    await tx.scheduleJourneyTemplate.deleteMany();
    await tx.scheduleTime.deleteMany();
    await tx.schedulePatternDay.deleteMany();
    await tx.schedulePattern.deleteMany();
    await tx.serviceException.deleteMany();
    await tx.serviceCalendar.deleteMany();
    await tx.routePathStop.deleteMany();
    await tx.routePath.deleteMany();
    await tx.serviceLineCampus.deleteMany();
    await tx.serviceLine.deleteMany();
    await tx.stop.deleteMany();
    await tx.campus.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.session.deleteMany();
    await tx.authVerificationCode.deleteMany();
    await tx.driver.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.user.deleteMany();
  });
};

const seedAuthAndResources = async (prisma: PrismaService): Promise<void> => {
  await prisma.user.createMany({
    data: Object.values(USERS).map((user) => ({
      ...user,
      emailVerified: true,
      isActive: true,
    })),
  });
  await prisma.vehicle.createMany({
    data: VEHICLES.map((vehicle) => ({
      ...vehicle,
      capacity: 40,
      status: VehicleStatus.ACTIVE,
    })),
  });
  await prisma.driver.createMany({
    data: DRIVERS.map((driver) => ({
      ...driver,
      status: DriverStatus.ACTIVE,
    })),
  });
};

const seedShowcaseOverlay = async (prisma: PrismaService): Promise<void> => {
  const specs = assignmentSpecs();
  const ids = specs.map((_, index) => assignmentId(index));
  await prisma.serviceRun.deleteMany({ where: { serviceAssignmentId: { in: ids } } });

  for (const [index, spec] of specs.entries()) {
    const departures = await prisma.scheduledDeparture.findMany({
      where: {
        serviceLine: { code: spec.lineCode },
        serviceDate: databaseDate(spec.date),
        direction: spec.direction,
        scheduledTime: databaseTime(spec.time),
      },
      include: {
        sourceScheduleTime: {
          include: {
            journeyTemplates: { include: { stopTimes: true } },
          },
        },
      },
    });
    assert(
      departures.length === 1,
      `expected one ${spec.lineCode} ${spec.direction} departure at ${spec.date} ${spec.time}`,
    );
    const departure = departures[0]!;
    const journeys = departure.sourceScheduleTime.journeyTemplates;
    assert(journeys.length === 1, `departure ${departure.id} must have exactly one journey`);
    const journey = journeys[0]!;
    const maximumOffset = Math.max(...journey.stopTimes.map((item) => item.offsetMinutes));
    const window = calculatePlannedWindow(
      departure.serviceDate,
      departure.scheduledTime,
      maximumOffset,
    );
    assert(window, `departure ${departure.id} must have a positive planned window`);
    const vehicle = VEHICLES[spec.vehicleIndex];
    const driver = DRIVERS[spec.driverIndex];
    assert(vehicle && driver, `invalid resource index for assignment ${index + 1}`);
    const data = {
      scheduledDepartureId: departure.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      journeyTemplateId: journey.id,
      plannedStartAt: window.plannedStartAt,
      plannedEndAt: window.plannedEndAt,
      status: ServiceAssignmentStatus.ASSIGNED,
    };
    await prisma.serviceAssignment.upsert({
      where: { id: ids[index]! },
      update: data,
      create: { id: ids[index]!, ...data },
    });
  }

  const completedAssignment = await prisma.serviceAssignment.findUniqueOrThrow({
    where: { id: ids[0] },
  });
  await prisma.serviceRun.create({
    data: {
      id: '50000000-0000-4000-8000-000000000001',
      serviceAssignmentId: completedAssignment.id,
      status: ServiceRunStatus.COMPLETED,
      startedAt: completedAssignment.plannedStartAt,
      completedAt: completedAssignment.plannedEndAt,
    },
  });
  const activeAssignment = await prisma.serviceAssignment.findUniqueOrThrow({
    where: { id: ids[1] },
  });
  await prisma.serviceRun.create({
    data: {
      id: '50000000-0000-4000-8000-000000000002',
      serviceAssignmentId: activeAssignment.id,
      status: ServiceRunStatus.IN_PROGRESS,
      startedAt: activeAssignment.plannedStartAt,
      completedAt: null,
    },
  });
};

const findStudentDeparture = async (
  operational: OperationalService,
  lineId: string,
  time: string,
  direction: Direction,
) => {
  const departures = await operational.getStudentDepartures(lineId, TODAY, direction);
  const result = departures.find((departure) => departure.scheduledTime.slice(0, 5) === time);
  assert(result, `student departure ${direction} ${time} must exist`);
  return result;
};

const verifyReadOnly = async (prisma: PrismaService) => {
  const [
    users,
    sessions,
    authCodes,
    auditLogs,
    campuses,
    lines,
    servedCampuses,
    stops,
    routePaths,
    calendars,
    patterns,
    departures,
    assignments,
    runs,
    vehicles,
    drivers,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { email: 'asc' } }),
    prisma.session.count(),
    prisma.authVerificationCode.count(),
    prisma.auditLog.count(),
    prisma.campus.findMany({ orderBy: { code: 'asc' } }),
    prisma.serviceLine.findMany({ orderBy: { code: 'asc' } }),
    prisma.serviceLineCampus.count(),
    prisma.stop.findMany(),
    prisma.routePath.findMany(),
    prisma.serviceCalendar.count(),
    prisma.schedulePattern.count(),
    prisma.scheduledDeparture.findMany({
      where: { serviceDate: { gte: databaseDate(FROM_DATE), lte: databaseDate(TO_DATE) } },
      orderBy: [{ serviceDate: 'asc' }, { scheduledTime: 'asc' }],
    }),
    prisma.serviceAssignment.findMany({
      include: { scheduledDeparture: { include: { serviceLine: true } }, serviceRun: true },
      orderBy: { id: 'asc' },
    }),
    prisma.serviceRun.findMany(),
    prisma.vehicle.findMany({ orderBy: { code: 'asc' } }),
    prisma.driver.findMany({ orderBy: { name: 'asc' } }),
  ]);

  assert(users.length === 3, 'users must equal 3');
  for (const expected of Object.values(USERS)) {
    const actual = users.find((user) => user.email === expected.email);
    assert(actual?.role === expected.role, `${expected.email} must have role ${expected.role}`);
    assert(actual.isActive && actual.emailVerified, `${expected.email} must be active and verified`);
  }
  assert(sessions === 0 && authCodes === 0 && auditLogs === 0, 'auth and audit rows must start at zero');
  assert(campuses.length === 2 && campuses.every((campus) => campus.isActive), 'two active campuses required');
  assert(lines.length === 3 && lines.every((line) => line.isActive), 'three active lines required');
  assert(servedCampuses === 4, 'four served-campus links required');
  assert(stops.length === 14 && stops.every((stop) => stop.isActive), 'fourteen active stops required');
  assert(routePaths.length === 7 && routePaths.every((path) => path.isActive), 'seven active route paths required');
  assert(calendars === 3 && patterns === 12, 'three calendars and twelve patterns required');
  assert(departures.length === 211, 'exactly 211 departures required');
  assert(assignments.length === 30 && runs.length === 2, 'exactly 30 assignments and two runs required');
  assert(vehicles.length === 4 && vehicles.every((vehicle) => vehicle.status === VehicleStatus.ACTIVE), 'four active vehicles required');
  assert(drivers.length === 4 && drivers.every((driver) => driver.status === DriverStatus.ACTIVE), 'four active drivers required');

  const expectedByDate: Record<string, number> = {
    '2026-09-05': 18,
    '2026-09-06': 0,
    '2026-09-07': 35,
    '2026-09-08': 35,
    '2026-09-09': 35,
    '2026-09-10': 35,
    '2026-09-11': 35,
    '2026-09-12': 18,
  };
  const actualByDate: Record<string, number> = {};
  for (const departure of departures) {
    const key = dateText(departure.serviceDate);
    actualByDate[key] = (actualByDate[key] ?? 0) + 1;
  }
  for (const [date, expected] of Object.entries(expectedByDate)) {
    assert((actualByDate[date] ?? 0) === expected, `${date} must have ${expected} departures`);
  }

  const todayAssignments = assignments.filter(
    (assignment) => dateText(assignment.scheduledDeparture.serviceDate) === TODAY,
  );
  assert(todayAssignments.length === 6, 'today must have six assignments');
  assert(
    assignments.filter((assignment) => dateText(assignment.scheduledDeparture.serviceDate) > TODAY).length === 24,
    'future service days must have 24 assignments',
  );
  assert(runs.filter((run) => run.status === ServiceRunStatus.COMPLETED).length === 1, 'one completed run required');
  assert(runs.filter((run) => run.status === ServiceRunStatus.IN_PROGRESS).length === 1, 'one active run required');

  const usedStops = await prisma.routePathStop.findMany({ distinct: ['stopId'], select: { stopId: true } });
  assert(usedStops.length === 14, 'all 14 source stops must be used');
  const duplicateUsers = await prisma.user.groupBy({ by: ['email'], _count: { _all: true }, having: { email: { _count: { gt: 1 } } } });
  const duplicateVehicles = await prisma.vehicle.groupBy({ by: ['code'], _count: { _all: true }, having: { code: { _count: { gt: 1 } } } });
  const duplicateAssignments = await prisma.serviceAssignment.groupBy({
    by: ['scheduledDepartureId', 'vehicleId', 'driverId'],
    _count: { _all: true },
    having: { scheduledDepartureId: { _count: { gt: 1 } } },
  });
  assert(duplicateUsers.length + duplicateVehicles.length + duplicateAssignments.length === 0, 'showcase identities must not be duplicated');

  const orphanRows = await prisma.$queryRaw<Array<{ relation: string; count: bigint }>>(Prisma.sql`
    SELECT 'route_path_stops.stop' AS relation, count(*) AS count
      FROM route_path_stops child LEFT JOIN stops parent ON parent.id = child."stopId" WHERE parent.id IS NULL
    UNION ALL
    SELECT 'assignments.departure', count(*)
      FROM service_assignments child LEFT JOIN scheduled_departures parent ON parent.id = child."scheduledDepartureId" WHERE parent.id IS NULL
    UNION ALL
    SELECT 'assignments.vehicle', count(*)
      FROM service_assignments child LEFT JOIN vehicles parent ON parent.id = child."vehicleId" WHERE parent.id IS NULL
    UNION ALL
    SELECT 'assignments.driver', count(*)
      FROM service_assignments child LEFT JOIN drivers parent ON parent.id = child."driverId" WHERE parent.id IS NULL
    UNION ALL
    SELECT 'runs.assignment', count(*)
      FROM service_runs child LEFT JOIN service_assignments parent ON parent.id = child."serviceAssignmentId" WHERE parent.id IS NULL
  `);
  assert(orphanRows.every((row) => row.count === 0n), 'foreign-key orphan checks must be zero');

  const operational = new OperationalService(prisma, new AuditLogsService(prisma));
  const studentCampuses = await operational.getStudentCampuses();
  assert(studentCampuses.length === 2, 'Student API must expose two campuses');
  const maria = studentCampuses.find((campus) => campus.code === 'UPS_MARIA_AUXILIADORA');
  const centenario = studentCampuses.find((campus) => campus.code === 'UPS_CENTENARIO');
  assert(maria && centenario, 'Student API must expose both source campuses');
  const mariaLines = await operational.getStudentServiceLines(maria.id);
  const centenarioLines = await operational.getStudentServiceLines(centenario.id);
  assert(mariaLines.length === 3, 'María Auxiliadora must expose three lines');
  assert(centenarioLines.length === 1 && centenarioLines[0]?.code === 'SUR', 'Centenario must expose SUR only');
  const norte = mariaLines.find((line) => line.code === 'NORTE');
  const sur = mariaLines.find((line) => line.code === 'SUR');
  const joya = mariaLines.find((line) => line.code === 'URB_LA_JOYA');
  assert(norte && sur && joya, 'Student API must expose all canonical lines');
  const studentCases = [
    { actual: await findStudentDeparture(operational, norte.id, '06:40', Direction.IDA), state: 'SCHEDULED', count: 0 },
    { actual: await findStudentDeparture(operational, norte.id, '12:30', Direction.RETORNO), state: 'COMPLETED', count: 1 },
    { actual: await findStudentDeparture(operational, norte.id, '14:30', Direction.RETORNO), state: 'IN_PROGRESS', count: 1 },
    { actual: await findStudentDeparture(operational, norte.id, '18:15', Direction.RETORNO), state: 'ASSIGNED', count: 1 },
    { actual: await findStudentDeparture(operational, sur.id, '18:05', Direction.RETORNO), state: 'ASSIGNED', count: 1 },
    { actual: await findStudentDeparture(operational, joya.id, '18:05', Direction.RETORNO), state: 'ASSIGNED', count: 2 },
  ];
  for (const item of studentCases) {
    assert(item.actual.state === item.state && item.actual.assignmentCount === item.count, `Student state ${item.state} must be visible`);
  }

  const driverToday = await operational.getDriverAssignmentsToday(USERS.driver.id);
  assert(driverToday.length === 2, 'primary Driver must have two assignments today');
  const currentRun = await operational.getCurrentDriverRun(USERS.driver.id);
  assert(currentRun?.run?.status === ServiceRunStatus.IN_PROGRESS, 'primary Driver must have one current run');
  const waiting = driverToday.find((assignment) => assignment.run === null);
  assert(waiting && waiting.departure.scheduledTime.slice(0, 5) === '18:15', 'primary Driver must have the 18:15 waiting assignment');
  const foreignAssignment = todayAssignments.find((assignment) => assignment.driverId === DRIVERS[1].id);
  assert(foreignAssignment, 'a foreign Driver assignment must exist');
  let ownershipRejected = false;
  try {
    await operational.getDriverAssignment(USERS.driver.id, foreignAssignment.id);
  } catch (error) {
    ownershipRejected = error instanceof ForbiddenException;
  }
  assert(ownershipRejected, 'Driver ownership guard must reject another driver assignment');

  return {
    counts: {
      users: users.length,
      sessions,
      authVerificationCodes: authCodes,
      auditLogs,
      campuses: campuses.length,
      serviceLines: lines.length,
      serviceLineCampuses: servedCampuses,
      stops: stops.length,
      routePaths: routePaths.length,
      calendars,
      schedulePatterns: patterns,
      scheduledDepartures: departures.length,
      serviceAssignments: assignments.length,
      serviceRuns: runs.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
    },
    departuresByDate: expectedByDate,
    today: { assignments: todayAssignments.length, runs: runs.length },
    future: { assignments: 24 },
    identities: {
      userEmails: users.map((user) => user.email),
      vehicleCodes: vehicles.map((vehicle) => vehicle.code),
      driverNames: drivers.map((driver) => driver.name),
    },
    student: { campuses: 2, mariaLines: 3, centenarioLines: ['SUR'], stateCases: 'PASS' },
    driver: { todayAssignments: 2, currentRun: 'IN_PROGRESS', waiting: '18:15', ownership: 'PASS' },
    duplicates: 0,
    orphans: 0,
    activeFlags: 'PASS',
    gpsTelemetry: 'NOT_SYNTHESIZED',
  };
};

const main = async (): Promise<void> => {
  const prisma = new PrismaService();
  try {
    const safety = await verifySafety(prisma);
    const previous = await countResetScope(prisma);
    await resetData(prisma);
    await seedAuthAndResources(prisma);
    const reference = await seedReferenceDataset(prisma, { fromDate: FROM_DATE, toDate: TO_DATE });
    await seedShowcaseOverlay(prisma);
    await seedShowcaseOverlay(prisma);
    const verification = await verifyReadOnly(prisma);
    console.log(
      JSON.stringify(
        {
          result: 'PASS',
          safety,
          deleted: previous,
          source: {
            path: 'docs/ups_go_routes_reference_guayaquil.json',
            kind: 'REFERENCE_DATASET_NOT_PRODUCTION',
          },
          range: { from: FROM_DATE, to: TO_DATE, timezone: TIMEZONE },
          reference,
          overlayIdempotencyRuns: 2,
          verification,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
