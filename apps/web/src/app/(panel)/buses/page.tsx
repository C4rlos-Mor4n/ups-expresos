"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { friendlyError, STATUS_LABEL } from "@/lib/format";
import type { Paginated, Vehicle } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Table, Td, statusTone } from "@/components/ui";

type Draft = { id?: string; code: string; plate: string; capacity: string; status: string };
const EMPTY: Draft = { code: "", plate: "", capacity: "40", status: "ACTIVE" };

export default function VehiclesPage() {
  const { data, error, mutate } = useSWR<Paginated<Vehicle>>("admin/vehicles?limit=100", fetcher);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = { code: draft.code.trim(), plate: draft.plate.trim().toUpperCase(), capacity: Number(draft.capacity), status: draft.status };
    try {
      if (draft.id) await send("PATCH", `admin/vehicles/${draft.id}`, body);
      else await send("POST", "admin/vehicles", body);
      setDraft(null);
      await mutate();
    } catch (e) {
      setFormError(friendlyError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Buses"
        description="Flota disponible para asignar. Un bus en mantenimiento o inactivo no aparece al asignar salidas."
        actions={<Button tone="gold" onClick={() => { setDraft(EMPTY); setFormError(null); }}>+ Nuevo bus</Button>}
      />
      <ErrorNote error={error} />
      <Table
        head={["Código", "Placa", "Capacidad", "Estado", ""]}
        empty={data && data.data.length === 0 ? <EmptyState title="Aún no hay buses" message="Registra el primer bus de la flota." /> : null}
      >
        {(data?.data ?? []).map((v) => (
          <tr key={v.id}>
            <Td className="font-semibold">{v.code}</Td>
            <Td>{v.plate}</Td>
            <Td>{v.capacity} pasajeros</Td>
            <Td><Badge tone={statusTone(v.status)}>{STATUS_LABEL[v.status] ?? v.status}</Badge></Td>
            <Td className="text-right">
              <Button tone="ghost" onClick={() => { setDraft({ id: v.id, code: v.code, plate: v.plate, capacity: String(v.capacity), status: v.status }); setFormError(null); }}>Editar</Button>
            </Td>
          </tr>
        ))}
      </Table>
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar bus" : "Nuevo bus"}>
        {draft ? (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código interno"><Input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="BUS-07" /></Field>
              <Field label="Placa"><Input required value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="GBA-1234" /></Field>
              <Field label="Capacidad"><Input required type="number" min={1} max={120} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></Field>
              <Field label="Estado">
                <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="ACTIVE">Activo</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                  <option value="INACTIVE">Inactivo</option>
                </Select>
              </Field>
            </div>
            {formError ? <ErrorNote error={formError} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" tone="outline" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Guardar</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
