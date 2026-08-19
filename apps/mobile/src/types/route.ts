import { Stop } from './stop';

export type RouteStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

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
}

export interface RouteDetail extends Route {
  stops: RouteStop[];
  schedules: Schedule[];
}
