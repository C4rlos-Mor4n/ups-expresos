"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { formatDateTime, formatLongDate } from "@/lib/format";
import type { Dashboard, TrackingAlert } from "@/lib/types";
import { Badge, Card, ErrorNote, PageHeader, Spinner, Stat } from "@/components/ui";

export default function DashboardPage() {
  const { data, error } = useSWR<Dashboard>("admin/dashboard", fetcher, { refreshInterval: 30_000 });
  const { data: alerts } = useSWR<TrackingAlert[]>("admin/tracking/alerts?hours=24", fetcher, { refreshInterval: 30_000 });

  return (
    <>
      <PageHeader
        title="Resumen de la operación"
        description={data ? `Hoy, ${formatLongDate(data.date)}` : "Estado del transporte universitario en tiempo real."}
      />
      <ErrorNote error={error} />
      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Salidas de hoy" value={data.departures} hint={`${data.assignments} buses asignados`} />
            <Stat
              label="Salidas sin bus"
              value={data.departuresWithoutBus}
              tone={data.departuresWithoutBus > 0 ? "gold" : "ok"}
              hint="Asígnalas en Salidas"
            />
            <Stat label="En recorrido ahora" value={data.runsInProgress} tone="ok" hint={`${data.runsCompleted} finalizados hoy`} />
            <Stat label="Buses con GPS en vivo" value={data.vehiclesLive} hint={`${data.activeVehicles} buses activos`} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Conductores activos" value={data.activeDrivers} />
            <Stat label="GPS sin vincular" value={data.unboundDevices} tone={data.unboundDevices > 0 ? "gold" : undefined} hint="Vincúlalos en GPS" />
            <Stat label="Alertas (24 h)" value={data.alerts24h} tone={data.alerts24h > 0 ? "danger" : undefined} />
            <Stat label="Usuarios activos" value={data.users} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-navy">Accesos rápidos</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["/salidas", "Asignar buses a las salidas"],
                  ["/monitoreo", "Ver la flota en el mapa"],
                  ["/gps", "Vincular GPS de Hunter"],
                  ["/horarios", "Generar salidas futuras"],
                ].map(([href, label]) => (
                  <Link key={href} href={href!} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">
                    {label} →
                  </Link>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 font-bold text-navy">Alertas recientes</h2>
              {!alerts?.length ? (
                <p className="text-sm text-muted">Sin alertas en las últimas 24 horas.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div>
                        <div className="font-semibold">{a.description ?? `Suceso ${a.occurrenceCode}`}</div>
                        <div className="text-xs text-muted">{a.vehicle ? `${a.vehicle.code} · ${a.vehicle.plate}` : a.deviceAlias ?? "GPS sin vincular"}</div>
                      </div>
                      <Badge tone="danger">{formatDateTime(a.occurredAt)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
