# Superficie HTTP

La referencia exacta y siempre vigente es Swagger (`/docs` con `SWAGGER_ENABLED=true`) o el OpenAPI generado
(`pnpm export:openapi`). Este documento resume qué existe y quién lo usa.

Autenticación: `Authorization: Bearer <accessToken>` salvo en rutas públicas. Lecturas paginadas de Admin usan
`?page=` (≥1) y `?limit=` (1–100, por defecto 20).

## Público

| Método y ruta | Descripción |
|---|---|
| `GET /health`, `GET /health/db` | Salud del servicio y de la base de datos. |
| `POST /auth/request-code` | Solicita un OTP por correo (3/min). |
| `POST /auth/verify-code` | Verifica el OTP y entrega tokens (5/min). |
| `POST /auth/refresh` | Rota el refresh token. |

## Autenticado (cualquier rol)

`POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me` (solo `name`, 2–60 caracteres; lo usa la app para el saludo).

## Student (`STUDENT`) — consumido por la app

| Ruta | Descripción |
|---|---|
| `GET /student/campuses` | Campus activos. |
| `GET /student/campuses/:campusId/service-lines` | Líneas que **atienden** ese campus. |
| `GET /student/service-lines/:serviceLineId/departures?date=&direction=` | Salidas de una fecha con su estado operativo. Incluye `stopTimes` (parada, orden y hora programada de paso) cuando la salida tiene un único recorrido; campo opcional y aditivo. |
| `GET /student/scheduled-departures/:id` | Detalle: asignaciones por bus, recorrido, paradas y horas programadas. |

## Driver (`DRIVER`) — consumido por la app

La identidad sale del JWT (`sub → User → Driver.userId`); nunca se acepta un `driverId` del cliente.

| Ruta | Descripción |
|---|---|
| `GET /driver/operational/assignments/today` | Asignaciones del día. |
| `GET /driver/operational/assignments/:id` | Detalle de una asignación propia. |
| `POST /driver/operational/assignments/:id/start` | Inicia el `ServiceRun`. |
| `GET /driver/operational/service-runs/current` | Recorrido en curso. |
| `POST /driver/operational/service-runs/:id/finish` | Finaliza el recorrido (idempotente). |

## Admin (`ADMIN`, `SUPER_ADMIN`) — reservado para el panel web

| Grupo | Rutas |
|---|---|
| Paradas, buses, conductores | CRUD en `/admin/stops`, `/admin/vehicles`, `/admin/drivers`. `DELETE` desactiva (no borra). |
| Operación | `/admin/operational/campuses`, `service-lines`, `service-lines/:id/timetable`, `service-assignments` (GET/POST), `service-runs`. |
| Horarios (25 operaciones) | `/admin/schedules/...`: calendarios (crear, editar, publicar, archivar), patrones y días, horas, recorridos (journeys) y offsets, excepciones (crear, editar, publicar, cancelar), `timetable` y `materialization`. |

Estas rutas **se conservan aunque la app móvil no las use**: son la base del panel administrativo.
Ver [`../web/README.md`](../web/README.md) para lo que aún falta (CRUD de campus y líneas, recorridos,
usuarios, lectura de auditoría, ciclo de vida de asignaciones, tablero).

## Errores

Formato uniforme (filtro global): `{ statusCode, message, errors? }`. Códigos habituales: 400 validación,
401 sin sesión, 403 rol insuficiente, 404 no encontrado, 409 conflicto (duplicado o solape de bus/conductor),
429 rate limit.

## Compatibilidad

No renombrar rutas ni campos que la app consume sin advertencia explícita. Los cambios deben ser aditivos;
si no lo son, se versiona o se prevé transición y rollback. El contrato generado se verifica en CI.
