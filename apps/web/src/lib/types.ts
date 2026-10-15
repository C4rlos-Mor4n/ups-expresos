/** Tipos de las respuestas de la API usadas por el panel (subconjunto del OpenAPI). */
export interface LivePosition {
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number | null;
  occurredAt: string;
  ageSeconds: number;
  freshness: "LIVE" | "STALE" | "OFFLINE";
}
export interface VehicleRef { id: string; code: string; plate: string }
export interface FleetVehicle {
  vehicle: VehicleRef;
  deviceId: string;
  position: LivePosition | null;
  ignition: boolean | null;
  currentRun: {
    assignmentId: string;
    runId: string;
    serviceLineName: string;
    scheduledTime: string;
    direction: string;
    driverName: string;
    startSource: string;
  } | null;
}
export interface TrackingAlert {
  id: string;
  kind: string;
  occurredAt: string;
  description: string | null;
  occurrenceCode: number | null;
  latitude: number;
  longitude: number;
  speedKph: number;
  vehicle: VehicleRef | null;
  deviceAlias: string | null;
}
export interface TrackingDevice {
  id: string;
  provider: string;
  externalId: string;
  alias: string | null;
  label: string | null;
  isActive: boolean;
  vehicle: VehicleRef | null;
  position: LivePosition | null;
  ignition: boolean | null;
  address: string | null;
  createdAt: string;
}
export interface Vehicle { id: string; plate: string; code: string; capacity: number; status: string }
export interface Driver {
  id: string;
  name: string;
  phone?: string | null;
  licenseNumber?: string | null;
  accountEmail?: string | null;
  status: string;
}
export interface Stop { id: string; name: string; reference?: string | null; latitude: number; longitude: number; isActive: boolean }
export interface Paginated<T> { data: T[]; meta: { total: number; page: number; limit: number; totalPages?: number } }
export interface Page<T> { items: T[]; total: number; page: number; limit: number }
export interface Dashboard {
  date: string;
  departures: number;
  departuresWithoutBus: number;
  assignments: number;
  runsInProgress: number;
  runsCompleted: number;
  activeVehicles: number;
  activeDrivers: number;
  vehiclesLive: number;
  unboundDevices: number;
  alerts24h: number;
  users: number;
}
export interface ServiceLine { id: string; code: string; name: string; isActive: boolean; campus: { id: string; name: string } }
export interface AdminAssignment {
  id: string;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  vehicle: VehicleRef & { capacity?: number };
  driver: { id: string; name: string };
  journeyTemplate: { id: string; routePath: { displayName: string } };
  operation: { id: string; status: string; startedAt: string; completedAt: string | null } | null;
}
export interface TimetableDeparture {
  id: string;
  scheduledTime: string;
  direction: string;
  journeyTemplates: Array<{ id: string; routePathId: string; routePathName: string }>;
  assignments: AdminAssignment[];
}
export interface LineTimetable { serviceDate: string; scheduledDepartures: TimetableDeparture[] }
export interface Calendar {
  id: string;
  name: string;
  serviceLine: { id: string; code: string; name: string };
  validFrom: string;
  validUntil: string;
  status: string;
  patternCount: number;
  scheduleTimeCount: number;
}
export interface TimetableRow {
  scheduleTimeId: string;
  direction: string;
  days: string[];
  departureTime: string;
  journeyTemplates: Array<{ id: string; routePath?: { displayName?: string }; stopTimes?: unknown[] }>;
  status: string;
}
export interface AdminUser { id: string; email: string; name: string | null; role: string; isActive: boolean; createdAt: string; lastLoginAt: string | null }
export interface AuditLog { id: string; action: string; entity: string; entityId: string | null; metadata: unknown; createdAt: string; actorEmail: string | null }
