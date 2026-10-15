"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { DIRECTION_LABEL, formatAge, formatDateTime, STATUS_LABEL } from "@/lib/format";
import type { FleetVehicle, TrackingAlert } from "@/lib/types";
import { FleetMap, type MapBus } from "@/components/fleet-map";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, statusTone } from "@/components/ui";

export default function MonitoringPage() {
  const { data: fleet, error } = useSWR<FleetVehicle[]>("admin/tracking/fleet", fetcher, { refreshInterval: 10_000 });
  const { data: alerts } = useSWR<TrackingAlert[]>("admin/tracking/alerts?hours=12", fetcher, { refreshInterval: 15_000 });
  const [focus, setFocus] = useState<string | null>(null);

  const buses = useMemo<MapBus[]>(
    () =>
      (fleet ?? [])
        .filter((f) => f.position)
        .map((f) => ({
          id: f.vehicle.id,
          latitude: f.position!.latitude,
          longitude: f.position!.longitude,
          heading: f.position!.heading,
          label: f.vehicle.code,
          tone: f.position!.freshness === "LIVE" ? (f.currentRun ? "live" : "idle") : "stale",
          popup: `<b>${f.vehicle.code}</b> · ${f.vehicle.plate}<br>${f.currentRun ? `${f.currentRun.serviceLineName} ${f.currentRun.scheduledTime}` : "Sin recorrido en curso"}`,
        })),
    [fleet],
  );

  return (
    <>
      <PageHeader
        title="Monitoreo en vivo"
        description="Ubicación de los buses según el GPS de Hunter. Se actualiza cada 10 segundos. Verde: en recorrido; gris: sin recorrido; ámbar: señal atrasada."
      />
      <ErrorNote error={error} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-2">
          {buses.length ? (
            <FleetMap buses={buses} focusId={focus} className="h-[560px] w-full rounded-xl" />
          ) : (
            <EmptyState
              title="Sin buses con GPS reportando"
              message="Cuando Hunter envíe reportes de un GPS vinculado a un bus, aparecerá aquí. Vincula los equipos en la sección GPS."
            />
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-0">
            <div className="border-b border-line px-4 py-3 font-bold text-navy">Flota ({fleet?.length ?? 0})</div>
            <ul className="max-h-[320px] divide-y divide-line overflow-y-auto">
              {(fleet ?? []).map((f) => (
                <li key={f.vehicle.id}>
                  <button className="w-full px-4 py-3 text-left hover:bg-canvas" onClick={() => setFocus(f.vehicle.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{f.vehicle.code} · {f.vehicle.plate}</span>
                      <Badge tone={statusTone(f.position?.freshness ?? "OFFLINE")}>
                        {STATUS_LABEL[f.position?.freshness ?? "OFFLINE"]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {f.currentRun
                        ? `${f.currentRun.serviceLineName} · ${f.currentRun.scheduledTime} · ${DIRECTION_LABEL[f.currentRun.direction] ?? f.currentRun.direction} · ${f.currentRun.driverName}${f.currentRun.startSource === "SYSTEM" ? " · inicio automático" : ""}`
                        : "Sin recorrido en curso"}
                    </div>
                    {f.position ? (
                      <div className="text-xs text-muted">
                        {formatAge(f.position.ageSeconds)} · {Math.round(f.position.speedKph)} km/h · motor {f.ignition ? "encendido" : f.ignition === false ? "apagado" : "—"}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-0">
            <div className="border-b border-line px-4 py-3 font-bold text-navy">Alertas (12 h)</div>
            {!alerts?.length ? (
              <p className="px-4 py-4 text-sm text-muted">Sin alertas.</p>
            ) : (
              <ul className="max-h-[260px] divide-y divide-line overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <div className="font-semibold text-danger">{a.description ?? `Suceso ${a.occurrenceCode}`}</div>
                    <div className="text-xs text-muted">
                      {a.vehicle ? `${a.vehicle.code} · ` : ""}{formatDateTime(a.occurredAt)} · {Math.round(a.speedKph)} km/h
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
