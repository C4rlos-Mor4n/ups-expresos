import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';
import { guayaquilToday } from '../../src/modules/operational/operational-time.functions';
import { OperationsAutoRunService } from '../../src/modules/tracking/operations-auto-run.service';
import { seedReferenceDataset } from '../../scripts/seed-from-reference';
import { cleanDatabase, createTestApp, seedTestDatabase } from '../helpers/e2e.helper';

jest.setTimeout(60_000);

const TOKEN = process.env.HUNTER_WEBHOOK_TOKEN!;
const DEVICE_ID = 4631511939;

/** FechaHora de Hunter (UTC, `yyyyMMdd HH:mm:ss`) para "hace N segundos". */
function hunterDate(secondsAgo = 0): string {
  const d = new Date(Date.now() - secondsAgo * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function hunterEvent(overrides: Record<string, unknown> = {}) {
  return {
    AliasEtiqueta: 'GBA1234/BUS07',
    FechaHora: hunterDate(5),
    Id: DEVICE_ID,
    Evento: 1,
    Suceso: 7,
    Latitud: -2.1528408527374268,
    Longitud: -79.89356231689453,
    Calle: 'Av. de las Américas, Guayaquil',
    NumeroSatelites: 13,
    CalidadGPS: 1,
    EstadoIgnicion: 1,
    Velocidad: 20,
    Rumbo: 213,
    Altitud: 29,
    ...overrides,
  };
}

/**
 * Tracking Hunter de punta a punta: webhook autenticado → dispositivo nuevo → la administración lo
 * vincula a un bus → el estudiante ve el bus en el mapa (solo en la ventana del servicio) →
 * la operación automática inicia y cierra el recorrido.
 */
describe('Tracking / Hunter DataForward (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let autoRun: OperationsAutoRunService;
  let ip = 60;
  let admin: string;
  let student: string;
  let driverToken: string;
  let vehicleId: string;
  let departureId: string;
  let assignmentId: string;
  let deviceId: string;

  const http = () => request(app.getHttpServer());
  const login = async (email: string) => {
    const address = `198.51.100.${ip++}`;
    const code = await http().post('/auth/request-code').set('X-Forwarded-For', address).send({ email }).expect(201);
    const session = await http()
      .post('/auth/verify-code')
      .set('X-Forwarded-For', address)
      .send({ email, code: code.body.devCode })
      .expect(201);
    return session.body.accessToken as string;
  };
  const post = (body: unknown, path = '') =>
    http().post(`/integrations/hunter/dataforward${path}?token=${TOKEN}`).send(body as object);
  const studentLive = () =>
    http().get(`/student/scheduled-departures/${departureId}/live`).set('Authorization', `Bearer ${student}`).expect(200);

  beforeAll(async () => {
    let moduleRef;
    ({ app, prisma, moduleRef } = await createTestApp());
    autoRun = moduleRef.get(OperationsAutoRunService);
    await cleanDatabase(prisma);
    await seedTestDatabase(prisma);
    const today = guayaquilToday();
    await seedReferenceDataset(prisma, { fromDate: today, toDate: today });

    const departure = await prisma.scheduledDeparture.findFirstOrThrow({
      where: { serviceDate: new Date(`${today}T00:00:00.000Z`) },
      orderBy: { scheduledTime: 'asc' },
      include: { sourceScheduleTime: { include: { journeyTemplates: true } } },
    });
    departureId = departure.id;

    admin = await login('super@ups.edu.ec');
    student = await login('student@est.ups.edu.ec');

    vehicleId = (
      await http().post('/admin/vehicles').set('Authorization', `Bearer ${admin}`)
        .send({ plate: 'GBA-1234', code: 'BUS-07', capacity: 40 }).expect(201)
    ).body.id;
    const user = await prisma.user.create({ data: { email: 'chofer@ups.edu.ec', role: UserRole.DRIVER, name: 'Luis' } });
    const driver = await prisma.driver.create({ data: { name: 'Luis Andrade', userId: user.id } });
    driverToken = await login('chofer@ups.edu.ec');

    const now = Date.now();
    const assignment = await prisma.serviceAssignment.create({
      data: {
        scheduledDepartureId: departureId,
        vehicleId,
        driverId: driver.id,
        journeyTemplateId: departure.sourceScheduleTime!.journeyTemplates[0]!.id,
        // Ventana alrededor de "ahora" para que el servicio esté a punto de salir.
        plannedStartAt: new Date(now - 60_000),
        plannedEndAt: new Date(now + 3_600_000),
      },
    });
    assignmentId = assignment.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('rejects calls without the integration token', async () => {
    await http().post('/integrations/hunter/dataforward').send(hunterEvent()).expect(401);
    await http().post('/integrations/hunter/dataforward?token=wrong-token-value').send(hunterEvent()).expect(401);
    await http()
      .post('/integrations/hunter/dataforward')
      .set('X-UPS-GO-Token', TOKEN)
      .send(hunterEvent({ FechaHora: hunterDate(400) }))
      .expect(200);
  });

  it('rejects malformed payloads with 400', async () => {
    await post({ ...hunterEvent(), Latitud: 300 }).expect(400);
    await post({ foo: 'bar' }).expect(400);
    await post(hunterEvent(), '/alerts').expect(400);
  });

  it('creates the device on first report and is idempotent on resends', async () => {
    const event = hunterEvent();
    const first = await post(event).expect(200);
    expect(first.body).toEqual({ received: 1, accepted: 1, duplicates: 0 });
    const again = await post([event]).expect(200);
    expect(again.body).toEqual({ received: 1, accepted: 0, duplicates: 1 });

    const devices = await http().get('/admin/tracking/devices').set('Authorization', `Bearer ${admin}`).expect(200);
    expect(devices.body).toHaveLength(1);
    expect(devices.body[0]).toMatchObject({ externalId: String(DEVICE_ID), alias: 'GBA1234', label: 'BUS07', vehicle: null });
    expect(devices.body[0].position.speedKph).toBeCloseTo(32.19, 1);
    deviceId = devices.body[0].id;
  });

  it('student sees NO_DEVICE until the admin binds the device to the bus', async () => {
    const before = await studentLive();
    expect(before.body.buses[0]).toMatchObject({ assignmentId, phase: 'BEFORE_START', tracking: { status: 'NO_DEVICE' } });

    await http().put(`/admin/tracking/devices/${deviceId}/vehicle`).set('Authorization', `Bearer ${admin}`)
      .send({ vehicleId }).expect(200);

    const after = await studentLive();
    expect(after.body.refreshAfterSeconds).toBe(10);
    expect(after.body.buses[0].tracking.status).toBe('AVAILABLE');
    expect(after.body.buses[0].tracking.position).toMatchObject({ freshness: 'LIVE', heading: 213 });
    // El estudiante no recibe datos internos del proveedor.
    expect(JSON.stringify(after.body)).not.toContain('Calle');
  });

  it('keeps the newest position when an older report arrives late', async () => {
    await post(hunterEvent({ FechaHora: hunterDate(2), Latitud: -2.16 })).expect(200);
    await post(hunterEvent({ FechaHora: hunterDate(300), Latitud: -2.5 })).expect(200);
    const live = await studentLive();
    expect(live.body.buses[0].tracking.position.latitude).toBeCloseTo(-2.16, 5);
  });

  it('driver sees the GPS status of their bus', async () => {
    const live = await http().get(`/driver/operational/assignments/${assignmentId}/live`)
      .set('Authorization', `Bearer ${driverToken}`).expect(200);
    expect(live.body).toMatchObject({ assignmentId, tracking: { status: 'AVAILABLE' } });
    await http().get(`/driver/operational/assignments/${assignmentId}/live`)
      .set('Authorization', `Bearer ${student}`).expect(403);
  });

  it('auto-starts the run at its time when the bus GPS is live, and the student sees IN_PROGRESS', async () => {
    const result = await autoRun.tick();
    expect(result.started).toBe(1);
    const run = await prisma.serviceRun.findUniqueOrThrow({ where: { serviceAssignmentId: assignmentId } });
    expect(run).toMatchObject({ status: 'IN_PROGRESS', startSource: 'SYSTEM' });

    const live = await studentLive();
    expect(live.body.buses[0]).toMatchObject({ phase: 'IN_PROGRESS', startSource: 'SYSTEM' });

    const fleet = await http().get('/admin/tracking/fleet').set('Authorization', `Bearer ${admin}`).expect(200);
    expect(fleet.body[0].currentRun).toMatchObject({ assignmentId, startSource: 'SYSTEM' });
    // Un segundo ciclo no vuelve a iniciar nada.
    expect((await autoRun.tick()).started).toBe(0);
  });

  it('records alerts and exposes them to the administration', async () => {
    await post(
      {
        FechaHora: hunterDate(1),
        IdActivo: DEVICE_ID,
        Alias: 'GBA1234',
        Etiqueta: 'BUS07',
        Descripcion: 'ALERTA EXCESO DE VELOCIDAD',
        Latitud: -2.17,
        Longitud: -79.9,
        NumeroSatelites: 12,
        EstadoGPS: 1,
        Velocidad: 60,
        Rumbo: 90,
      },
      '/alerts',
    ).expect(200);
    const alerts = await http().get('/admin/tracking/alerts').set('Authorization', `Bearer ${admin}`).expect(200);
    expect(alerts.body[0]).toMatchObject({ kind: 'ALERT', description: 'ALERTA EXCESO DE VELOCIDAD', vehicle: { id: vehicleId } });

    const from = new Date(Date.now() - 3_600_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const trail = await http().get(`/admin/tracking/vehicles/${vehicleId}/trail`).query({ from, to })
      .set('Authorization', `Bearer ${admin}`).expect(200);
    expect(trail.body.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-finishes a run left open after its planned window', async () => {
    await prisma.serviceAssignment.update({
      where: { id: assignmentId },
      data: { plannedStartAt: new Date(Date.now() - 3 * 3_600_000), plannedEndAt: new Date(Date.now() - 31 * 60_000) },
    });
    expect((await autoRun.tick()).finished).toBe(1);
    const run = await prisma.serviceRun.findUniqueOrThrow({ where: { serviceAssignmentId: assignmentId } });
    expect(run).toMatchObject({ status: 'COMPLETED', completionSource: 'SYSTEM' });
    // Fuera de servicio el estudiante ya no recibe la posición.
    const live = await studentLive();
    expect(live.body.buses[0]).toMatchObject({ phase: 'NOT_LIVE', tracking: { status: 'NOT_LIVE', position: null } });
  });

  it('only admins manage devices', async () => {
    await http().get('/admin/tracking/devices').set('Authorization', `Bearer ${student}`).expect(403);
  });
});
