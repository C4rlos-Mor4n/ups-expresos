import { Stop } from './stop';

export type RouteStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type TripStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SUSPENDED';

export interface CurrentOperationDriver {
  id: string;
  name: string;
}

export interface CurrentOperationVehicle {
  id: string;
  plate: string;
  code: string;
}

// Estado operativo de una ruta expuesto por GET /mobile/routes y GET /mobile/routes/:id.
// El contrato OpenAPI marca driver/vehicle como obligatorios dentro de la operación;
// tripId solo existe cuando hay un recorrido iniciado (no en SCHEDULED).
export interface CurrentOperation {
  status: TripStatus;
  startedAt: string | null;
  tripId?: string | null;
  driver: CurrentOperationDriver | null;
  vehicle: CurrentOperationVehicle | null;
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  direction: string;
  status: RouteStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Forma real de GET /mobile/routes: ruta con su estado operativo actual.
export interface MobileRoute extends Route {
  currentOperation: CurrentOperation | null;
}

export interface RouteStop {
  id: string;
  stopOrder: number;
  estimatedArrivalMinutes?: number | null;
  notes?: string | null;
  stop: Stop;
}

export interface Schedule {
  id: string;
  routeId: string;
  dayOfWeek: DayOfWeek;
  direction: string;
  departureTime: string;
  approximateArrivalTime?: string | null;
  status: string;
}

// Shape real de GET /mobile/routes/:id (backend envuelve route, stops y schedules).
export interface RouteDetailResponse {
  route: Route;
  stops: RouteStop[];
  schedules: Schedule[];
  currentOperation?: CurrentOperation | null;
}

export interface RouteDetail extends Route {
  stops: RouteStop[];
  schedules: Schedule[];
  currentOperation?: CurrentOperation | null;
}