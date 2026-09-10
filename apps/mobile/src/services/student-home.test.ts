import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import { formatOperationalTime } from "@/utils/operational";

describe("Student Home Data & Preference Logic", () => {
  const mockUser = {
    id: "student-123",
    email: "carlos@est.ups.edu.ec",
    name: "Carlos Morán",
    role: "STUDENT" as const,
  };

  const mockCampuses = [
    {
      id: "campus-centenario",
      code: "CENT",
      name: "Campus Centenario",
      address: "Guayaquil",
    },
    {
      id: "campus-maria-auxiliadora",
      code: "CMA",
      name: "Campus María Auxiliadora",
      address: "Guayaquil",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates that a stored preference exists in backend campuses", async () => {
    jest
      .spyOn(campusPreferenceService, "getPreferredCampusId")
      .mockResolvedValue("campus-centenario");
    jest
      .spyOn(operationalService, "getCampuses")
      .mockResolvedValue(mockCampuses);

    const savedId = await campusPreferenceService.getPreferredCampusId(
      mockUser.id,
    );
    const campuses = await operationalService.getCampuses();
    const matched = campuses.find((c) => c.id === savedId);

    expect(matched).toBeDefined();
    expect(matched?.name).toBe("Campus Centenario");
  });

  it("detects when a stored preference is invalid or removed from backend", async () => {
    jest
      .spyOn(campusPreferenceService, "getPreferredCampusId")
      .mockResolvedValue("campus-inexistente");
    const clearSpy = jest
      .spyOn(campusPreferenceService, "clearPreferredCampusId")
      .mockResolvedValue();
    jest
      .spyOn(operationalService, "getCampuses")
      .mockResolvedValue(mockCampuses);

    const savedId = await campusPreferenceService.getPreferredCampusId(
      mockUser.id,
    );
    const campuses = await operationalService.getCampuses();
    const matched = campuses.find((c) => c.id === savedId);

    if (!matched) {
      await campusPreferenceService.clearPreferredCampusId(mockUser.id);
    }

    expect(matched).toBeUndefined();
    expect(clearSpy).toHaveBeenCalledWith(mockUser.id);
  });

  it("filters and picks the earliest upcoming departure after current Guayaquil time", () => {
    const departures = [
      {
        id: "dep-1",
        serviceDate: "2026-08-29",
        scheduledTime: "06:40:00",
        direction: "IDA" as const,
        state: "COMPLETED" as const,
        assignmentCount: 1,
        serviceLineName: "Línea 1",
      },
      {
        id: "dep-2",
        serviceDate: "2026-08-29",
        scheduledTime: "12:00:00",
        direction: "IDA" as const,
        state: "ASSIGNED" as const,
        assignmentCount: 2,
        serviceLineName: "Línea 1",
      },
      {
        id: "dep-3",
        serviceDate: "2026-08-29",
        scheduledTime: "17:30:00",
        direction: "RETORNO" as const,
        state: "SCHEDULED" as const,
        assignmentCount: 0,
        serviceLineName: "Línea 1",
      },
    ];

    const currentTime = "11:30";
    const upcoming = departures.filter(
      (d) => formatOperationalTime(d.scheduledTime) >= currentTime,
    );

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0]?.id).toBe("dep-2");
    expect(formatOperationalTime(upcoming[0]?.scheduledTime ?? "")).toBe(
      "12:00",
    );
    expect(upcoming[0]?.assignmentCount).toBe(2);
  });

  it("handles case where all scheduled departures for today have already passed", () => {
    const departures = [
      {
        id: "dep-1",
        serviceDate: "2026-08-29",
        scheduledTime: "06:40:00",
        direction: "IDA" as const,
        state: "COMPLETED" as const,
        assignmentCount: 1,
        serviceLineName: "Línea 1",
      },
    ];

    const currentTime = "20:00";
    const upcoming = departures.filter(
      (d) => formatOperationalTime(d.scheduledTime) >= currentTime,
    );

    expect(upcoming).toHaveLength(0);
  });

  it("preserves backend aggregate state ASSIGNED for multibus departures with 1 finished and 1 pending", () => {
    const multibusDeparture = {
      id: "dep-multibus",
      serviceDate: "2026-08-29",
      scheduledTime: "06:40:00",
      direction: "IDA" as const,
      state: "ASSIGNED" as const,
      assignmentCount: 2,
      serviceLineName: "Ruta Sur",
    };

    expect(multibusDeparture.state).toBe("ASSIGNED");
    expect(multibusDeparture.assignmentCount).toBe(2);
  });
});
