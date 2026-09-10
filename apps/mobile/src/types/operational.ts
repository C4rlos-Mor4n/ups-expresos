export type Direction = "IDA" | "RETORNO";

export type OperationalState =
  | "SCHEDULED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface Campus {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

export interface ServiceLine {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface CampusSummary {
  id: string;
  code: string;
  name: string;
}

export interface AssignedVehiclePreview {
  id: string;
  code: string;
  plate: string;
  driverName: string | null;
}

export interface DepartureSummary {
  id: string;
  serviceDate: string;
  scheduledTime: string;
  direction: Direction;
  state: OperationalState;
  assignmentCount: number;
  originStop?: string | null;
  destinationStop?: string | null;
  stopsCount?: number;
  assignedVehicles?: AssignedVehiclePreview[];
}

export interface VehicleSummary {
  code: string;
  plate: string;
  capacity: number;
}

export interface JourneyStop {
  order: number;
  id: string;
  name: string;
  reference: string | null;
  latitude?: number | null;
  longitude?: number | null;
  offsetMinutes?: number;
}

export interface StudentJourney {
  routePathId: string;
  code: string;
  displayName: string;
  direction: Direction;
  durationMinutes?: number;
  stops: JourneyStop[];
}

export interface StudentAssignment {
  id: string;
  operationStatus: Exclude<OperationalState, "SCHEDULED">;
  vehicle: VehicleSummary;
  driverName: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  journey: StudentJourney;
  run: {
    status: Exclude<OperationalState, "SCHEDULED" | "ASSIGNED">;
    startedAt: string;
    completedAt: string | null;
  } | null;
}

export interface StudentDepartureDetail extends DepartureSummary {
  serviceLine: ServiceLine & { campus: CampusSummary };
  journey?: StudentJourney | null;
  assignments: StudentAssignment[];
}

export interface DriverRouteStop {
  stopOrder: number;
  stop: {
    id: string;
    name: string;
    reference: string | null;
  };
}

export interface DriverAssignment {
  id: string;
  operationalStatus: Exclude<OperationalState, "SCHEDULED">;
  plannedStartAt: string;
  plannedEndAt: string;
  departure: {
    id: string;
    serviceDate: string;
    scheduledTime: string;
    direction: Direction;
    serviceLine: ServiceLine & { campus: CampusSummary };
  };
  vehicle: VehicleSummary & { id: string };
  journey: {
    id: string;
    routePath: {
      id: string;
      code: string;
      displayName: string;
      direction: Direction;
      stops: DriverRouteStop[];
    };
  };
  run: {
    id: string;
    status: Exclude<OperationalState, "SCHEDULED" | "ASSIGNED">;
    startedAt: string;
    completedAt: string | null;
  } | null;
}
