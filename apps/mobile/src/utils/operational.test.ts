import { formatOperationalTime, getDirectionLabel, getOperationalStateMeta, getGuayaquilToday, shiftCivilDate } from "@/utils/operational";

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
    expect(getGuayaquilToday(new Date("2026-08-29T02:00:00.000Z"))).toBe("2026-08-28");
  });

  it("uses human direction labels", () => {
    expect(getDirectionLabel("IDA")).toBe("Ida");
    expect(getDirectionLabel("RETORNO")).toBe("Retorno");
  });
});
