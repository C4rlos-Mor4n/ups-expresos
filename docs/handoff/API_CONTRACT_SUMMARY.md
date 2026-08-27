# API Contract Summary — UPS ExpresosApp

## Contexto

Backend NestJS + Prisma + PostgreSQL. Autenticación por OTP (código de 6 dígitos enviado por email) y tokens JWT (Bearer). Todo endpoint protegido usa `Authorization: Bearer <accessToken>` salvo los públicos (`/auth/*`). Roles: `STUDENT`, `ADMIN`, `SUPER_ADMIN`, `DRIVER`.

Este documento resume el contrato de la **Fase 1 — Route Operations** (asignaciones y recorridos manuales) y los endpoints existentes relacionados.

## Autenticación (existente)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/request-code` | Solicita OTP al correo |
| POST | `/auth/verify-code` | Verifica OTP y devuelve access/refresh tokens |
| POST | `/auth/refresh` | Renueva tokens |
| POST | `/auth/logout` | Revoca sesión |
| GET | `/auth/me` | Usuario autenticado |

## Admin — Route Assignments (nuevo)

Roles: `ADMIN`, `SUPER_ADMIN`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/route-assignments` | Crear asignación |
| GET | `/admin/route-assignments` | Listar (filtros: page, limit, serviceDate, routeId, driverId, vehicleId, status) |
| GET | `/admin/route-assignments/:id` | Detalle |
| PATCH | `/admin/route-assignments/:id` | Editar (bloqueado si hay trip IN_PROGRESS) |
| PATCH | `/admin/route-assignments/:id/suspend` | Suspender (body opcional `reason`) |

Reglas:
- Valida existencia y estado activo de ruta, conductor y vehículo.
- Rechaza asignaciones conflictivas (mismo conductor, vehículo o ruta) para la misma fecha.
- No permite editar/suspender si existe un `Trip` `IN_PROGRESS` vinculado.
- Registra auditoría en `AuditLog`.

## Driver Operations (nuevo)

Roles: `DRIVER`, `ADMIN`, `SUPER_ADMIN`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/driver/me/assignments/today` | Asignaciones del día del conductor autenticado (`?driverId=` para admin/super-admin) |
| POST | `/driver/trips/start` | Inicia recorrido (`assignmentId`, `startNotes?`) |
| POST | `/driver/trips/:id/finish` | Finaliza recorrido (`endNotes?`) |
| GET | `/driver/trips/current` | Trip IN_PROGRESS actual (`200` con `data: null` si no hay) |

Reglas:
- El conductor solo opera sobre sus propias asignaciones/trips (Forbidden si no es suyo).
- No puede iniciar si el conductor o el vehículo ya tienen un trip IN_PROGRESS.
- Al iniciar: crea `Trip` IN_PROGRESS, setea `startedAt` y la asignación pasa a IN_PROGRESS.
- Al finalizar: setea `endedAt`, trip COMPLETED, asignación COMPLETED.

## Mobile — Rutas (modificado, compatible)

Roles: `STUDENT`, `DRIVER`, `ADMIN`, `SUPER_ADMIN`.

| Método | Ruta | Cambio |
|---|---|---|
| GET | `/mobile/routes` | Añadido `currentOperation` por ruta |
| GET | `/mobile/routes/:id` | Añadido `currentOperation` |

`currentOperation`:
```json
{
  "status": "IN_PROGRESS",
  "driver": { "id": "uuid", "name": "Juan Pérez" },
  "vehicle": { "id": "uuid", "plate": "GXX-1234", "code": "BUS-01" },
  "startedAt": "2026-08-25T12:00:00.000Z",
  "tripId": "uuid"
}
```
o `null` cuando no hay operación activa.

## Estados operativos (enum `TripStatus`)

- `SCHEDULED` — programado
- `IN_PROGRESS` — en recorrido
- `COMPLETED` — finalizado
- `CANCELLED` — cancelado
- `SUSPENDED` — suspendido

## Especificación OpenAPI

`docs/handoff/ups-expresosapp-openapi.json` (exportada con `pnpm export:openapi`).