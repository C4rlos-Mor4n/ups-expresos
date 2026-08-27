# Web Admin API Guide — UPS ExpresosApp

Guía para la futura web administrativa (`apps/web`, pendiente) o para herramientas de administración. Fase 1 — Route Operations.

## Admin — Route Assignments

Roles: `ADMIN`, `SUPER_ADMIN`. Endpoints bajo `/admin/route-assignments`.

### Crear asignación

```
POST /admin/route-assignments
Authorization: Bearer <accessToken>
```

```json
{
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "driverId": "550e8400-e29b-41d4-a716-446655440000",
  "vehicleId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-08-25T00:00:00.000Z",
  "notes": "Asignación para ruta norte en la mañana"
}
```

Respuesta `201` con `RouteAssignmentResponseDto`. Errores: `400` (entrada inválida o conductor/vehículo inactivo), `404` (ruta/conductor/vehículo no existe), `409` (conflicto en la misma fecha).

### Listar asignaciones

```
GET /admin/route-assignments?page=1&limit=20&serviceDate=2026-08-25&routeId=&driverId=&vehicleId=&status=SCHEDULED
```

Respuesta `200` con `data[]` + `meta` (page, limit, total, totalPages).

### Detalle

```
GET /admin/route-assignments/:id
```

### Editar

```
PATCH /admin/route-assignments/:id
```

Body: `{ "routeId"?, "driverId"?, "vehicleId"?, "serviceDate"?, "notes"? }`.

Bloqueado (`409`) si existe un `Trip` `IN_PROGRESS` vinculado.

### Suspender

```
PATCH /admin/route-assignments/:id/suspend
```

```json
{ "reason": "Unidad en mantenimiento" }
```

Marca la asignación como `SUSPENDED` e inactiva. Bloqueado (`409`) si hay trip IN_PROGRESS.

## Admin — Catálogos existentes

- `/admin/routes` — CRUD de rutas.
- `/admin/stops` — CRUD de paradas.
- `/admin/schedules` — CRUD de horarios.
- `/admin/vehicles` — CRUD de vehículos.
- `/admin/drivers` — CRUD de conductores.
- `/admin/notices` — CRUD de avisos.

## Operación del conductor (vista administrativa)

Los administradores pueden operar en nombre de un conductor usando `?driverId=`:

- `GET /driver/me/assignments/today?driverId=<uuid>`
- `GET /driver/trips/current?driverId=<uuid>` (no requiere query; resuelve por el driver si el rol es ADMIN/SUPER_ADMIN usando driverId)

Nota: `POST /driver/trips/start` y `POST /driver/trips/:id/finish` resuelven el driver por el token autenticado; para operar en nombre de otro driver desde el panel, es recomendable añadir un soporte `driverId` explícito en una fase posterior (no implementado en esta fase).

## Auditoría

Toda mutación de asignaciones y recorridos registra en `AuditLog` (`audit_logs`). Acciones: `CREATE`, `UPDATE`, `SUSPEND`, `TRIP_START`, `TRIP_FINISH`.

## Especificación OpenAPI

`docs/handoff/ups-expresosapp-openapi.json`.