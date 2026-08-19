import { PrismaClient } from '@prisma/client';
import { buildAllowedDomains, getDemoCatalog, shouldIncludeDemoData } from './seed-data';

const prisma = new PrismaClient();

async function seedAllowedDomains(): Promise<void> {
  const domains = buildAllowedDomains(process.env['ALLOWED_EMAIL_DOMAINS']);

  for (const domain of domains) {
    await prisma.allowedEmailDomain.upsert({
      where: { domain },
      update: { isActive: true },
      create: { domain },
    });
  }

  console.log(`Seeded ${domains.length} allowed email domains`);
}

async function seedSuperAdmins(): Promise<void> {
  const superAdminEmails = (process.env['SUPER_ADMIN_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  for (const email of superAdminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'SUPER_ADMIN', emailVerified: true, isActive: true },
      create: {
        email,
        role: 'SUPER_ADMIN',
        emailVerified: true,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${superAdminEmails.length} super admin users`);
}

async function normalizeLegacyPrivilegedUsers(): Promise<void> {
  const legacyRoleOverrides = [
    { email: 'cmoranv1@est.ups.edu.ec', role: 'STUDENT' as const, name: null },
    { email: 'superadmin.demo@ups.edu.ec', role: 'STUDENT' as const, name: 'Super Admin Demo UPS' },
    { email: 'admin.operaciones@ups.edu.ec', role: 'STUDENT' as const, name: 'Daniela Operaciones' },
  ];

  for (const entry of legacyRoleOverrides) {
    await prisma.user.updateMany({
      where: { email: entry.email },
      data: {
        role: entry.role,
        name: entry.name,
      },
    });
  }
}

async function seedDemoData(): Promise<void> {
  const catalog = getDemoCatalog();
  const now = new Date();

  for (const user of catalog.users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        emailVerified: true,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true,
        isActive: true,
      },
    });
  }

  const routeIds = new Map<string, string>();
  for (const route of catalog.routes) {
    const existingByCurrentName = await prisma.route.findFirst({
      where: { name: route.name, direction: route.direction },
    });
    const existingByLegacyName = existingByCurrentName
      ? null
      : await prisma.route.findFirst({
          where: {
            name: { in: route.legacyNames ?? [] },
            direction: route.direction,
          },
        });
    const existing = existingByCurrentName ?? existingByLegacyName;

    const saved = existing
      ? await prisma.route.update({
          where: { id: existing.id },
          data: {
            name: route.name,
            description: route.description,
            direction: route.direction,
            status: route.status,
            isActive: true,
          },
        })
      : await prisma.route.create({
          data: {
            name: route.name,
            description: route.description,
            direction: route.direction,
            status: route.status,
            isActive: true,
          },
        });

    routeIds.set(route.key, saved.id);
  }

  const stopIds = new Map<string, string>();
  for (const stop of catalog.stops) {
    const existingByCurrentName = await prisma.stop.findFirst({ where: { name: stop.name } });
    const existingByLegacyName = existingByCurrentName
      ? null
      : await prisma.stop.findFirst({ where: { name: { in: stop.legacyNames ?? [] } } });
    const existing = existingByCurrentName ?? existingByLegacyName;
    const saved = existing
      ? await prisma.stop.update({
          where: { id: existing.id },
          data: {
            name: stop.name,
            reference: stop.reference,
            latitude: stop.latitude,
            longitude: stop.longitude,
            isActive: true,
          },
        })
      : await prisma.stop.create({
          data: {
            name: stop.name,
            reference: stop.reference,
            latitude: stop.latitude,
            longitude: stop.longitude,
            isActive: true,
          },
        });

    stopIds.set(stop.key, saved.id);
  }

  const routeStopRouteIds = Array.from(new Set(catalog.routeStops.map((routeStop) => routeIds.get(routeStop.routeKey)).filter(Boolean))) as string[];

  if (routeStopRouteIds.length > 0) {
    await prisma.routeStop.deleteMany({
      where: {
        routeId: { in: routeStopRouteIds },
      },
    });
  }

  for (const routeStop of catalog.routeStops) {
    const routeId = routeIds.get(routeStop.routeKey);
    const stopId = stopIds.get(routeStop.stopKey);
    if (!routeId || !stopId) continue;

    await prisma.routeStop.create({
      data: {
        routeId,
        stopId,
        stopOrder: routeStop.stopOrder,
        estimatedArrivalMinutes: routeStop.estimatedArrivalMinutes,
        notes: routeStop.notes,
      },
    });
  }

  const selectedStopIds = Array.from(stopIds.values());
  const obsoleteDemoStopNames = catalog.stops.flatMap((stop) => [stop.name, ...(stop.legacyNames ?? [])]);

  if (obsoleteDemoStopNames.length > 0) {
    await prisma.stop.deleteMany({
      where: {
        id: { notIn: selectedStopIds },
        name: { in: obsoleteDemoStopNames },
        routeStops: { none: {} },
      },
    });
  }

  if (routeStopRouteIds.length > 0) {
    await prisma.schedule.deleteMany({
      where: {
        routeId: { in: routeStopRouteIds },
      },
    });
  }

  for (const schedule of catalog.schedules) {
    const routeId = routeIds.get(schedule.routeKey);
    if (!routeId) continue;

    const existing = await prisma.schedule.findFirst({
      where: {
        routeId,
        dayOfWeek: schedule.dayOfWeek,
        direction: schedule.direction,
        departureTime: schedule.departureTime,
      },
    });

    if (existing) {
      await prisma.schedule.update({
        where: { id: existing.id },
        data: {
          approximateArrivalTime: schedule.approximateArrivalTime,
          status: schedule.status,
        },
      });
    } else {
      await prisma.schedule.create({
        data: {
          routeId,
          dayOfWeek: schedule.dayOfWeek,
          direction: schedule.direction,
          departureTime: schedule.departureTime,
          approximateArrivalTime: schedule.approximateArrivalTime,
          status: schedule.status,
        },
      });
    }
  }

  const vehicleIds = new Map<string, string>();
  for (const vehicle of catalog.vehicles) {
    const saved = await prisma.vehicle.upsert({
      where: { plate: vehicle.plate },
      update: {
        code: vehicle.code,
        capacity: vehicle.capacity,
        status: vehicle.status,
      },
      create: {
        plate: vehicle.plate,
        code: vehicle.code,
        capacity: vehicle.capacity,
        status: vehicle.status,
      },
    });

    vehicleIds.set(vehicle.code, saved.id);
  }

  const driverIds = new Map<string, string>();
  for (const driver of catalog.drivers) {
    const assignedVehicleId = vehicleIds.get(driver.assignedVehicleCode) ?? null;
    const assignedRouteId = routeIds.get(driver.assignedRouteKey) ?? null;

    const existing = await prisma.driver.findFirst({ where: { licenseNumber: driver.licenseNumber } });
    const saved = existing
      ? await prisma.driver.update({
          where: { id: existing.id },
          data: {
            name: driver.name,
            phone: driver.phone,
            status: driver.status,
            assignedVehicleId,
            assignedRouteId,
          },
        })
      : await prisma.driver.create({
          data: {
            name: driver.name,
            phone: driver.phone,
            licenseNumber: driver.licenseNumber,
            status: driver.status,
            assignedVehicleId,
            assignedRouteId,
          },
        });

    driverIds.set(driver.name, saved.id);
  }

  for (const notice of catalog.notices) {
    const creator = await prisma.user.findUnique({ where: { email: notice.createdByEmail } });
    if (!creator) continue;

    const publishedFrom = new Date(now.getTime() + notice.publishedOffsetDays * 24 * 60 * 60 * 1000);
    const publishedUntil = notice.expiresAfterDays
      ? new Date(publishedFrom.getTime() + notice.expiresAfterDays * 24 * 60 * 60 * 1000)
      : null;

    const existing = await prisma.notice.findFirst({ where: { title: notice.title } });
    if (existing) {
      await prisma.notice.update({
        where: { id: existing.id },
        data: {
          message: notice.message,
          severity: notice.severity,
          publishedFrom,
          publishedUntil,
          isActive: true,
          createdById: creator.id,
        },
      });
    } else {
      await prisma.notice.create({
        data: {
          title: notice.title,
          message: notice.message,
          severity: notice.severity,
          publishedFrom,
          publishedUntil,
          isActive: true,
          createdById: creator.id,
        },
      });
    }
  }

  for (const feedback of catalog.tripFeedbacks) {
    const user = await prisma.user.findUnique({ where: { email: feedback.userEmail } });
    const routeId = routeIds.get(feedback.routeKey);
    const driverId = feedback.driverName ? driverIds.get(feedback.driverName) ?? null : null;
    if (!user || !routeId) continue;

    const travelDate = new Date(now.getTime() + feedback.travelOffsetDays * 24 * 60 * 60 * 1000);

    const existing = await prisma.tripFeedback.findFirst({
      where: {
        userId: user.id,
        routeId,
        comment: feedback.comment,
      },
    });

    if (existing) {
      await prisma.tripFeedback.update({
        where: { id: existing.id },
        data: {
          driverId,
          rating: feedback.rating,
          travelDate,
        },
      });
    } else {
      await prisma.tripFeedback.create({
        data: {
          userId: user.id,
          routeId,
          driverId,
          rating: feedback.rating,
          comment: feedback.comment,
          travelDate,
        },
      });
    }
  }

  console.log(
    `Demo data ready: ${catalog.users.length} users, ${catalog.routes.length} routes, ${catalog.stops.length} stops, ${catalog.schedules.length} schedules, ${catalog.vehicles.length} vehicles, ${catalog.drivers.length} drivers, ${catalog.notices.length} notices, ${catalog.tripFeedbacks.length} feedbacks`,
  );
}

async function main(): Promise<void> {
  console.log('Starting seed...');

  await seedAllowedDomains();
  await seedSuperAdmins();
  await normalizeLegacyPrivilegedUsers();

  if (shouldIncludeDemoData(process.env['NODE_ENV'], process.env['SEED_INCLUDE_DEMO_DATA'])) {
    await seedDemoData();
  } else {
    console.log('Skipping demo data for this environment');
  }

  console.log('Seed completed!');
}

main()
  .catch((e: unknown) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
