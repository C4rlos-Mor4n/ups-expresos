"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { addDays, DIRECTION_LABEL, friendlyError, STATUS_LABEL, todayGuayaquil } from "@/lib/format";
import type { Calendar, ServiceLine, TimetableRow } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Table, Td, statusTone } from "@/components/ui";

const DAY: Record<string, string> = { MONDAY: "L", TUESDAY: "M", WEDNESDAY: "X", THURSDAY: "J", FRIDAY: "V", SATURDAY: "S", SUNDAY: "D" };

interface MaterializationResult {
  direction: string;
  created: number;
  existingSame: number;
  existingDifferent: number;
  noServiceDates: number;
  errors: number;
}

export default function SchedulesPage() {
  const { data: lines } = useSWR<ServiceLine[]>("admin/operational/service-lines", fetcher);
  const [lineId, setLineId] = useState("");
  useEffect(() => {
    if (!lineId && lines?.[0]) setLineId(lines[0].id);
  }, [lines, lineId]);
  const { data: calendars, error, mutate } = useSWR<Calendar[]>(lineId ? `admin/schedules/calendars?serviceLineId=${lineId}` : null, fetcher);
  const [selected, setSelected] = useState<Calendar | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lifecycle = async (calendar: Calendar, action: "publish" | "archive") => {
    const verb = action === "publish" ? "publicar" : "archivar";
    if (!confirm(`¿Seguro que quieres ${verb} “${calendar.name}”?`)) return;
    setActionError(null);
    try {
      await send("POST", `admin/schedules/calendars/${calendar.id}/${action}`);
      await mutate();
    } catch (e) {
      setActionError(friendlyError((e as Error).message));
    }
  };

  return (
    <>
      <PageHeader
        title="Horarios"
        description="Calendarios de servicio por línea. Un calendario publicado genera las salidas que ven los estudiantes; el servidor valida que cada horario tenga recorrido y tiempos completos antes de publicar."
        actions={
          <>
            <Button tone="outline" onClick={() => setCreating(true)} disabled={!lineId}>+ Nuevo calendario</Button>
            <Button tone="gold" onClick={() => setGenerating(true)} disabled={!lineId}>Generar salidas</Button>
          </>
        }
      />
      <Card className="mb-6">
        <Field label="Línea">
          <Select value={lineId} onChange={(e) => { setLineId(e.target.value); setSelected(null); }}>
            {(lines ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} · {l.campus.name}</option>)}
          </Select>
        </Field>
      </Card>
      <ErrorNote error={error} />
      {actionError ? <div className="mb-4"><ErrorNote error={actionError} /></div> : null}
      <Table head={["Calendario", "Vigencia", "Horarios", "Estado", ""]} empty={calendars && calendars.length === 0 ? <EmptyState title="Esta línea no tiene calendarios" /> : null}>
        {(calendars ?? []).map((c) => (
          <tr key={c.id} className={selected?.id === c.id ? "bg-brand-soft/40" : undefined}>
            <Td className="font-semibold">{c.name}</Td>
            <Td>{c.validFrom.slice(0, 10)} → {c.validUntil.slice(0, 10)}</Td>
            <Td>{c.patternCount} patrones · {c.scheduleTimeCount} horas</Td>
            <Td><Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge></Td>
            <Td className="whitespace-nowrap text-right">
              <Button tone="ghost" onClick={() => setSelected(c)}>Ver horarios</Button>
              {c.status === "DRAFT" ? <Button tone="ghost" onClick={() => void lifecycle(c, "publish")}>Publicar</Button> : null}
              {c.status !== "ARCHIVED" ? <Button tone="ghost" onClick={() => void lifecycle(c, "archive")}>Archivar</Button> : null}
            </Td>
          </tr>
        ))}
      </Table>
      {selected ? <TimetableView calendar={selected} /> : null}
      <CreateCalendarModal open={creating} lineId={lineId} onClose={() => setCreating(false)} onDone={() => void mutate()} />
      <GenerateModal open={generating} lineId={lineId} onClose={() => setGenerating(false)} />
    </>
  );
}

function TimetableView({ calendar }: { calendar: Calendar }) {
  const { data, error } = useSWR<TimetableRow[]>(`admin/schedules/timetable?serviceLineId=${calendar.serviceLine.id}&calendarId=${calendar.id}`, fetcher);
  const groups = ["IDA", "RETORNO"].map((dir) => ({ dir, rows: (data ?? []).filter((r) => r.direction === dir) }));
  return (
    <Card className="mt-6">
      <h2 className="mb-1 font-bold text-navy">{calendar.name}</h2>
      <p className="mb-4 text-sm text-muted">Horas de salida por sentido y días de operación.</p>
      <ErrorNote error={error} />
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map(({ dir, rows }) => (
          <div key={dir}>
            <div className="mb-2 text-sm font-bold text-brand">{DIRECTION_LABEL[dir]}</div>
            {rows.length === 0 ? <p className="text-sm text-muted">Sin horarios.</p> : (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {rows.map((r) => (
                  <li key={r.scheduleTimeId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-bold text-navy">{r.departureTime.slice(0, 5)}</span>
                    <span className="flex gap-1">
                      {Object.keys(DAY).map((d) => (
                        <span key={d} className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${r.days.includes(d) ? "bg-brand text-white" : "bg-canvas text-muted"}`}>{DAY[d]}</span>
                      ))}
                    </span>
                    <span className="text-xs text-muted">{r.journeyTemplates.length} recorrido(s)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function CreateCalendarModal({ open, lineId, onClose, onDone }: { open: boolean; lineId: string; onClose: () => void; onDone: () => void }) {
  const today = todayGuayaquil();
  const [form, setForm] = useState({ name: "", validFrom: today, validUntil: addDays(today, 120) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await send("POST", "admin/schedules/calendars", { serviceLineId: lineId, ...form });
      onDone();
      onClose();
    } catch (e) {
      setError(friendlyError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo calendario (borrador)">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Periodo 66 · Lunes a viernes" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Desde"><Input type="date" required value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></Field>
          <Field label="Hasta"><Input type="date" required value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-muted">Los patrones, horas y tiempos por parada se cargan con la API de horarios (ver docs/api/endpoints.md); el calendario se publica cuando está completo.</p>
        {error ? <ErrorNote error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" tone="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Crear</Button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateModal({ open, lineId, onClose }: { open: boolean; lineId: string; onClose: () => void }) {
  const today = todayGuayaquil();
  const [range, setRange] = useState({ fromDate: today, toDate: addDays(today, 30) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MaterializationResult[] | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setResults(null);
    try {
      const out: MaterializationResult[] = [];
      for (const direction of ["IDA", "RETORNO"]) {
        out.push(await send<MaterializationResult>("POST", "admin/schedules/materialization", { serviceLineId: lineId, direction, ...range }));
      }
      setResults(out);
    } catch (e) {
      setError(friendlyError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={() => { setResults(null); onClose(); }} title="Generar salidas">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Crea las salidas concretas de cada día a partir del calendario publicado. Es seguro repetirlo: no duplica ni borra salidas (máximo 31 días por vez).</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Desde"><Input type="date" required value={range.fromDate} onChange={(e) => setRange({ ...range, fromDate: e.target.value })} /></Field>
          <Field label="Hasta"><Input type="date" required value={range.toDate} onChange={(e) => setRange({ ...range, toDate: e.target.value })} /></Field>
        </div>
        {error ? <ErrorNote error={error} /> : null}
        {results ? (
          <div className="space-y-2 rounded-xl bg-ok-soft p-3 text-sm">
            {results.map((r) => (
              <div key={r.direction}>
                <b>{DIRECTION_LABEL[r.direction]}</b>: {r.created} nuevas · {r.existingSame} ya existían · {r.noServiceDates} días sin servicio{r.errors ? ` · ${r.errors} con error` : ""}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" tone="outline" onClick={() => { setResults(null); onClose(); }}>Cerrar</Button>
          <Button type="submit" loading={saving}>Generar</Button>
        </div>
      </form>
    </Modal>
  );
}
