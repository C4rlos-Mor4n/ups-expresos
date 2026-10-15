"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, send } from "@/lib/client/api";
import { formatDateTime, friendlyError, ROLE_LABEL } from "@/lib/format";
import type { AdminUser, Page } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Input, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const key = `admin/users?page=${page}&limit=25${role ? `&role=${role}` : ""}${query ? `&search=${encodeURIComponent(query)}` : ""}`;
  const { data, error, mutate } = useSWR<Page<AdminUser>>(key, fetcher);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: me } = useSWR<{ id: string }>("auth/me", fetcher);

  const update = async (user: AdminUser, body: { isActive?: boolean; role?: string }, question: string) => {
    if (!confirm(question)) return;
    setActionError(null);
    try {
      await send("PATCH", `admin/users/${user.id}`, body);
      await mutate();
    } catch (e) {
      setActionError(friendlyError((e as Error).message));
    }
  };

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas de estudiantes, conductores y administradores. Desactivar una cuenta cierra sus sesiones al instante. Solo un super administrador gestiona administradores."
      />
      <Card className="mb-6">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <Input placeholder="Buscar por correo o nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">Todos los roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Button type="submit">Buscar</Button>
        </form>
      </Card>
      <ErrorNote error={error} />
      {actionError ? <div className="mb-4"><ErrorNote error={actionError} /></div> : null}
      <Table head={["Usuario", "Rol", "Último ingreso", "Estado", ""]}>
        {(data?.items ?? []).map((u) => (
          <tr key={u.id}>
            <Td>
              <div className="font-semibold">{u.name || "—"}</div>
              <div className="text-xs text-muted">{u.email}</div>
            </Td>
            <Td>
              {u.id === me?.id ? (
                <Badge tone="brand">{ROLE_LABEL[u.role]} (tú)</Badge>
              ) : u.role === "DRIVER" ? (
                <Badge tone="gold">Conductor</Badge>
              ) : (
                <Select
                  value={u.role}
                  className="h-8 w-48 text-xs"
                  onChange={(e) => void update(u, { role: e.target.value }, `¿Cambiar el rol de ${u.email} a ${ROLE_LABEL[e.target.value]}? Su sesión se cerrará.`)}
                >
                  <option value="STUDENT">Estudiante</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="SUPER_ADMIN">Super administrador</option>
                </Select>
              )}
            </Td>
            <Td>{formatDateTime(u.lastLoginAt)}</Td>
            <Td><Badge tone={u.isActive ? "ok" : "danger"}>{u.isActive ? "Activa" : "Desactivada"}</Badge></Td>
            <Td className="text-right">
              {u.id === me?.id ? null : <Button
                tone={u.isActive ? "danger" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => void update(u, { isActive: !u.isActive }, u.isActive ? `¿Desactivar la cuenta de ${u.email}? Perderá el acceso de inmediato.` : `¿Reactivar la cuenta de ${u.email}?`)}
              >
                {u.isActive ? "Desactivar" : "Reactivar"}
              </Button>}
            </Td>
          </tr>
        ))}
      </Table>
      {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
    </>
  );
}
