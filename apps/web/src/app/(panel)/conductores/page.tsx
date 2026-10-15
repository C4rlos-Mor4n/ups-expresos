"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { friendlyError, STATUS_LABEL } from "@/lib/format";
import type { Driver, Paginated } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Table, Td, statusTone } from "@/components/ui";

type Draft = { id?: string; name: string; phone: string; licenseNumber: string; status: string };
const EMPTY: Draft = { name: "", phone: "", licenseNumber: "", status: "ACTIVE" };

export default function DriversPage() {
  const { data, error, mutate } = useSWR<Paginated<Driver>>("admin/drivers?limit=100", fetcher);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [linking, setLinking] = useState<Driver | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, close: () => void) => {
    setSaving(true);
    setFormError(null);
    try {
      await action();
      close();
      await mutate();
    } catch (e) {
      setFormError(friendlyError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const body = {
      name: draft.name.trim(),
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      ...(draft.licenseNumber.trim() ? { licenseNumber: draft.licenseNumber.trim() } : {}),
      status: draft.status,
    };
    void run(() => (draft.id ? send("PATCH", `admin/drivers/${draft.id}`, body) : send("POST", "admin/drivers", body)), () => setDraft(null));
  };

  const link = (event: React.FormEvent) => {
    event.preventDefault();
    if (!linking) return;
    void run(() => send("POST", `admin/drivers/${linking.id}/account`, { email }), () => setLinking(null));
  };

  const unlink = (driver: Driver) => {
    if (!confirm(`¿Quitar el acceso a la app de ${driver.name}? Su sesión se cerrará en el teléfono.`)) return;
    void run(() => send("DELETE", `admin/drivers/${driver.id}/account`), () => undefined);
  };

  return (
    <>
      <PageHeader
        title="Conductores"
        description="Registra conductores y dales acceso a la app con su correo (puede ser Gmail u otro). Ingresan con un código, sin contraseña."
        actions={<Button tone="gold" onClick={() => { setDraft(EMPTY); setFormError(null); }}>+ Nuevo conductor</Button>}
      />
      <ErrorNote error={error} />
      {formError && !draft && !linking ? <div className="mb-4"><ErrorNote error={formError} /></div> : null}
      <Table
        head={["Nombre", "Teléfono", "Licencia", "Acceso a la app", "Estado", ""]}
        empty={data && data.data.length === 0 ? <EmptyState title="Aún no hay conductores" /> : null}
      >
        {(data?.data ?? []).map((d) => (
          <tr key={d.id}>
            <Td className="font-semibold">{d.name}</Td>
            <Td>{d.phone || "—"}</Td>
            <Td>{d.licenseNumber || "—"}</Td>
            <Td>
              {d.accountEmail ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{d.accountEmail}</span>
                  <button className="text-xs font-semibold text-danger hover:underline" onClick={() => unlink(d)}>Quitar</button>
                </div>
              ) : (
                <button className="text-sm font-semibold text-brand hover:underline" onClick={() => { setLinking(d); setEmail(""); setFormError(null); }}>
                  Dar acceso
                </button>
              )}
            </Td>
            <Td><Badge tone={statusTone(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</Badge></Td>
            <Td className="text-right">
              <Button tone="ghost" onClick={() => { setDraft({ id: d.id, name: d.name, phone: d.phone ?? "", licenseNumber: d.licenseNumber ?? "", status: d.status }); setFormError(null); }}>Editar</Button>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar conductor" : "Nuevo conductor"}>
        {draft ? (
          <form onSubmit={save} className="space-y-4">
            <Field label="Nombre completo"><Input required minLength={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono"><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="N.º de licencia"><Input value={draft.licenseNumber} onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })} /></Field>
            </div>
            <Field label="Estado">
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </Select>
            </Field>
            {formError ? <ErrorNote error={formError} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" tone="outline" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Guardar</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!linking} onClose={() => setLinking(null)} title={`Acceso a la app · ${linking?.name ?? ""}`}>
        <form onSubmit={link} className="space-y-4">
          <p className="text-sm text-muted">
            El conductor ingresará a UPS GO con este correo y un código que le llegará al mismo. Si la cuenta ya existe como estudiante, pasa a conductor.
          </p>
          <Field label="Correo del conductor"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" /></Field>
          {formError ? <ErrorNote error={formError} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" tone="outline" onClick={() => setLinking(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Dar acceso</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
