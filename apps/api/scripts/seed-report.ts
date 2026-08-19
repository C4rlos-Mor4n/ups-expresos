import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [
    users,
    routes,
    stops,
    routeStops,
    schedules,
    vehicles,
    drivers,
    notices,
    tripFeedbacks,
    allowedDomains,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: 'asc' }, { email: 'asc' }] }),
    prisma.route.findMany({ orderBy: [{ name: 'asc' }, { direction: 'asc' }] }),
    prisma.stop.count(),
    prisma.routeStop.count(),
    prisma.schedule.count(),
    prisma.vehicle.findMany({ orderBy: { code: 'asc' } }),
    prisma.driver.findMany({ orderBy: { name: 'asc' } }),
    prisma.notice.findMany({ orderBy: { publishedFrom: 'desc' } }),
    prisma.tripFeedback.count(),
    prisma.allowedEmailDomain.findMany({ where: { isActive: true }, orderBy: { domain: 'asc' } }),
  ]);

  const byRole = Object.values(UserRole).reduce<Record<string, Array<{ email: string; name: string | null }>>>(
    (acc, role) => {
      acc[role] = users
        .filter((user) => user.role === role)
        .map((user) => ({ email: user.email, name: user.name }));
      return acc;
    },
    {},
  );

  const summary = {
    counts: {
      users: users.length,
      routes: routes.length,
      stops,
      routeStops,
      schedules,
      vehicles: vehicles.length,
      drivers: drivers.length,
      notices: notices.length,
      tripFeedbacks,
      allowedDomains: allowedDomains.length,
    },
    allowedDomains: allowedDomains.map((domain) => domain.domain),
    usersByRole: byRole,
    adminWebUsers: users
      .filter((user) => user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)
      .map((user) => ({ email: user.email, name: user.name, role: user.role })),
    mobileUsers: users
      .filter((user) => user.role === UserRole.STUDENT)
      .map((user) => ({ email: user.email, name: user.name, role: user.role })),
    driverPortalUsers: users
      .filter((user) => user.role === UserRole.DRIVER)
      .map((user) => ({ email: user.email, name: user.name, role: user.role })),
    routeStatusBreakdown: routes.map((route) => ({
      name: route.name,
      direction: route.direction,
      status: route.status,
      isActive: route.isActive,
    })),
    vehicleStatusBreakdown: vehicles.map((vehicle) => ({
      code: vehicle.code,
      plate: vehicle.plate,
      status: vehicle.status,
      capacity: vehicle.capacity,
    })),
    driverAssignments: drivers.map((driver) => ({
      name: driver.name,
      status: driver.status,
      licenseNumber: driver.licenseNumber,
      assignedRouteId: driver.assignedRouteId,
      assignedVehicleId: driver.assignedVehicleId,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
