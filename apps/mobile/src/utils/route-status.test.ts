import { getRouteStatusLabel, getRouteStatusVariant } from "./route-status";
import { TripStatus } from "../types/route";

describe("getRouteStatusLabel", () => {
  it("maps SCHEDULED to Programado", () => {
    expect(getRouteStatusLabel("SCHEDULED")).toBe("Programado");
  });

  it("maps IN_PROGRESS to En recorrido", () => {
    expect(getRouteStatusLabel("IN_PROGRESS")).toBe("En recorrido");
  });

  it("maps COMPLETED to Finalizado", () => {
    expect(getRouteStatusLabel("COMPLETED")).toBe("Finalizado");
  });

  it("maps CANCELLED to Cancelado", () => {
    expect(getRouteStatusLabel("CANCELLED")).toBe("Cancelado");
  });

  it("maps SUSPENDED to Suspendido", () => {
    expect(getRouteStatusLabel("SUSPENDED")).toBe("Suspendido");
  });

  it("returns 'Sin estado' for null/undefined", () => {
    expect(getRouteStatusLabel(null)).toBe("Sin estado");
    expect(getRouteStatusLabel(undefined)).toBe("Sin estado");
  });
});

describe("getRouteStatusVariant", () => {
  it("maps each status to its semantic variant", () => {
    expect(getRouteStatusVariant("SCHEDULED")).toBe("scheduled");
    expect(getRouteStatusVariant("IN_PROGRESS")).toBe("active");
    expect(getRouteStatusVariant("COMPLETED")).toBe("completed");
    expect(getRouteStatusVariant("CANCELLED")).toBe("cancelled");
    expect(getRouteStatusVariant("SUSPENDED")).toBe("suspended");
  });

  it("falls back to scheduled for null/undefined", () => {
    expect(getRouteStatusVariant(null)).toBe("scheduled");
    expect(getRouteStatusVariant(undefined)).toBe("scheduled");
  });
});

describe("all TripStatus values are covered", () => {
  it("handles every value in the TripStatus union", () => {
    const all: TripStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "SUSPENDED"];
    for (const status of all) {
      expect(getRouteStatusLabel(status).length).toBeGreaterThan(0);
      expect(getRouteStatusVariant(status).length).toBeGreaterThan(0);
    }
  });
});