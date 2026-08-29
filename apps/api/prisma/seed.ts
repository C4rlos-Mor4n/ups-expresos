import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const buildAllowedDomains = (raw: string | undefined): string[] =>
  String(raw ?? 'ups.edu.ec,est.ups.edu.ec')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);

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
  await seedAllowedDomains();
  await seedSuperAdmins();
  console.log('Core seed completed. Use pnpm prisma:seed:demo for the isolated UPS GO operational demo dataset.');
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
