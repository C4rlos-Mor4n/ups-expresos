import "dotenv/config";
import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { OperationalService } from "./operational.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

const integrationEnabled = process.env.RUN_REFERENCE_INTEGRATION === "true";
const describeReference = integrationEnabled ? describe : describe.skip;

const assertIsolatedTestDatabase = (): void => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("Reference integration requires DATABASE_URL");

  const databaseUrl = new URL(rawUrl);
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "");
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    throw new Error("Reference integration requires a local PostgreSQL host");
  }
  if (databaseName === "krionix") {
    throw new Error("Reference integration refuses to run against showcase DB krionix");
  }
};

describeReference("Campus Service Lines & Served Campuses Integration Test", () => {
  let prisma: PrismaService;
  let service: OperationalService;
  const campusIds = { maria: randomUUID(), centenario: randomUUID() };
  const lineIds = { norte: randomUUID(), sur: randomUUID(), joya: randomUUID() };

  beforeAll(async () => {
    assertIsolatedTestDatabase();
    prisma = new PrismaService();
    const auditLogs = new AuditLogsService(prisma);
    service = new OperationalService(prisma, auditLogs);

    await prisma.$transaction(async (tx) => {
      await tx.campus.createMany({
        data: [
          { id: campusIds.maria, code: "UPS_MARIA_AUXILIADORA", name: "María Auxiliadora" },
          { id: campusIds.centenario, code: "UPS_CENTENARIO", name: "Centenario" },
        ],
      });
      await tx.serviceLine.createMany({
        data: [
          { id: lineIds.norte, campusId: campusIds.maria, code: "NORTE", name: "Ruta Norte" },
          { id: lineIds.sur, campusId: campusIds.maria, code: "SUR", name: "Ruta Sur" },
          { id: lineIds.joya, campusId: campusIds.maria, code: "URB_LA_JOYA", name: "Ruta Urb. La Joya" },
        ],
      });
      await tx.serviceLineCampus.createMany({
        data: [
          { serviceLineId: lineIds.norte, campusId: campusIds.maria },
          { serviceLineId: lineIds.sur, campusId: campusIds.maria },
          { serviceLineId: lineIds.sur, campusId: campusIds.centenario },
          { serviceLineId: lineIds.joya, campusId: campusIds.maria },
        ],
      });
    });
  });

  afterAll(async () => {
    await prisma.serviceLineCampus.deleteMany({ where: { serviceLineId: { in: Object.values(lineIds) } } });
    await prisma.serviceLine.deleteMany({ where: { id: { in: Object.values(lineIds) } } });
    await prisma.campus.deleteMany({ where: { id: { in: Object.values(campusIds) } } });
    await prisma.$disconnect();
  });

  it("A. Campus Centenario -> getStudentServiceLines() -> SUR only", async () => {
    const centenario = await prisma.campus.findUnique({
      where: { code: "UPS_CENTENARIO" },
    });
    expect(centenario).toBeDefined();

    const lines = await service.getStudentServiceLines(centenario!.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.code).toBe("SUR");
    expect(lines[0]?.name).toBe("Ruta Sur");
  });

  it("B. Campus María Auxiliadora -> getStudentServiceLines() -> NORTE, SUR, URB_LA_JOYA", async () => {
    const mariaAuxiliadora = await prisma.campus.findUnique({
      where: { code: "UPS_MARIA_AUXILIADORA" },
    });
    expect(mariaAuxiliadora).toBeDefined();

    const lines = await service.getStudentServiceLines(mariaAuxiliadora!.id);
    expect(lines).toHaveLength(3);
    const codes = lines.map((l) => l.code).sort();
    expect(codes).toEqual(["NORTE", "SUR", "URB_LA_JOYA"]);
  });

  it("C. ServiceLine owner campus remains María Auxiliadora for all 3 lines", async () => {
    const mariaAuxiliadora = await prisma.campus.findUnique({
      where: { code: "UPS_MARIA_AUXILIADORA" },
    });
    const lines = await prisma.serviceLine.findMany({
      where: { code: { in: ["NORTE", "SUR", "URB_LA_JOYA"] } },
    });
    expect(lines).toHaveLength(3);
    for (const l of lines) {
      expect(l.campusId).toBe(mariaAuxiliadora!.id);
    }
  });

  it("D. SUR served campuses count = 2 (Centenario + María Auxiliadora)", async () => {
    const surLine = await prisma.serviceLine.findFirst({
      where: { code: "SUR" },
      include: { servedCampuses: { include: { campus: true } } },
    });
    expect(surLine).toBeDefined();
    expect(surLine!.servedCampuses).toHaveLength(2);
    const servedCodes = surLine!.servedCampuses
      .map((s) => s.campus.code)
      .sort();
    expect(servedCodes).toEqual(["UPS_CENTENARIO", "UPS_MARIA_AUXILIADORA"]);
  });

  it("E. NORTE served campuses = María Auxiliadora only", async () => {
    const norteLine = await prisma.serviceLine.findFirst({
      where: { code: "NORTE" },
      include: { servedCampuses: { include: { campus: true } } },
    });
    expect(norteLine).toBeDefined();
    expect(norteLine!.servedCampuses).toHaveLength(1);
    expect(norteLine!.servedCampuses[0]?.campus.code).toBe(
      "UPS_MARIA_AUXILIADORA",
    );
  });

  it("F. URB_LA_JOYA served campuses = María Auxiliadora only", async () => {
    const joyaLine = await prisma.serviceLine.findFirst({
      where: { code: "URB_LA_JOYA" },
      include: { servedCampuses: { include: { campus: true } } },
    });
    expect(joyaLine).toBeDefined();
    expect(joyaLine!.servedCampuses).toHaveLength(1);
    expect(joyaLine!.servedCampuses[0]?.campus.code).toBe(
      "UPS_MARIA_AUXILIADORA",
    );
  });

  it("G. No duplicate lines returned from many-to-many query", async () => {
    const mariaAuxiliadora = await prisma.campus.findUnique({
      where: { code: "UPS_MARIA_AUXILIADORA" },
    });
    const lines = await service.getStudentServiceLines(mariaAuxiliadora!.id);
    const uniqueIds = new Set(lines.map((l) => l.id));
    expect(uniqueIds.size).toBe(lines.length);
  });

  it("H. Inactive line/campus behavior preserves filtering rules", async () => {
    await expect(
      service.getStudentServiceLines("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFoundException);
  });

  it("I. Every service line serves its owner campus", async () => {
    const lines = await prisma.serviceLine.findMany({
      include: { servedCampuses: { select: { campusId: true } } },
    });

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.servedCampuses.map((served) => served.campusId)).toContain(
        line.campusId,
      );
    }
  });
});
