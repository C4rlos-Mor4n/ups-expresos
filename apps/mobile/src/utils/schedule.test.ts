import type { DepartureSummary } from "@/types/operational";
import {
  clockToMinutes,
  departureTimeAt,
  formatRelativeDay,
  formatTimeUntil,
  getGuayaquilClock,
  greetingName,
  minutesUntil,
  nextServiceDates,
  splitByClock,
} from "@/utils/schedule";

const departure = (
  id: string,
  scheduledTime: string,
  overrides: Partial<DepartureSummary> = {},
): DepartureSummary => ({
  id,
  serviceDate: "2026-10-01",
  scheduledTime,
  direction: "IDA",
  state: "SCHEDULED",
  assignmentCount: 0,
  stopTimes: [
    { stopId: "origin", name: "Centenario", order: 1, time: scheduledTime.slice(0, 5) },
    { stopId: "kfc", name: "KFC", order: 2, time: "07:10" },
  ],
  ...overrides,
});

describe("schedule utils", () => {
  const clock = { date: "2026-10-01", minutes: clockToMinutes("06:30") };

  it("reads the Guayaquil clock (UTC-5)", () => {
    expect(getGuayaquilClock(new Date("2026-10-02T03:10:00.000Z"))).toEqual({
      date: "2026-10-01",
      minutes: 22 * 60 + 10,
    });
  });

  it("computes minutes until a departure across days", () => {
    expect(minutesUntil("2026-10-01", "06:40:00", clock)).toBe(10);
    expect(minutesUntil("2026-10-01", "06:20", clock)).toBe(-10);
    expect(minutesUntil("2026-10-02", "06:20", clock)).toBe(1430);
  });

  it("formats time until in plain Spanish", () => {
    expect(formatTimeUntil(0)).toBe("Ahora");
    expect(formatTimeUntil(12)).toBe("en 12 min");
    expect(formatTimeUntil(65)).toBe("en 1 h 05 min");
    expect(formatTimeUntil(120)).toBe("en 2 h");
  });

  it("labels relative days", () => {
    expect(formatRelativeDay("2026-10-01", "2026-10-01")).toBe("Hoy");
    expect(formatRelativeDay("2026-10-02", "2026-10-01")).toBe("Mañana");
    expect(formatRelativeDay("2026-10-05", "2026-10-01")).toContain("5 de octubre");
  });

  it("uses the time at the student's stop when available", () => {
    const item = departure("a", "06:20:00");
    expect(departureTimeAt(item, "kfc")).toEqual({ time: "07:10", atStop: true });
    expect(departureTimeAt(item, "missing")).toEqual({ time: "06:20", atStop: false });
    expect(departureTimeAt(item, null)).toEqual({ time: "06:20", atStop: false });
  });

  it("splits departures into upcoming and past, keeping in-progress ones", () => {
    const items = [
      departure("late", "08:00:00"),
      departure("past", "06:00:00"),
      departure("running", "06:10:00", { state: "IN_PROGRESS" }),
      departure("soon", "06:40:00"),
    ];
    const { upcoming, past } = splitByClock(items, clock);
    expect(upcoming.map((item) => item.id)).toEqual(["running", "soon", "late"]);
    expect(past.map((item) => item.id)).toEqual(["past"]);
  });

  it("evaluates past/upcoming at the chosen stop", () => {
    // Salió a las 06:20 del origen, pero pasa por KFC a las 07:10: aún sirve.
    const { upcoming } = splitByClock([departure("a", "06:20:00")], clock, () => "kfc");
    expect(upcoming).toHaveLength(1);
  });

  it("lists the next service dates", () => {
    expect(nextServiceDates("2026-10-30", 3)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("never greets with the email handle", () => {
    expect(greetingName("  Carlos Morán ")).toBe("Carlos");
    expect(greetingName(null)).toBeNull();
    expect(greetingName("   ")).toBeNull();
  });
});
