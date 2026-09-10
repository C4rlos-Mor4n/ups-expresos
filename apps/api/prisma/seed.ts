import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSuperAdmins(): Promise<void> {
  const superAdminEmails = (process.env['SUPER_ADMIN_EMAILS'] ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  for (const email of superAdminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'SUPER_ADMIN', emailVerified: true, isActive: true },
      create: { email, role: 'SUPER_ADMIN', emailVerified: true, isActive: true },
    });
  }

  console.log(`Seeded ${superAdminEmails.length} super admin users`);
}

async function main(): Promise<void> {
  await seedSuperAdmins();
  console.log('Core seed completed. Use pnpm prisma:seed:demo for the isolated UPS GO operational demo dataset.');
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
