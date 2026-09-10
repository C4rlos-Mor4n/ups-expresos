import {
  addMinutesToOperationalTime,
  formatDuration,
  formatOperationalTime,
  getDirectionLabel,
  getOperationalStateMeta,
  getGuayaquilToday,
  getGuayaquilCurrentTime,
  shiftCivilDate,
} from "@/utils/operational";

describe("operational presentation helpers", () => {
  it("maps every server operational state to a Spanish label", () => {
    expect(getOperationalStateMeta("SCHEDULED").label).toBe("Programado");
    expect(getOperationalStateMeta("ASSIGNED").label).toBe("Asignado");
    expect(getOperationalStateMeta("IN_PROGRESS").label).toBe("En recorrido");
    expect(getOperationalStateMeta("COMPLETED").label).toBe("Finalizado");
  });

  it("does not transform a scheduled time into a device-local instant", () => {
    expect(formatOperationalTime("06:40:00")).toBe("06:40");
  });

  it("keeps date navigation in civil-date form", () => {
    expect(shiftCivilDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(getGuayaquilToday(new Date("2026-08-29T02:00:00.000Z"))).toBe(
      "2026-08-28",
    );
    expect(getGuayaquilCurrentTime(new Date("2026-08-29T17:30:00.000Z"))).toBe(
      "12:30",
    ); // UTC 17:30 = Guayaquil (UTC-5) 12:30
  });

  it("formats duration according to standards", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(65)).toBe("1 h 5 min");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });

  it("calculates scheduled stop time with exact offset and handles midnight rollover", () => {
    expect(addMinutesToOperationalTime("06:40", 0)).toBe("06:40");
    expect(addMinutesToOperationalTime("06:40", 15)).toBe("06:55");
    expect(addMinutesToOperationalTime("06:40", 30)).toBe("07:10");
    expect(addMinutesToOperationalTime("06:40", 45)).toBe("07:25");
    expect(addMinutesToOperationalTime("06:40", 50)).toBe("07:30");
    expect(addMinutesToOperationalTime("06:40", 65)).toBe("07:45");
    expect(addMinutesToOperationalTime("23:50", 30)).toBe("00:20");
  });

  it("uses human direction labels", () => {
    expect(getDirectionLabel("IDA")).toBe("Ida");
    expect(getDirectionLabel("RETORNO")).toBe("Retorno");
  });
});
