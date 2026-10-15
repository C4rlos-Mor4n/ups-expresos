"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { formatAge, formatDateTime, friendlyError, STATUS_LABEL } from "@/lib/format";
import type { Paginated, TrackingDevice, Vehicle } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, Select, Table, Td, statusTone } from "@/components/ui";

export default function GpsPage() {
  const { data: devices, error, mutate } = useSWR<TrackingDevice[]>("admin/tracking/devices", fetcher, { refreshInterval: 15_000 });
  const { data: vehicles } = useSWR<Paginated<Vehicle>>("admin/vehicles?limit=100", fetcher);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setActionError(friendlyError((e as Error).message));
    }
  };

  const bind = (device: TrackingDevice, vehicleId: string) =>
    void act(() => send("PUT", `admin/tracking/devices/${device.id}/vehicle`, { vehicleId: vehicleId || null }));

  const takenBy = new Map((devices ?? []).filter((d) => d.vehicle).map((d) => [d.vehicle!.id, d.id]));

  return (
    <>
      <PageHeader
        title="GPS de los buses (Hunter)"
        description="Cada equipo GPS aparece aquí al enviar su primer reporte a UPS GO. Vincúlalo al bus donde está instalado para que estudiantes y conductores lo vean en el mapa."
      />
      <Card className="mb-6 text-sm text-muted">
        <b className="text-navy">Configuración en Hunter:</b> URL{" "}
        <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">https://&lt;dominio&gt;/integrations/hunter/dataforward</code> con la
        API key en el header <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">X-API-Key</code>. Solo se aceptan los
        campos documentados por Hunter; cualquier otro envío se rechaza.
      </Card>
      <ErrorNote error={error} />
      {actionError ? <div className="mb-4"><ErrorNote error={actionError} /></div> : null}
      <Table
        head={["Equipo", "Último reporte", "Ubicación", "Bus vinculado", "Estado", ""]}
        empty={devices && devices.length === 0 ? <EmptyState title="Ningún GPS ha reportado todavía" message="Cuando Hunter empiece a enviar datos, los equipos aparecerán aquí." /> : null}
      >
        {(devices ?? []).map((d) => (
          <tr key={d.id}>
            <Td>
              <div className="font-semibold">{d.alias ?? "Sin alias"}{d.label ? ` / ${d.label}` : ""}</div>
              <div className="text-xs text-muted">Hunter Id {d.externalId}</div>
            </Td>
            <Td>
              {d.position ? (
                <>
                  <Badge tone={statusTone(d.position.freshness)}>{STATUS_LABEL[d.position.freshness]}</Badge>
                  <div className="mt-1 text-xs text-muted">{formatAge(d.position.ageSeconds)} · {formatDateTime(d.position.occurredAt)}</div>
                </>
              ) : (
                <span className="text-xs text-muted">Sin posición válida</span>
              )}
            </Td>
            <Td className="max-w-[220px] text-xs text-muted">
              {d.position ? (
                <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${d.position.latitude}&mlon=${d.position.longitude}#map=17/${d.position.latitude}/${d.position.longitude}`}>
                  {d.address ?? `${d.position.latitude.toFixed(5)}, ${d.position.longitude.toFixed(5)}`}
                </a>
              ) : "—"}
            </Td>
            <Td>
              <Select value={d.vehicle?.id ?? ""} onChange={(e) => bind(d, e.target.value)} className="min-w-[180px]">
                <option value="">Sin vincular</option>
                {(vehicles?.data ?? []).map((v) => (
                  <option key={v.id} value={v.id} disabled={takenBy.has(v.id) && takenBy.get(v.id) !== d.id}>
                    {v.code} · {v.plate}{takenBy.has(v.id) && takenBy.get(v.id) !== d.id ? " (ya tiene GPS)" : ""}
                  </option>
                ))}
              </Select>
            </Td>
            <Td><Badge tone={d.isActive ? "ok" : "danger"}>{d.isActive ? "En uso" : "Deshabilitado"}</Badge></Td>
            <Td className="text-right">
              <Button tone="ghost" onClick={() => void act(() => send("PATCH", `admin/tracking/devices/${d.id}`, { isActive: !d.isActive }))}>
                {d.isActive ? "Deshabilitar" : "Habilitar"}
              </Button>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
