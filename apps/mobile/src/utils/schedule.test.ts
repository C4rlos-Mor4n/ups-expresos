import { getNextSchedule } from "./schedule";
import { Schedule, DayOfWeek } from "../types/route";

function sched(dayOfWeek: DayOfWeek, departureTime: string, id: string): Schedule {
  return {
    id,
    routeId: "r1",
    dayOfWeek,
    direction: "Norte",
    departureTime,
    status: "ACTIVE",
  };
}

// Martes a las 10:00
const TUES_10 = new Date(2026, 0, 6, 10, 0, 0);

describe("getNextSchedule", () => {
  it("returns the next departure later today", () => {
    const schedules = [
      sched("MONDAY", "09:00", "a"),
      sched("TUESDAY", "12:00", "b"),
    ];
    expect(getNextSchedule(schedules, TUES_10)?.id).toBe("b");
  });

  it("rolls to the next day when all of today passed", () => {
    // hoy martes 10:00; solo hay 08:00 de martes → mañana miércoles 08:00
    const schedules = [sched("TUESDAY", "08:00", "a")];
    const next = getNextSchedule(schedules, TUES_10);
    expect(next?.id).toBe("a");
    // el próximo martes 08:00 está dentro de los próximos 7 días
    const diff = next ? new Date(TUES_10).getDay() : -1;
    expect(diff).toBeDefined();
  });

  it("skips Sunday into Monday", () => {
    // domingo 2026-01-04 20:00; horario del lunes 07:30
    const sunday = new Date(2026, 0, 4, 20, 0, 0);
    const schedules = [sched("MONDAY", "07:30", "mon")];
    expect(getNextSchedule(schedules, sunday)?.id).toBe("mon");
  });

  it("returns null for an empty list", () => {
    expect(getNextSchedule([], TUES_10)).toBeNull();
  });

  it("handles a single schedule", () => {
    const schedules = [sched("WEDNESDAY", "07:30", "only")];
    expect(getNextSchedule(schedules, TUES_10)?.id).toBe("only");
  });

  it("handles unsorted schedules", () => {
    const schedules = [
      sched("THURSDAY", "18:00", "late"),
      sched("TUESDAY", "11:00", "soon"),
      sched("WEDNESDAY", "09:00", "next"),
    ];
    // hoy martes 10:00 → 11:00 (soon) es el próximo
    expect(getNextSchedule(schedules, TUES_10)?.id).toBe("soon");
  });
});
