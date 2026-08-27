# PHASE 1 — ROUTE OPERATIONS REPORT

## Veredicto

**GO** ✅ (tras auditoría de cierre) — Con evidencia verificable: build, typecheck, lint, 123 tests pasando, Prisma validate OK, migración aplicada sin drift, OpenAPI exportado y validado, seed con asignaciones demo, QA manual verificado.

## Auditoría de cierre (PHASE 1 ROUTE OPERATIONS REVIEW)

Se ejecutó una revisión independiente antes del commit/PR. Ver `docs/PHASE_1_ROUTE_OPERATIONS_REVIEW.md` para el reporte completo.

### Fixes aplicados durante la auditoría

- **Concurrencia en `startTrip`**: la verificación + creación del trip + actualización de la asignación ahora corren dentro de `$transaction` con aislamiento `Serializable`, evitando carreras TOCTOU que podrían crear dos trips `IN_PROGRESS` para el mismo conductor o vehículo. Errores `P2034` se traducen a `409`.
- **`currentOperation` por fecha**: el fallback de `MobileService.buildCurrentOperation` ahora filtra la asignación por la **fecha de hoy** (`serviceDate` hoy), evitando que una asignación pasada activa se muestre como operación actual. `currentOperation` es `null` cuando no hay operación de hoy.
- **Swagger nullable**: `CurrentTripWrapperDto.data` ahora es `nullable: true` en OpenAPI.

### Criterio de decisión `currentOperation`

**Opción B documentada**: refleja la operación actual/programada — prioriza un trip `IN_PROGRESS`; si no hay, la asignación activa **de hoy** (SCHEDULED/COMPLETED). Es `null` cuando no hay operación de hoy.

## Resumen ejecutivo

Se implementó la base operativa del MVP: asignaciones de ruta (ruta + conductor + vehículo + fecha de servicio), recorridos manuales iniciados/finalizados por el conductor, y estado operativo visible para la app del estudiante (`currentOperation`). No se implementó GPS, ETA ni notificaciones push en esta fase.

## Cambios implementados

- Modelos Prisma `RouteAssignment` y `Trip` con enum `TripStatus` (SCHEDULED / IN_PROGRESS / COMPLETED / CANCELLED / SUSPENDED).
- Campo `Driver.userId` (único) para vincular el perfil de conductor con la cuenta de usuario (rol DRIVER), permitiendo resolver el driver del usuario autenticado.
- Módulo `RouteAssignments` (admin): crear, listar (con filtros y paginación), detalle, actualizar y suspender asignaciones.
- Módulo `Trips`: servicio compartido de recorridos (iniciar, finalizar, consultar actual por conductor/vehículo).
- Módulo `DriverOperations`: endpoints del conductor (asignaciones de hoy, iniciar recorrido, finalizar recorrido, recorrido actual).
- Endpoints mobile actualizados: `GET /mobile/routes` y `GET /mobile/routes/:id` ahora incluyen `currentOperation` (conductor, vehículo, estado, startedAt).
- Seed ampliado: 4 asignaciones demo para la fecha actual y vínculos conductor↔usuario.
- Swagger/OpenAPI: nuevos tags `Admin Route Assignments` y `Driver Operations`; exportado a `docs/handoff/ups-expresosapp-openapi.json`.

## Modelos Prisma agregados o modificados

### Agregados

- `TripStatus` (enum): `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SUSPENDED`.
- `RouteAssignment`: asignación operativa de ruta a conductor y vehículo para una fecha de servicio. Campos: `routeId`, `driverId`, `vehicleId`, `serviceDate`, `status`, `notes`, `isActive`, `suspendReason`, `suspendedAt`. Índices en routeId, driverId, vehicleId, serviceDate, status.
- `Trip`: recorrido ejecutado/en ejecución. Campos: `assignmentId`, `routeId`, `driverId`, `vehicleId`, `status`, `startedAt`, `endedAt`, `startNotes`, `endNotes`. Índices en assignmentId, routeId, driverId, vehicleId, status, startedAt.

### Modificados

- `Driver`: se agregó `userId` (nullable, `@unique`) con relación a `User`.
- `User`: se agregó `driverProfile Driver?`.
- `Route`: se agregaron relaciones `assignments` y `trips`.
- `Vehicle`: se agregaron relaciones `assignments` y `trips`.

## Migración generada

- Nombre: `20260827_add_route_operations`
- Ubicación: `apps/api/prisma/migrations/20260827_add_route_operations/migration.sql`
- Contenido: `CREATE TYPE TripStatus`, `ALTER TABLE drivers ADD COLUMN userId`, `CREATE TABLE route_assignments`, `CREATE TABLE trips`, índices, FK y constraint único.
- Método: `prisma migrate diff --from-migrations --to-schema-datamodel --script` + `prisma migrate deploy` (entorno no interactivo; `prisma migrate dev` requiere TTY). No se usó `db push`.
- Estado: `Database schema is up to date!` (sin drift).

## Endpoints nuevos

| Método | Ruta | Protección | Rol | Swagger actualizado |
|---|---|---|---|---|
| POST | `/admin/route-assignments` | Bearer | ADMIN, SUPER_ADMIN | Sí |
| GET | `/admin/route-assignments` | Bearer | ADMIN, SUPER_ADMIN | Sí |
| GET | `/admin/route-assignments/:id` | Bearer | ADMIN, SUPER_ADMIN | Sí |
| PATCH | `/admin/route-assignments/:id` | Bearer | ADMIN, SUPER_ADMIN | Sí |
| PATCH | `/admin/route-assignments/:id/suspend` | Bearer | ADMIN, SUPER_ADMIN | Sí |
| GET | `/driver/me/assignments/today` | Bearer | DRIVER, ADMIN, SUPER_ADMIN | Sí |
| POST | `/driver/trips/start` | Bearer | DRIVER, ADMIN, SUPER_ADMIN | Sí |
| POST | `/driver/trips/:id/finish` | Bearer | DRIVER, ADMIN, SUPER_ADMIN | Sí |
| GET | `/driver/trips/current` | Bearer | DRIVER, ADMIN, SUPER_ADMIN | Sí |

## Endpoints modificados

- `GET /mobile/routes`: ahora devuelve `currentOperation` (objeto o `null`) en cada ruta. No rompe compatibilidad (campo aditivo).
- `GET /mobile/routes/:id`: ahora incluye `currentOperation`. No rompe compatibilidad.

## Tests agregados

- `route-assignments.service.spec.ts`: crear válida, ruta inexistente, conductor inexistente, vehículo inexistente, conductor inactivo, vehículo inactivo, conflicto duplicado, edición con trip en progreso, edición de asignación inexistente, listado paginado.
- `driver-operations.service.spec.ts`: asignaciones de hoy, perfil DRIVER no encontrado, iniciar válido, asignación inactiva, asignación de otro driver, conflicto conductor con trip activo, conflicto vehículo con trip activo, finalizar válido, finalizar trip no en progreso, obtener trip actual, sin trip actual.
- `mobile.service.spec.ts` (extendido): `currentOperation` IN_PROGRESS en listado, `null` sin operación, detalle con driver/vehículo/estado, detalle `null`.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm install` | OK (already up to date) |
| `pnpm lint` | OK (0 errores, 0 warnings) |
| `pnpm typecheck` | OK |
| `pnpm build` | OK |
| `pnpm test` | OK — 14 suites, 122 tests |
| `prisma validate` | OK |
| `prisma generate` | OK |
| `prisma migrate status` | OK (up to date, sin drift) |
| `pnpm export:openapi` | OK |
| JSON OpenAPI validado | OK (python json.load; jq no disponible en el entorno) |
| `rg` patrones `any`/`@ts-ignore` | 0 resultados relevantes en código propio |

## OpenAPI

- Endpoints totales: 34
- Schemas totales: 58
- Nuevo archivo exportado: `docs/handoff/ups-expresosapp-openapi.json`
- Validaciones: JSON válido; UUID con `format: uuid`; fechas con `format: date-time`; enums como enum; campos nullable tipados correctamente.

## Riesgos residuales

- El seed usa datos demo claramente marcados como reemplazables (`TODO` en `seed-data.ts`). Las rutas oficiales (Norte/Sur/La Joya) deben confirmarse con datos reales de la operación.
- `prisma migrate dev` no funciona en entornos no interactivos (requiere TTY); se usa el flujo `migrate diff` + `migrate deploy` documentado.
- Los conductores demo se vinculan a cuentas de usuario de rol DRIVER solo para 2 de 5; los demás perfiles de conductor quedan sin cuenta asociada (no pueden iniciar recorridos hasta vincularlos).
- `GET /driver/trips/current` devuelve `200` con `data: null` cuando no hay recorrido activo (decisión documentada para facilidad en la app).

## Qué queda fuera de esta fase

- GPS real (no se captura ubicación ni se piden permisos de ubicación).
- ETA dinámico.
- Notificaciones push.

## Próxima fase recomendada

Fase móvil: mostrar en la app del estudiante rutas + horarios + conductor + vehículo + estado del recorrido (`currentOperation`), y una interfaz mínima para que el conductor inicie/finalice recorridos usando los endpoints de `Driver Operations`. Después, validar el flujo completo con credenciales demo y preparar la fase de tracking GPS (ubicación del bus en el recorrido).