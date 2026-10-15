import type { LiveBus } from "@/types/operational";
import { formatAge, liveStatusCopy, phaseLabel } from "./live";

const bus = (overrides: Partial<LiveBus> = {}): LiveBus => ({
  assignmentId: "a",
  vehicle: { id: "v", code: "BUS-07", plate: "GBA-1234" },
  phase: "IN_PROGRESS",
  plannedStartAt: "2026-10-15T12:00:00Z",
  plannedEndAt: "2026-10-15T13:00:00Z",
  startedAt: "2026-10-15T12:01:00Z",
  startSource: "DRIVER",
  tracking: {
    status: "AVAILABLE",
    position: {
      latitude: -2.1,
      longitude: -79.9,
      speedKph: 32.4,
      heading: 90,
      occurredAt: "2026-10-15T12:10:00Z",
      ageSeconds: 12,
      freshness: "LIVE",
    },
  },
  ...overrides,
});

describe("live helpers", () => {
  it("formats ages", () => {
    expect(formatAge(0)).toBe("hace 1 s");
    expect(formatAge(42)).toBe("hace 42 s");
    expect(formatAge(310)).toBe("hace 5 min");
    expect(formatAge(7300)).toBe("hace 2 h");
  });

  it("describes live, stale and missing positions honestly", () => {
    expect(liveStatusCopy(bus())).toEqual({ title: "En vivo", detail: "Actualizado hace 12 s · 32 km/h", tone: "live" });
    const stale = bus();
    stale.tracking.position = { ...stale.tracking.position!, freshness: "STALE", ageSeconds: 400 };
    expect(liveStatusCopy(stale)).toMatchObject({ title: "Última ubicación conocida", tone: "stale" });
    expect(liveStatusCopy(bus({ tracking: { status: "NO_SIGNAL", position: null } })).title).toBe("Sin señal GPS");
    expect(liveStatusCopy(bus({ tracking: { status: "NO_DEVICE", position: null } }), "driver").title).toBe(
      "Este bus no tiene GPS vinculado",
    );
  });

  it("labels the phase, including automatic starts", () => {
    expect(phaseLabel(bus({ startSource: "SYSTEM" }))).toBe("En recorrido · iniciado automáticamente");
    expect(phaseLabel(bus({ phase: "BEFORE_START" }))).toBe("Aún no inicia el recorrido");
    expect(phaseLabel(bus({ phase: "NOT_LIVE" }))).toBeNull();
  });
});
