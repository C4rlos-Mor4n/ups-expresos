import type {
  Campus,
  DepartureSummary,
  Direction,
  DriverAssignment,
  OperationalState,
  ServiceLine,
  StudentDepartureDetail,
} from "@/types/operational";

/** An invalid API payload is safe to show as an error state, never to render. */
export class OperationalContractError extends Error {
  constructor() {
    super("The operational API returned an invalid response");
    this.name = "OperationalContractError";
  }
}

type RecordValue = Record<string, unknown>;

const directions = new Set<Direction>(["IDA", "RETORNO"]);
const states = new Set<OperationalState>(["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"]);

function fail(): never {
  throw new OperationalContractError();
}

function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as RecordValue;
}

function string(value: unknown): string {
  if (typeof value !== "string") return fail();
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return fail();
  return value;
}

function direction(value: unknown): Direction {
  const parsed = string(value);
  if (!directions.has(parsed as Direction)) return fail();
  return parsed as Direction;
}

function state(value: unknown): OperationalState {
  const parsed = string(value);
  if (!states.has(parsed as OperationalState)) return fail();
  return parsed as OperationalState;
}

function assignmentState(value: unknown): Exclude<OperationalState, "SCHEDULED"> {
  const parsed = state(value);
  if (parsed === "SCHEDULED") return fail();
  return parsed;
}

function runState(value: unknown): Exclude<OperationalState, "SCHEDULED" | "ASSIGNED"> {
  const parsed = assignmentState(value);
  if (parsed === "ASSIGNED") return fail();
  return parsed;
}

function campus(value: unknown): Campus {
  const parsed = record(value);
  return {
    id: string(parsed.id),
    code: string(parsed.code),
    name: string(parsed.name),
    address: nullableString(parsed.address),
  };
}

function campusSummary(value: unknown) {
  const parsed = record(value);
  return { id: string(parsed.id), code: string(parsed.code), name: string(parsed.name) };
}

function serviceLine(value: unknown): ServiceLine {
  const parsed = record(value);
  return {
    id: string(parsed.id),
    code: string(parsed.code),
    name: string(parsed.name),
    description: nullableString(parsed.description),
  };
}

function departureSummary(value: unknown): DepartureSummary {
  const parsed = record(value);
  return {
    id: string(parsed.id),
    serviceDate: string(parsed.serviceDate),
    scheduledTime: string(parsed.scheduledTime),
    direction: direction(parsed.direction),
    state: state(parsed.state),
    assignmentCount: number(parsed.assignmentCount),
  };
}

function studentAssignment(value: unknown): StudentDepartureDetail["assignments"][number] {
  const parsed = record(value);
  const vehicle = record(parsed.vehicle);
  const journey = record(parsed.journey);
  const run = parsed.run === null ? null : record(parsed.run);
  return {
    id: string(parsed.id),
    operationStatus: assignmentState(parsed.operationStatus),
    vehicle: { code: string(vehicle.code), plate: string(vehicle.plate), capacity: number(vehicle.capacity) },
    driverName: nullableString(parsed.driverName),
    plannedStartAt: string(parsed.plannedStartAt),
    plannedEndAt: string(parsed.plannedEndAt),
    journey: {
      routePathId: string(journey.routePathId),
      code: string(journey.code),
      displayName: string(journey.displayName),
      direction: direction(journey.direction),
      stops: array(journey.stops).map((stop) => {
        const parsedStop = record(stop);
        return {
          order: number(parsedStop.order),
          id: string(parsedStop.id),
          name: string(parsedStop.name),
          reference: nullableString(parsedStop.reference),
        };
      }),
    },
    run: run ? {
      status: runState(run.status),
      startedAt: string(run.startedAt),
      completedAt: nullableString(run.completedAt),
    } : null,
  };
}

function driverAssignment(value: unknown): DriverAssignment {
  const parsed = record(value);
  const departure = record(parsed.departure);
  const departureLine = record(departure.serviceLine);
  const vehicle = record(parsed.vehicle);
  const journey = record(parsed.journey);
  const routePath = record(journey.routePath);
  const run = parsed.run === null ? null : record(parsed.run);
  return {
    id: string(parsed.id),
    operationalStatus: assignmentState(parsed.operationalStatus),
    plannedStartAt: string(parsed.plannedStartAt),
    plannedEndAt: string(parsed.plannedEndAt),
    departure: {
      id: string(departure.id),
      serviceDate: string(departure.serviceDate),
      scheduledTime: string(departure.scheduledTime),
      direction: direction(departure.direction),
      serviceLine: { ...serviceLine(departureLine), campus: campusSummary(departureLine.campus) },
    },
    vehicle: { id: string(vehicle.id), code: string(vehicle.code), plate: string(vehicle.plate), capacity: number(vehicle.capacity) },
    journey: {
      id: string(journey.id),
      routePath: {
        id: string(routePath.id),
        code: string(routePath.code),
        displayName: string(routePath.displayName),
        direction: direction(routePath.direction),
        stops: array(routePath.stops).map((stop) => {
          const parsedStop = record(stop);
          const nestedStop = record(parsedStop.stop);
          return {
            stopOrder: number(parsedStop.stopOrder),
            stop: { id: string(nestedStop.id), name: string(nestedStop.name), reference: nullableString(nestedStop.reference) },
          };
        }),
      },
    },
    run: run ? {
      id: string(run.id),
      status: runState(run.status),
      startedAt: string(run.startedAt),
      completedAt: nullableString(run.completedAt),
    } : null,
  };
}

export const operationalContract = {
  campuses(value: unknown): Campus[] { return array(value).map(campus); },
  serviceLines(value: unknown): ServiceLine[] { return array(value).map(serviceLine); },
  departures(value: unknown): DepartureSummary[] { return array(value).map(departureSummary); },
  studentDeparture(value: unknown): StudentDepartureDetail {
    const parsed = record(value);
    const detail = departureSummary(parsed);
    const line = record(parsed.serviceLine);
    return {
      ...detail,
      serviceLine: { ...serviceLine(line), campus: campusSummary(line.campus) },
      assignments: array(parsed.assignments).map(studentAssignment),
    };
  },
  driverAssignments(value: unknown): DriverAssignment[] { return array(value).map(driverAssignment); },
  driverAssignment,
  currentDriverRun(value: unknown): DriverAssignment | null { return value === null ? null : driverAssignment(value); },
};
