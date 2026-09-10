import * as fs from "fs";
import * as path from "path";

type DayName =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

interface ReferenceStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  confidence?: string;
  requiresManualValidation?: boolean;
}

interface ReferenceStopTime {
  stopId: string;
  time: string;
}

interface ReferenceTrip {
  label: string;
  departureTime: string;
  arrivalTime: string;
  stopTimes: ReferenceStopTime[];
}

interface ReferenceService {
  code: string;
  lineCode: string;
  direction: "IDA" | "RETORNO";
  routePathCode: string;
  operatingDays: DayName[];
  trips: ReferenceTrip[];
}

interface ReferenceDataset {
  campuses: { id: string; name: string }[];
  serviceLines: { code: string; name: string }[];
  stops: ReferenceStop[];
  routePaths: {
    code: string;
    lineCode: string;
    direction: "IDA" | "RETORNO";
    displayName: string;
    stopIds: string[];
  }[];
  services: ReferenceService[];
}

describe("Reference Dataset (2026-08-30 → 2026-09-06)", () => {
  let dataset: ReferenceDataset;

  beforeAll(() => {
    const jsonPath = path.resolve(
      __dirname,
      "../../../../../docs/ups_go_routes_reference_guayaquil.json",
    );
    const rawData = fs.readFileSync(jsonPath, "utf8");
    dataset = JSON.parse(rawData);
  });

  it("1. validates date range definitions and structure", () => {
    expect(dataset.campuses.length).toBeGreaterThanOrEqual(2);
    expect(dataset.serviceLines.map((l) => l.code)).toEqual([
      "NORTE",
      "SUR",
      "URB_LA_JOYA",
    ]);
  });

  it("2 & 9. Sunday service has 0 departures (2026-08-30 and 2026-09-06)", () => {
    const sundayServices = dataset.services.filter((s) =>
      s.operatingDays.includes("SUNDAY"),
    );
    expect(sundayServices.length).toBe(0);
  });

  it("3-7. Monday through Friday have 35 canonical departures per day", () => {
    const weekdayDays: DayName[] = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
    ];

    for (const day of weekdayDays) {
      let dayDepartures = 0;
      for (const line of ["NORTE", "SUR", "URB_LA_JOYA"]) {
        for (const dir of ["IDA", "RETORNO"]) {
          const svcs = dataset.services.filter(
            (s) =>
              s.lineCode === line &&
              s.direction === dir &&
              s.operatingDays.includes(day),
          );
          const uniqueTimes = new Set<string>();
          svcs.forEach((s) =>
            s.trips.forEach((t) => uniqueTimes.add(t.departureTime)),
          );
          dayDepartures += uniqueTimes.size;
        }
      }
      expect(dayDepartures).toBe(35);
    }
  });

  it("8. Saturday has 18 canonical departures", () => {
    let saturdayDepartures = 0;
    for (const line of ["NORTE", "SUR", "URB_LA_JOYA"]) {
      for (const dir of ["IDA", "RETORNO"]) {
        const svcs = dataset.services.filter(
          (s) =>
            s.lineCode === line &&
            s.direction === dir &&
            s.operatingDays.includes("SATURDAY"),
        );
        const uniqueTimes = new Set<string>();
        svcs.forEach((s) =>
          s.trips.forEach((t) => uniqueTimes.add(t.departureTime)),
        );
        saturdayDepartures += uniqueTimes.size;
      }
    }
    expect(saturdayDepartures).toBe(18);
  });

  it("10. total departures across range 2026-08-30 to 2026-09-06 is exactly 193", () => {
    const dates: { date: string; day: DayName; expected: number }[] = [
      { date: "2026-08-30", day: "SUNDAY", expected: 0 },
      { date: "2026-08-31", day: "MONDAY", expected: 35 },
      { date: "2026-09-01", day: "TUESDAY", expected: 35 },
      { date: "2026-09-02", day: "WEDNESDAY", expected: 35 },
      { date: "2026-09-03", day: "THURSDAY", expected: 35 },
      { date: "2026-09-04", day: "FRIDAY", expected: 35 },
      { date: "2026-09-05", day: "SATURDAY", expected: 18 },
      { date: "2026-09-06", day: "SUNDAY", expected: 0 },
    ];

    let total = 0;
    for (const item of dates) {
      if (item.day === "SUNDAY") {
        expect(item.expected).toBe(0);
        continue;
      }
      let dayDeps = 0;
      for (const line of ["NORTE", "SUR", "URB_LA_JOYA"]) {
        for (const dir of ["IDA", "RETORNO"]) {
          const svcs = dataset.services.filter(
            (s) =>
              s.lineCode === line &&
              s.direction === dir &&
              s.operatingDays.includes(item.day),
          );
          const uniqueTimes = new Set<string>();
          svcs.forEach((s) =>
            s.trips.forEach((t) => uniqueTimes.add(t.departureTime)),
          );
          dayDeps += uniqueTimes.size;
        }
      }
      expect(dayDeps).toBe(item.expected);
      total += dayDeps;
    }
    expect(total).toBe(193);
  });

  it("11. NORTE weekday has 12 departures/day (6 IDA, 6 RETORNO)", () => {
    const norteWeekdayIda = dataset.services.filter(
      (s) =>
        s.lineCode === "NORTE" &&
        s.direction === "IDA" &&
        s.operatingDays.includes("MONDAY"),
    );
    const idaTimes = new Set<string>();
    norteWeekdayIda.forEach((s) =>
      s.trips.forEach((t) => idaTimes.add(t.departureTime)),
    );
    expect(Array.from(idaTimes).sort()).toEqual([
      "06:20",
      "06:40",
      "08:00",
      "08:30",
      "16:55",
      "17:00",
    ]);
    expect(idaTimes.size).toBe(6);

    const norteWeekdayRet = dataset.services.filter(
      (s) =>
        s.lineCode === "NORTE" &&
        s.direction === "RETORNO" &&
        s.operatingDays.includes("MONDAY"),
    );
    const retTimes = new Set<string>();
    norteWeekdayRet.forEach((s) =>
      s.trips.forEach((t) => retTimes.add(t.departureTime)),
    );
    expect(Array.from(retTimes).sort()).toEqual([
      "12:30",
      "14:30",
      "17:30",
      "18:15",
      "20:05",
      "22:05",
    ]);
    expect(retTimes.size).toBe(6);
  });

  it("12. SUR weekday has 12 departures/day (6 IDA, 6 RETORNO)", () => {
    const surWeekdayIda = dataset.services.filter(
      (s) =>
        s.lineCode === "SUR" &&
        s.direction === "IDA" &&
        s.operatingDays.includes("MONDAY"),
    );
    const idaTimes = new Set<string>();
    surWeekdayIda.forEach((s) =>
      s.trips.forEach((t) => idaTimes.add(t.departureTime)),
    );
    expect(Array.from(idaTimes).sort()).toEqual([
      "06:20",
      "06:40",
      "08:00",
      "08:30",
      "16:55",
      "17:00",
    ]);
    expect(idaTimes.size).toBe(6);

    const surWeekdayRet = dataset.services.filter(
      (s) =>
        s.lineCode === "SUR" &&
        s.direction === "RETORNO" &&
        s.operatingDays.includes("MONDAY"),
    );
    const retTimes = new Set<string>();
    surWeekdayRet.forEach((s) =>
      s.trips.forEach((t) => retTimes.add(t.departureTime)),
    );
    expect(Array.from(retTimes).sort()).toEqual([
      "12:30",
      "14:30",
      "17:30",
      "18:15",
      "20:05",
      "22:05",
    ]);
    expect(retTimes.size).toBe(6);
  });

  it("13 & 14. URB_LA_JOYA weekday has 11 departures/day (5 IDA, 6 RETORNO) with 16:50 deduplicated", () => {
    const joyaWeekdayIda = dataset.services.filter(
      (s) =>
        s.lineCode === "URB_LA_JOYA" &&
        s.direction === "IDA" &&
        s.operatingDays.includes("MONDAY"),
    );
    const idaTimes = new Set<string>();
    joyaWeekdayIda.forEach((s) =>
      s.trips.forEach((t) => idaTimes.add(t.departureTime)),
    );
    expect(Array.from(idaTimes).sort()).toEqual([
      "06:20",
      "06:40",
      "07:40",
      "08:35",
      "16:50",
    ]);
    expect(idaTimes.size).toBe(5);

    const joyaWeekdayRet = dataset.services.filter(
      (s) =>
        s.lineCode === "URB_LA_JOYA" &&
        s.direction === "RETORNO" &&
        s.operatingDays.includes("MONDAY"),
    );
    const retTimes = new Set<string>();
    joyaWeekdayRet.forEach((s) =>
      s.trips.forEach((t) => retTimes.add(t.departureTime)),
    );
    expect(Array.from(retTimes).sort()).toEqual([
      "12:30",
      "14:30",
      "17:30",
      "18:15",
      "20:05",
      "22:05",
    ]);
    expect(retTimes.size).toBe(6);
  });

  it("15. SUR Saturday IDA excludes Mi Comisariato Vía a la Costa", () => {
    const satSurPath = dataset.routePaths.find(
      (rp) => rp.code === "SUR_IDA_SATURDAY",
    );
    expect(satSurPath).toBeDefined();
    expect(satSurPath!.stopIds).not.toContain("STOP_MI_COMISARIATO_VIA_COSTA");
    expect(satSurPath!.stopIds).toEqual([
      "STOP_UPS_CENTENARIO_LA_JOYA",
      "STOP_QUITO_PORTETE",
      "STOP_KFC_17_PORTETE",
      "STOP_PASO_PEATONAL_PUERTO_AZUL",
      "STOP_UPS_MARIA_AUXILIADORA",
    ]);
  });

  it("16. all stop-time sequences are monotonic and have first stop offset = 0", () => {
    const toMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return h! * 60 + m!;
    };

    for (const svc of dataset.services) {
      for (const trip of svc.trips) {
        const depMin = toMinutes(trip.departureTime);
        const arrMin = toMinutes(trip.arrivalTime);
        expect(arrMin).toBeGreaterThanOrEqual(depMin);

        let prevOffset = 0;
        for (const [idx, st] of trip.stopTimes.entries()) {
          const stMin = toMinutes(st.time);
          const offset = stMin - depMin;
          if (idx === 0) {
            expect(offset).toBe(0);
          }
          expect(offset).toBeGreaterThanOrEqual(prevOffset);
          prevOffset = offset;
        }
      }
    }
  });

  it("17 & 18. coordinates and manual validation flags are preserved", () => {
    const stopMap = new Map(dataset.stops.map((s) => [s.id, s]));

    const avicola = stopMap.get("STOP_AVICOLA_FERNANDEZ_AMERICAS")!;
    expect(avicola.confidence).toBe("HIGH");
    expect(avicola.latitude).toBeCloseTo(-2.1423125, 5);
    expect(avicola.longitude).toBeCloseTo(-79.882671875, 5);

    const donLucho = stopMap.get("STOP_DON_LUCHO_GARZOCENTRO")!;
    expect(donLucho.confidence).toBe("MEDIUM");
    expect(donLucho.requiresManualValidation).toBe(true);

    const quitoPortete = stopMap.get("STOP_QUITO_PORTETE")!;
    expect(quitoPortete.confidence).toBe("LOW");
    expect(quitoPortete.requiresManualValidation).toBe(true);
  });
});
