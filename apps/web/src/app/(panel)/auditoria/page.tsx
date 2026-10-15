"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";
import type { AuditLog, Page } from "@/lib/types";
import { Card, ErrorNote, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";

const ENTITIES = ["ServiceAssignment", "ServiceRun", "Driver", "Vehicle", "Stop", "User", "TrackingDevice", "ServiceCalendar"];

const ACTION_LABEL: Record<string, string> = {
  SERVICE_RUN_START: "Inició recorrido",
  SERVICE_RUN_FINISH: "Finalizó recorrido",
  SERVICE_RUN_AUTO_START: "Inicio automático de recorrido",
  SERVICE_RUN_AUTO_FINISH: "Cierre automático de recorrido",
  SERVICE_ASSIGNMENT_CREATE: "Asignó bus a salida",
  SERVICE_ASSIGNMENT_CANCEL: "Canceló asignación",
  LINK_ACCOUNT: "Dio acceso a la app",
  UNLINK_ACCOUNT: "Quitó acceso a la app",
  TRACKING_DEVICE_BIND: "Vinculó GPS a bus",
  TRACKING_DEVICE_UNBIND: "Desvinculó GPS",
  TRACKING_DEVICE_UPDATE: "Cambió estado de GPS",
  USER_UPDATE: "Modificó usuario",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const { data, error } = useSWR<Page<AuditLog>>(`admin/audit-logs?page=${page}&limit=30${entity ? `&entity=${entity}` : ""}`, fetcher);
  return (
    <>
      <PageHeader title="Auditoría" description="Registro de acciones administrativas y automáticas: quién hizo qué y cuándo." />
      <Card className="mb-6 max-w-sm">
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">Todas las entidades</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </Card>
      <ErrorNote error={error} />
      <Table head={["Fecha", "Acción", "Entidad", "Realizado por", "Detalle"]}>
        {(data?.items ?? []).map((log) => (
          <tr key={log.id}>
            <Td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
            <Td className="font-semibold">{ACTION_LABEL[log.action] ?? log.action}</Td>
            <Td className="text-xs text-muted">{log.entity}</Td>
            <Td>{log.actorEmail ?? <span className="text-muted">Sistema</span>}</Td>
            <Td className="max-w-[360px] truncate text-xs text-muted" >{log.metadata ? JSON.stringify(log.metadata) : "—"}</Td>
          </tr>
        ))}
      </Table>
      {data ? <Pagination page={page} total={data.total} limit={30} onPage={setPage} /> : null}
    </>
  );
}
