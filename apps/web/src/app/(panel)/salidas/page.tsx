"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { addDays, DIRECTION_LABEL, formatLongDate, formatTime, friendlyError, STATUS_LABEL, todayGuayaquil } from "@/lib/format";
import type { AdminAssignment, Driver, LineTimetable, Paginated, ServiceLine, TimetableDeparture, Vehicle } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, statusTone } from "@/components/ui";

function assignmentStatus(a: AdminAssignment): string {
  if (a.status === "CANCELLED") return "CANCELLED";
  return a.operation?.status ?? "ASSIGNED";
}

export default function DeparturesPage() {
  const [date, setDate] = useState(todayGuayaquil());
  const [lineId, setLineId] = useState<string>("");
  const [direction, setDirection] = useState<"" | "IDA" | "RETORNO">("");
  const [assigning, setAssigning] = useState<TimetableDeparture | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: lines } = useSWR<ServiceLine[]>("admin/operational/service-lines", fetcher);
  useEffect(() => {
    if (!lineId && lines?.[0]) setLineId(lines[0].id);
  }, [lines, lineId]);

  const key = lineId ? `admin/operational/service-lines/${lineId}/timetable?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR<LineTimetable>(key, fetcher, { refreshInterval: 30_000 });

  const departures = useMemo(
    () => (data?.scheduledDepartures ?? []).filter((d) => !direction || d.direction === direction),
    [data, direction],
  );

  const cancel = async (assignment: AdminAssignment) => {
    if (!confirm(`¿Cancelar la asignación de ${assignment.vehicle.code}? El bus y el conductor quedan libres.`)) return;
    setActionError(null);
    try {
      await send("POST", `admin/operational/service-assignments/${assignment.id}/cancel`);
      await mutate();
    } catch (e) {
      setActionError(friendlyError((e as Error).message));
    }
  };

  return (
    <>
      <PageHeader
        title="Salidas y asignaciones"
        description="Cada salida programada puede tener uno o varios buses. Asigna bus, conductor y recorrido; el sistema evita choques de horario."
      />
      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Field label="Línea">
            <Select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              {(lines ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.campus.name}{l.isActive ? "" : " (inactiva)"}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <div className="flex gap-2">
              <Button tone="outline" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">‹</Button>
              <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <Button tone="outline" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">›</Button>
            </div>
          </Field>
          <Field label="Sentido">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="">Ambos</option>
              <option value="IDA">Ida al campus</option>
              <option value="RETORNO">Retorno</option>
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-sm capitalize text-muted">{formatLongDate(date)}</p>
      </Card>

      <ErrorNote error={error} />
      {actionError ? <div className="mb-4"><ErrorNote error={actionError} /></div> : null}
      {isLoading ? (
        <Spinner />
      ) : departures.length === 0 ? (
        <Card>
          <EmptyState
            title="No hay salidas para esta fecha"
            message="Si el calendario está publicado, genera las salidas desde Horarios → Generar salidas."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {departures.map((d) => {
            const active = d.assignments.filter((a) => a.status !== "CANCELLED");
            return (
              <Card key={d.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-extrabold text-navy">{d.scheduledTime.slice(0, 5)}</div>
                    <div>
                      <div className="text-sm font-semibold">{DIRECTION_LABEL[d.direction] ?? d.direction}</div>
                      <div className="text-xs text-muted">{d.journeyTemplates.map((j) => j.routePathName).join(" · ") || "Sin recorrido configurado"}</div>
                    </div>
                    {active.length === 0 ? <Badge tone="gold">Sin bus</Badge> : <Badge tone="brand">{active.length} bus(es)</Badge>}
                  </div>
                  <Button tone="gold" onClick={() => setAssigning(d)} disabled={d.journeyTemplates.length === 0}>+ Asignar bus</Button>
                </div>
                {d.assignments.length > 0 ? (
                  <div className="mt-3 divide-y divide-line rounded-xl border border-line">
                    {d.assignments.map((a) => {
                      const status = assignmentStatus(a);
                      return (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div>
                            <span className="font-semibold">{a.vehicle.code} · {a.vehicle.plate}</span>
                            <span className="text-muted"> — {a.driver.name} — {a.journeyTemplate.routePath.displayName}</span>
                            <div className="text-xs text-muted">
                              Ventana {formatTime(a.plannedStartAt)}–{formatTime(a.plannedEndAt)}
                              {a.operation ? ` · inicio real ${formatTime(a.operation.startedAt)}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone={statusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
                            {status === "ASSIGNED" ? (
                              <Button tone="danger" className="h-8 px-3 text-xs" onClick={() => void cancel(a)}>Cancelar</Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <AssignModal departure={assigning} onClose={() => setAssigning(null)} onDone={() => void mutate()} />
    </>
  );
}

function AssignModal({ departure, onClose, onDone }: { departure: TimetableDeparture | null; onClose: () => void; onDone: () => void }) {
  const { data: vehicles } = useSWR<Paginated<Vehicle>>(departure ? "admin/vehicles?limit=100" : null, fetcher);
  const { data: drivers } = useSWR<Paginated<Driver>>(departure ? "admin/drivers?limit=100" : null, fetcher);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVehicleId("");
    setDriverId("");
    setTemplateId(departure?.journeyTemplates[0]?.id ?? "");
    setError(null);
  }, [departure]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!departure) return;
    setSaving(true);
    setError(null);
    try {
      await send("POST", "admin/operational/service-assignments", {
        scheduledDepartureId: departure.id,
        vehicleId,
        driverId,
        journeyTemplateId: templateId,
      });
      onDone();
      onClose();
    } catch (e) {
      setError(friendlyError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!departure} onClose={onClose} title={departure ? `Asignar bus · ${departure.scheduledTime.slice(0, 5)}` : ""}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Bus">
          <Select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Selecciona un bus</option>
            {(vehicles?.data ?? []).filter((v) => v.status === "ACTIVE").map((v) => (
              <option key={v.id} value={v.id}>{v.code} · {v.plate} · {v.capacity} pasajeros</option>
            ))}
          </Select>
        </Field>
        <Field label="Conductor" hint="Solo conductores activos. Para que use la app, vincula su correo en Conductores.">
          <Select required value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Selecciona un conductor</option>
            {(drivers?.data ?? []).filter((d) => d.status === "ACTIVE").map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.accountEmail ? "" : " (sin acceso a la app)"}</option>
            ))}
          </Select>
        </Field>
        <Field label="Recorrido">
          <Select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {(departure?.journeyTemplates ?? []).map((j) => (
              <option key={j.id} value={j.id}>{j.routePathName}</option>
            ))}
          </Select>
        </Field>
        {error ? <ErrorNote error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" tone="outline" onClick={onClose}>Cerrar</Button>
          <Button type="submit" loading={saving}>Asignar</Button>
        </div>
      </form>
    </Modal>
  );
}
