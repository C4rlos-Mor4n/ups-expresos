import { TripStatus } from "../types/route";

export type RouteOperationVariant =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'suspended';

interface RouteStatusMeta {
  label: string;
  variant: RouteOperationVariant;
}

const STATUS_META: Record<TripStatus, RouteStatusMeta> = {
  SCHEDULED: { label: 'Programado', variant: 'scheduled' },
  IN_PROGRESS: { label: 'En recorrido', variant: 'active' },
  COMPLETED: { label: 'Finalizado', variant: 'completed' },
  CANCELLED: { label: 'Cancelado', variant: 'cancelled' },
  SUSPENDED: { label: 'Suspendido', variant: 'suspended' },
};

// Devuelve el texto UI de un estado operativo. Fallback seguro para valores desconocidos.
export function getRouteStatusLabel(status: TripStatus | null | undefined): string {
  if (!status) return 'Sin estado';
  return STATUS_META[status]?.label ?? status;
}

// Devuelve la variante semántica usada para estilos/badges.
export function getRouteStatusVariant(status: TripStatus | null | undefined): RouteOperationVariant {
  if (!status) return 'scheduled';
  return STATUS_META[status]?.variant ?? 'scheduled';
}