import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';
import { guayaquilToday } from '../../src/modules/operational/operational-time.functions';
import { seedReferenceDataset } from '../../scripts/seed-from-reference';
import { cleanDatabase, createTestApp, seedTestDatabase } from '../helpers/e2e.helper';

jest.setTimeout(60_000);

/** Endpoints del panel: resumen, usuarios (con reglas de rol), auditoría y cancelación de asignaciones. */
describe('Admin panel API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ip = 120;
  let superAdmin: string;
  let admin: string;
  let student: string;

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
  const as = (token: string, req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanDatabase(prisma);
    await seedTestDatabase(prisma);
    const today = guayaquilToday();
    await seedReferenceDataset(prisma, { fromDate: today, toDate: today });
    superAdmin = await login('super@ups.edu.ec');
    await prisma.user.create({ data: { email: 'operador@ups.edu.ec', role: UserRole.ADMIN, name: 'Operador' } });
    admin = await login('operador@ups.edu.ec');
    student = await login('student@est.ups.edu.ec');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('returns the daily dashboard', async () => {
    const res = await as(admin, http().get('/admin/dashboard')).expect(200);
    expect(res.body.date).toBe(guayaquilToday());
    expect(res.body.departures).toBeGreaterThan(0);
    expect(res.body.departuresWithoutBus).toBe(res.body.departures);
    await as(student, http().get('/admin/dashboard')).expect(403);
  });

  it('lists and searches users', async () => {
    const all = await as(admin, http().get('/admin/users')).expect(200);
    expect(all.body.total).toBeGreaterThanOrEqual(3);
    const found = await as(admin, http().get('/admin/users').query({ search: 'STUDENT@' })).expect(200);
    expect(found.body.items.map((u: { email: string }) => u.email)).toEqual(['student@est.ups.edu.ec']);
  });

  it('enforces role rules when updating users', async () => {
    const studentUser = await prisma.user.findUniqueOrThrow({ where: { email: 'student@est.ups.edu.ec' } });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'operador@ups.edu.ec' } });
    const superUser = await prisma.user.findUniqueOrThrow({ where: { email: 'super@ups.edu.ec' } });

    // Un ADMIN no puede crear administradores ni tocar a otros administradores, ni a sí mismo.
    await as(admin, http().patch(`/admin/users/${studentUser.id}`).send({ role: 'ADMIN' })).expect(403);
    await as(admin, http().patch(`/admin/users/${superUser.id}`).send({ isActive: false })).expect(403);
    await as(admin, http().patch(`/admin/users/${adminUser.id}`).send({ isActive: false })).expect(403);
    // DRIVER se gestiona desde el perfil de conductor.
    await as(superAdmin, http().patch(`/admin/users/${studentUser.id}`).send({ role: 'DRIVER' })).expect(409);

    // Desactivar revoca la sesión del estudiante.
    const off = await as(admin, http().patch(`/admin/users/${studentUser.id}`).send({ isActive: false })).expect(200);
    expect(off.body.isActive).toBe(false);
    await as(student, http().get('/auth/me')).expect(401);
    await as(admin, http().patch(`/admin/users/${studentUser.id}`).send({ isActive: true })).expect(200);
  });

  it('cancels an unstarted assignment, freeing the bus window, and audits it', async () => {
    const vehicle = await as(superAdmin, http().post('/admin/vehicles').send({ plate: 'GBB-1111', code: 'BUS-11', capacity: 30 })).expect(201);
    const driver = await as(superAdmin, http().post('/admin/drivers').send({ name: 'Ana Ruiz' })).expect(201);
    const line = await prisma.serviceLine.findFirstOrThrow({ where: { code: 'NORTE' } });
    const timetable = await as(admin, http().get(`/admin/operational/service-lines/${line.id}/timetable`)).expect(200);
    const departure = timetable.body.scheduledDepartures[0];
    expect(departure.journeyTemplates.length).toBeGreaterThan(0);
    const body = {
      scheduledDepartureId: departure.id,
      vehicleId: vehicle.body.id,
      driverId: driver.body.id,
      journeyTemplateId: departure.journeyTemplates[0].id,
    };
    const created = await as(admin, http().post('/admin/operational/service-assignments').send(body)).expect(201);
    await as(admin, http().post('/admin/operational/service-assignments').send(body)).expect(409);

    const cancelled = await as(admin, http().post(`/admin/operational/service-assignments/${created.body.id}/cancel`)).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    // La ventana quedó libre: se puede volver a asignar el mismo bus.
    await as(admin, http().post('/admin/operational/service-assignments').send(body)).expect(201);

    const logs = await as(admin, http().get('/admin/audit-logs').query({ entity: 'ServiceAssignment' })).expect(200);
    expect(logs.body.items.map((l: { action: string }) => l.action)).toContain('SERVICE_ASSIGNMENT_CANCEL');
    expect(logs.body.items[0].actorEmail).toBe('operador@ups.edu.ec');
  });
});
