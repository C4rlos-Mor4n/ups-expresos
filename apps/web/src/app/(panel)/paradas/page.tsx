"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { friendlyError } from "@/lib/format";
import type { Paginated, Stop } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Pagination, Table, Td } from "@/components/ui";

type Draft = { id?: string; name: string; reference: string; latitude: string; longitude: string; isActive: boolean };
const EMPTY: Draft = { name: "", reference: "", latitude: "", longitude: "", isActive: true };

export default function StopsPage() {
  const [page, setPage] = useState(1);
  const { data, error, mutate } = useSWR<Paginated<Stop>>(`admin/stops?page=${page}&limit=50`, fetcher);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = {
      name: draft.name.trim(),
      reference: draft.reference.trim() || undefined,
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
      isActive: draft.isActive,
    };
    try {
      if (draft.id) await send("PATCH", `admin/stops/${draft.id}`, body);
      else await send("POST", "admin/stops", body);
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
        title="Paradas"
        description="Puntos donde el bus recoge estudiantes. La referencia es lo que verá el estudiante en la app (por ejemplo, “Frente al C.C. Garzocentro”)."
        actions={<Button tone="gold" onClick={() => { setDraft(EMPTY); setFormError(null); }}>+ Nueva parada</Button>}
      />
      <ErrorNote error={error} />
      <Table head={["Nombre", "Referencia", "Coordenadas", "Estado", ""]} empty={data && data.data.length === 0 ? <EmptyState title="Aún no hay paradas" /> : null}>
        {(data?.data ?? []).map((s) => (
          <tr key={s.id}>
            <Td className="font-semibold">{s.name}</Td>
            <Td className="text-muted">{s.reference || "—"}</Td>
            <Td>
              <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`}>
                {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
              </a>
            </Td>
            <Td><Badge tone={s.isActive ? "ok" : "danger"}>{s.isActive ? "Activa" : "Inactiva"}</Badge></Td>
            <Td className="text-right">
              <Button tone="ghost" onClick={() => { setDraft({ id: s.id, name: s.name, reference: s.reference ?? "", latitude: String(s.latitude), longitude: String(s.longitude), isActive: s.isActive }); setFormError(null); }}>Editar</Button>
            </Td>
          </tr>
        ))}
      </Table>
      {data ? <Pagination page={page} total={data.meta.total} limit={50} onPage={setPage} /> : null}
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar parada" : "Nueva parada"}>
        {draft ? (
          <form onSubmit={save} className="space-y-4">
            <Field label="Nombre"><Input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Referencia para el estudiante"><Input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitud"><Input required type="number" step="any" min={-90} max={90} value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} /></Field>
              <Field label="Longitud"><Input required type="number" step="any" min={-180} max={180} value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Activa</label>
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
