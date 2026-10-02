import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { guayaquilToday } from '../../src/modules/operational/operational-time.functions';
import { seedReferenceDataset } from '../../scripts/seed-from-reference';
import { cleanDatabase, createTestApp, seedTestDatabase } from '../helpers/e2e.helper';

jest.setTimeout(60_000);

/**
 * Flujo completo del conductor, de punta a punta, sobre la API real:
 * admin crea bus y conductor → le da acceso a la app → asigna una salida de hoy →
 * el conductor inicia sesión (correo no UPS) → inicia y finaliza el recorrido →
 * el estudiante ve los estados → se revoca el acceso.
 */
describe('Driver flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ip = 20;

  const http = () => request(app.getHttpServer());
  const login = async (email: string) => {
    const address = `198.51.100.${ip++}`;
    const code = await http()
      .post('/auth/request-code')
      .set('X-Forwarded-For', address)
      .send({ email })
      .expect(201);
    const session = await http()
      .post('/auth/verify-code')
      .set('X-Forwarded-For', address)
      .send({ email, code: code.body.devCode })
      .expect(201);
    return session.body as { accessToken: string; refreshToken: string; user: { role: string } };
  };

  let admin: string;
  let driverId: string;
  let vehicleId: string;
  let departureId: string;
  let journeyTemplateId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
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
    journeyTemplateId = departure.sourceScheduleTime!.journeyTemplates[0]!.id;

    admin = (await login('super@ups.edu.ec')).accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('admin registers a bus and a driver, and gives the driver app access', async () => {
    vehicleId = (
      await http()
        .post('/admin/vehicles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ plate: 'GBA-1234', code: 'BUS-07', capacity: 40 })
        .expect(201)
    ).body.id;

    const driver = await http()
      .post('/admin/drivers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Luis Andrade' })
      .expect(201);
    driverId = driver.body.id;
    expect(driver.body.accountEmail).toBeNull();

    const linked = await http()
      .post(`/admin/drivers/${driverId}/account`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ email: '  Luis.Andrade@Gmail.com ' })
      .expect(200);
    expect(linked.body.accountEmail).toBe('luis.andrade@gmail.com');
  });

  it('rejects linking an admin email or a second driver to the same account', async () => {
    await http()
      .post(`/admin/drivers/${driverId}/account`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ email: 'admin@ups.edu.ec' })
      .expect(409);

    const other = await http()
      .post('/admin/drivers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Otro Conductor' })
      .expect(201);
    await http()
      .post(`/admin/drivers/${other.body.id}/account`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ email: 'luis.andrade@gmail.com' })
      .expect(409);
  });

  it('runs the whole service: assign → driver starts → student sees it → driver finishes', async () => {
    const assignment = await http()
      .post('/admin/operational/service-assignments')
      .set('Authorization', `Bearer ${admin}`)
      .send({ scheduledDepartureId: departureId, vehicleId, driverId, journeyTemplateId })
      .expect(201);
    const assignmentId = assignment.body.id as string;

    // El conductor entra con su Gmail aunque el dominio no esté permitido para registro abierto.
    const driver = await login('luis.andrade@gmail.com');
    expect(driver.user.role).toBe('DRIVER');
    const asDriver = (req: request.Test) => req.set('Authorization', `Bearer ${driver.accessToken}`);

    const today = await asDriver(http().get('/driver/operational/assignments/today')).expect(200);
    expect(today.body.map((item: { id: string }) => item.id)).toContain(assignmentId);

    const student = (await login('student@est.ups.edu.ec')).accessToken;
    const studentView = () =>
      http()
        .get(`/student/scheduled-departures/${departureId}`)
        .set('Authorization', `Bearer ${student}`)
        .expect(200);
    expect((await studentView()).body.state).toBe('ASSIGNED');

    const started = await asDriver(
      http().post(`/driver/operational/assignments/${assignmentId}/start`),
    ).expect(200);
    expect(started.body.run.status).toBe('IN_PROGRESS');
    const runId = started.body.run.id as string;

    const current = await asDriver(http().get('/driver/operational/service-runs/current')).expect(200);
    expect(current.body.run.id).toBe(runId);
    const inProgress = await studentView();
    expect(inProgress.body.state).toBe('IN_PROGRESS');
    expect(inProgress.body.assignments[0].vehicle.plate).toBe('GBA-1234');
    expect(inProgress.body.assignments[0].driverName).toBe('Luis Andrade');

    // Iniciar dos veces es idempotente; no crea otro recorrido.
    const again = await asDriver(
      http().post(`/driver/operational/assignments/${assignmentId}/start`),
    ).expect(200);
    expect(again.body.run.id).toBe(runId);

    const finished = await asDriver(
      http().post(`/driver/operational/service-runs/${runId}/finish`),
    ).expect(200);
    expect(finished.body.run.status).toBe('COMPLETED');
    expect((await studentView()).body.state).toBe('COMPLETED');
    const none = await asDriver(http().get('/driver/operational/service-runs/current')).expect(200);
    expect(none.body).toBeNull();
  });

  it('a student cannot use driver endpoints', async () => {
    const student = (await login('student@est.ups.edu.ec')).accessToken;
    await http()
      .get('/driver/operational/assignments/today')
      .set('Authorization', `Bearer ${student}`)
      .expect(403);
  });

  it('unlinking removes access: sessions are revoked and the account is a student again', async () => {
    const driver = await login('luis.andrade@gmail.com');
    const unlinked = await http()
      .delete(`/admin/drivers/${driverId}/account`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(unlinked.body.accountEmail).toBeNull();

    // El refresh token ya no sirve y el access token vigente pierde el acceso operativo.
    await http().post('/auth/refresh').send({ refreshToken: driver.refreshToken }).expect(401);
    const denied = await http()
      .get('/driver/operational/assignments/today')
      .set('Authorization', `Bearer ${driver.accessToken}`);
    expect([403, 404]).toContain(denied.status);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'luis.andrade@gmail.com' } });
    expect(user.role).toBe('STUDENT');
  });
});
