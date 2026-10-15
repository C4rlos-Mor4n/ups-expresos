import { describe, expect, it } from "vitest";
import { addDays, formatAge, friendlyError, todayGuayaquil } from "./format";

describe("format", () => {
  it("computes the civil date in Guayaquil", () => {
    expect(todayGuayaquil(new Date("2026-10-15T03:00:00Z"))).toBe("2026-10-14");
    expect(todayGuayaquil(new Date("2026-10-15T06:00:00Z"))).toBe("2026-10-15");
  });
  it("adds days across months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("formats ages and API conflicts", () => {
    expect(formatAge(30)).toBe("hace 30 s");
    expect(formatAge(400)).toBe("hace 7 min");
    expect(friendlyError("VEHICLE_CONFLICT: vehicle has an incompatible planned window")).toBe(
      "Ese bus ya tiene otro servicio en ese horario.",
    );
  });
});
