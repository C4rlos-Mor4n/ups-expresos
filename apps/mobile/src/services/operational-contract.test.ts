import {
  OperationalContractError,
  operationalContract,
} from "./operational-contract";

describe("operationalContract.currentDriverRun", () => {
  it("accepts the documented JSON null response from the driver endpoint", () => {
    expect(operationalContract.currentDriverRun(null)).toBeNull();
  });

  it("rejects malformed non-null current-run payloads", () => {
    expect(() => operationalContract.currentDriverRun({})).toThrow(
      OperationalContractError,
    );
    expect(() => operationalContract.currentDriverRun("")).toThrow(
      OperationalContractError,
    );
  });
});

describe("operationalContract.departures", () => {
  it("correctly parses departures with assigned vehicles and route preview", () => {
    const rawPayload = [
      {
        id: "dep-1",
        serviceDate: "2026-08-31",
        scheduledTime: "06:40:00",
        direction: "IDA",
        state: "ASSIGNED",
        assignmentCount: 1,
        originStop: "Campus Centenario - Edificio La Joya",
        destinationStop: "UPS - Campus María Auxiliadora",
        stopsCount: 6,
        assignedVehicles: [
          {
            id: "asg-1",
            code: "BUS-04",
            plate: "GAA-1004",
            driverName: "Andrés Mendoza",
          },
        ],
      },
    ];

    const result = operationalContract.departures(rawPayload);
    expect(result).toHaveLength(1);
    expect(result[0]?.state).toBe("ASSIGNED");
    expect(result[0]?.originStop).toBe("Campus Centenario - Edificio La Joya");
    expect(result[0]?.destinationStop).toBe("UPS - Campus María Auxiliadora");
    expect(result[0]?.stopsCount).toBe(6);
    expect(result[0]?.assignedVehicles).toHaveLength(1);
    expect(result[0]?.assignedVehicles?.[0]?.plate).toBe("GAA-1004");
    expect(result[0]?.assignedVehicles?.[0]?.driverName).toBe("Andrés Mendoza");
  });
});

describe("operationalContract.studentDeparture", () => {
  it("correctly parses golden departure detail for SUR 06:40 with stops and offsets", () => {
    const rawPayload = {
      id: "dep-sur-0640",
      serviceDate: "2026-08-31",
      scheduledTime: "06:40:00",
      direction: "IDA",
      state: "ASSIGNED",
      assignmentCount: 1,
      serviceLine: {
        id: "line-sur",
        code: "SUR",
        name: "Ruta Sur",
        description: "Ruta Sur directa",
        campus: {
          id: "camp-ma",
          code: "UPS_MARIA_AUXILIADORA",
          name: "Campus María Auxiliadora",
        },
      },
      journey: {
        routePathId: "rp-sur-weekday",
        code: "SUR_IDA_WEEKDAY",
        displayName: "Ruta Sur (Ida)",
        direction: "IDA",
        durationMinutes: 65,
        stops: [
          {
            order: 1,
            id: "s-1",
            name: "Campus Centenario - Edificio La Joya",
            reference: "Robles 107 y Chambers",
            latitude: -2.2200375,
            longitude: -79.8881719,
            offsetMinutes: 0,
          },
          {
            order: 2,
            id: "s-2",
            name: "Quito y Portete",
            reference: "Intersección Av. Quito y Portete",
            latitude: -2.2023023,
            longitude: -79.899211,
            offsetMinutes: 15,
          },
          {
            order: 3,
            id: "s-3",
            name: "Parada KFC - 17 y Portete",
            reference: "17 y Portete, junto al KFC",
            latitude: -2.2045612,
            longitude: -79.9126435,
            offsetMinutes: 30,
          },
          {
            order: 4,
            id: "s-4",
            name: "Paso Peatonal Puerto Azul",
            reference: "Paso peatonal frente a Puerto Azul",
            latitude: -2.1866389,
            longitude: -79.9723333,
            offsetMinutes: 45,
          },
          {
            order: 5,
            id: "s-5",
            name: "Mi Comisariato Vía a la Costa",
            reference: "Km 6.9 Vía a la Costa",
            latitude: -2.1793611,
            longitude: -79.9928611,
            offsetMinutes: 50,
          },
          {
            order: 6,
            id: "s-6",
            name: "UPS - Campus María Auxiliadora",
            reference: "Km 19 Vía a la Costa",
            latitude: -2.1983056,
            longitude: -80.0410556,
            offsetMinutes: 65,
          },
        ],
      },
      assignments: [
        {
          id: "asg-1",
          operationStatus: "ASSIGNED",
          vehicle: {
            code: "BUS-04",
            plate: "GAA-1004",
            capacity: 40,
          },
          driverName: "Andrés Mendoza",
          plannedStartAt: "2026-08-31T06:40:00.000Z",
          plannedEndAt: "2026-08-31T07:45:00.000Z",
          journey: {
            routePathId: "rp-sur-weekday",
            code: "SUR_IDA_WEEKDAY",
            displayName: "Ruta Sur (Ida)",
            direction: "IDA",
            durationMinutes: 65,
            stops: [],
          },
          run: null,
        },
      ],
    };

    const parsed = operationalContract.studentDeparture(rawPayload);
    expect(parsed.id).toBe("dep-sur-0640");
    expect(parsed.scheduledTime).toBe("06:40:00");
    expect(parsed.serviceLine.name).toBe("Ruta Sur");
    expect(parsed.journey?.durationMinutes).toBe(65);
    expect(parsed.journey?.stops).toHaveLength(6);
    expect(parsed.journey?.stops[0]?.offsetMinutes).toBe(0);
    expect(parsed.journey?.stops[1]?.offsetMinutes).toBe(15);
    expect(parsed.journey?.stops[5]?.offsetMinutes).toBe(65);
    expect(parsed.assignments[0]?.vehicle.code).toBe("BUS-04");
    expect(parsed.assignments[0]?.vehicle.plate).toBe("GAA-1004");
    expect(parsed.assignments[0]?.vehicle.capacity).toBe(40);
    expect(parsed.assignments[0]?.driverName).toBe("Andrés Mendoza");
  });
});
