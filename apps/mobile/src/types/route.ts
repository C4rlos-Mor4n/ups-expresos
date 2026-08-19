import { Stop } from './stop';

export type RouteStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface Route {
  id: string;
  name: string;
  description: string;
  direction: string;
  status: RouteStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RouteStop {
  id: string;
  stopId: string;
  stopOrder: number;
  estimatedArrivalMinutes: number;
  notes: string | null;
  stop: Stop;
}

export interface Schedule {
  id: string;
  routeId: string;
  dayOfWeek: DayOfWeek;
  direction: string;
  departureTime: string;
  approximateArrivalTime: string;
  status: string;
}

export interface RouteDetail extends Route {
  stops: RouteStop[];
  schedules: Schedule[];
}
