import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, registerAs } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaModule } from "../../database/prisma.module";
import { PrismaService } from "../../database/prisma.service";
import { MailService } from "./mail/mail.service";
import type { AppConfig } from "../../config/app.config";

const testAppConfig = registerAs<AppConfig>("app", () => ({
  nodeEnv: "test",
  port: 3000,
  appName: "test-app",
  database: { url: "postgresql://test" },
  jwt: {
    accessSecret: "jwt-access-test-secret-min-32-chars-long!",
    refreshSecret: "jwt-refresh-test-secret-min-32-chars-long!",
    accessExpiresIn: "15m",
    refreshExpiresIn: "7d",
  },
  otp: { expiresMinutes: 10, maxAttempts: 5 },
  auth: {
    devExposeOtp: true,
    allowedDomains: ["est.ups.edu.ec", "ups.edu.ec"],
    superAdminEmails: ["carlitosmoran245@gmail.com"],
  },
  cors: { origins: ["*"] },
  trustProxyHops: 0,
  swagger: { enabled: false, path: "/docs" },
  throttle: {
    ttl: 60000,
    limit: 10,
  },
  smtp: { secure: false },
}));

const integrationEnabled = process.env.RUN_AUTH_INTEGRATION === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;

const assertIsolatedTestDatabase = (): void => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("Auth integration requires DATABASE_URL");

  const databaseUrl = new URL(rawUrl);
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "");
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    throw new Error("Auth integration requires a local PostgreSQL host");
  }
  if (databaseName === "krionix") {
    throw new Error("Auth integration refuses to run against showcase DB krionix");
  }
};

describeIntegration("Auth Roles & Demo Accounts Integration Test", () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    assertIsolatedTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [testAppConfig],
        }),
        JwtModule.register({}),
        PrismaModule,
      ],
      providers: [
        AuthService,
        {
          provide: MailService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.user.createMany({
      data: [
        {
          email: "carlosmoran.v28@gmail.com",
          role: UserRole.DRIVER,
          emailVerified: true,
        },
        {
          email: "carlosmoranvasquez26@gmail.com",
          role: UserRole.STUDENT,
          emailVerified: true,
        },
        {
          email: "carlitosmoran245@gmail.com",
          role: UserRole.SUPER_ADMIN,
          emailVerified: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { email: { in: [
        "carlosmoran.v28@gmail.com",
        "carlosmoranvasquez26@gmail.com",
        "carlitosmoran245@gmail.com",
      ] } } },
    });
    await prisma.authVerificationCode.deleteMany({
      where: { email: { in: [
        "carlosmoran.v28@gmail.com",
        "carlosmoranvasquez26@gmail.com",
        "carlitosmoran245@gmail.com",
      ] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [
        "carlosmoran.v28@gmail.com",
        "carlosmoranvasquez26@gmail.com",
        "carlitosmoran245@gmail.com",
      ] } },
    });
    await prisma.$disconnect();
  });

  it("preserves DRIVER role for carlosmoran.v28@gmail.com on requestCode and verifyCode", async () => {
    const email = "carlosmoran.v28@gmail.com";
    const req = await service.requestCode({ email });
    expect(req.message).toBe("Verification code sent");

    const verification = await prisma.authVerificationCode.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(verification).toBeDefined();

    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(userInDb?.role).toBe(UserRole.DRIVER);

    const me = await service.getMe(userInDb!.id);
    expect(me.role).toBe(UserRole.DRIVER);
    expect(me.email).toBe(email);
  });

  it("preserves STUDENT role for carlosmoranvasquez26@gmail.com", async () => {
    const email = "carlosmoranvasquez26@gmail.com";
    await service.requestCode({ email });

    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(userInDb?.role).toBe(UserRole.STUDENT);

    const me = await service.getMe(userInDb!.id);
    expect(me.role).toBe(UserRole.STUDENT);
  });

  it("preserves SUPER_ADMIN role for carlitosmoran245@gmail.com", async () => {
    const email = "carlitosmoran245@gmail.com";
    await service.requestCode({ email });

    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(userInDb?.role).toBe(UserRole.SUPER_ADMIN);

    const me = await service.getMe(userInDb!.id);
    expect(me.role).toBe(UserRole.SUPER_ADMIN);
  });

  it("rejects unknown user with non-allowed domain (e.g. unknown@gmail.com)", async () => {
    await prisma.authVerificationCode.deleteMany({
      where: { email: "stranger.unknown@gmail.com" },
    });
    await prisma.user.deleteMany({
      where: { email: "stranger.unknown@gmail.com" },
    });

    await expect(
      service.requestCode({ email: "stranger.unknown@gmail.com" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("allows unknown user with allowed institutional domain (e.g. new@est.ups.edu.ec)", async () => {
    const newStudentEmail = "newstudent.test@est.ups.edu.ec";
    await prisma.authVerificationCode.deleteMany({
      where: { email: newStudentEmail },
    });
    await prisma.user.deleteMany({ where: { email: newStudentEmail } });

    const req = await service.requestCode({ email: newStudentEmail });
    expect(req.message).toBe("Verification code sent");

    const createdUser = await prisma.user.findUnique({
      where: { email: newStudentEmail },
    });
    expect(createdUser?.role).toBe(UserRole.STUDENT);

    await prisma.authVerificationCode.deleteMany({
      where: { email: newStudentEmail },
    });
    await prisma.user.deleteMany({ where: { email: newStudentEmail } });
  });

  it("rejects deactivated user account", async () => {
    const testInactiveEmail = "test.inactive.driver@ups.edu.ec";
    await prisma.user.upsert({
      where: { email: testInactiveEmail },
      update: { isActive: false, role: UserRole.DRIVER },
      create: {
        email: testInactiveEmail,
        isActive: false,
        role: UserRole.DRIVER,
      },
    });

    await expect(
      service.requestCode({ email: testInactiveEmail }),
    ).rejects.toThrow(UnauthorizedException);

    await prisma.user.delete({ where: { email: testInactiveEmail } });
  });

  it("handles second-login OTP reuse lifecycle correctly: resets usedAt to null, allows second login, and invalidates old OTP", async () => {
    const email = "otp.lifecycle.test@est.ups.edu.ec";
    await prisma.session.deleteMany({ where: { user: { email } } });
    await prisma.authVerificationCode.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });

    // Step 1: First requestCode
    const req1 = await service.requestCode({ email });
    expect(req1.devCode).toBeDefined();
    const otp1 = req1.devCode!;

    // Step 2: First verifyCode (consume OTP1)
    const auth1 = await service.verifyCode({ email, code: otp1 });
    expect(auth1.accessToken).toBeDefined();
    expect(auth1.user.email).toBe(email);

    // Step 3: Check in DB that record is consumed
    const recordAfterFirstLogin = await prisma.authVerificationCode.findUnique({
      where: { email },
    });
    expect(recordAfterFirstLogin).toBeDefined();
    expect(recordAfterFirstLogin?.usedAt).not.toBeNull();
    const firstCodeHash = recordAfterFirstLogin?.codeHash;

    // Step 4: Second requestCode for same user
    const req2 = await service.requestCode({ email });
    expect(req2.devCode).toBeDefined();
    const otp2 = req2.devCode!;

    // Step 5: Check in DB that the same record is reset
    const recordAfterSecondRequest =
      await prisma.authVerificationCode.findUnique({
        where: { email },
      });
    expect(recordAfterSecondRequest?.usedAt).toBeNull();
    expect(recordAfterSecondRequest?.attempts).toBe(0);
    expect(recordAfterSecondRequest?.expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(recordAfterSecondRequest?.codeHash).not.toBe(firstCodeHash);

    // Step 6: Old OTP1 must be rejected
    await expect(service.verifyCode({ email, code: otp1 })).rejects.toThrow(
      UnauthorizedException,
    );

    // Step 7: Second verifyCode with new OTP2 succeeds
    const auth2 = await service.verifyCode({ email, code: otp2 });
    expect(auth2.accessToken).toBeDefined();
    expect(auth2.user.email).toBe(email);

    // Step 8: Verify record is consumed again
    const finalRecord = await prisma.authVerificationCode.findUnique({
      where: { email },
    });
    expect(finalRecord?.usedAt).not.toBeNull();

    // Clean up
    await prisma.session.deleteMany({ where: { user: { email } } });
    await prisma.authVerificationCode.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
  });
});
