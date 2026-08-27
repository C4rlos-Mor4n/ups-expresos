# REPORTE DE AUDITORÍA — PHASE 1 ROUTE OPERATIONS REVIEW

## Veredicto

**GO** ✅ — La Fase 1 está lista para commit, PR y merge. Se detectaron y corrigieron hallazgos durante la revisión; las validaciones finales pasan con evidencia.

## Resumen ejecutivo

La auditoría revisó migración Prisma, modelos, reglas de negocio, seguridad, compatibilidad mobile, OpenAPI, tests y QA manual. La rama `feature/phase-1-route-operations` implementa la base operativa del MVP (asignaciones de ruta, recorridos manuales del conductor, estado visible para estudiantes). No se usó `db push`, no se rompieron contratos existentes, no hay `any` TypeScript. Se aplicaron 3 fixes pequeños y justificados detectados en la revisión (concurrencia en `startTrip`, `currentOperation` por fecha, nullable en OpenAPI).

## Hallazgos por severidad

| Severidad | Hallazgo | Evidencia | Impacto | Recomendación |
|---|---|---|---|---|
| MEDIUM | Carrera TOCTOU en `startTrip`: verificación y creación del trip fuera de transacción | `driver-operations.service.ts` (antes del fix) consultaba `findCurrentByDriver/Vehicle` y luego `trip.create` sin `$transaction` | Dos peticiones concurrentes podían crear dos trips `IN_PROGRESS` para el mismo conductor/vehículo | **FIX APLICADO**: `$transaction` con aislamiento `Serializable`; `P2034` → 409 |
| MEDIUM | `currentOperation` mostraba asignaciones pasadas activas | `mobile.service.ts` `buildCurrentOperation` usaba `orderBy: serviceDate desc` sin filtrar por hoy | La app del estudiante vería una operación vieja como actual; `currentOperation` nunca sería `null` con una asignación pasada activa | **FIX APLICADO**: filtrar por `serviceDate` de hoy |
| LOW | `CurrentTripWrapperDto.data` no marcado `nullable` en OpenAPI | schema OpenAPI mostraba `type: object` sin `nullable` | Documentación imprecisa del contrato | **FIX APLICADO**: `nullable: true` |
| LOW | `Driver.userId @unique` nullable con múltiples NULL | Migración: `ADD COLUMN userId UUID` + UNIQUE INDEX | PostgreSQL permite múltiples NULL → drivers existentes sin usuario no rompen | No requiere acción; verificado |
| INFO | Conteo de operaciones vs paths | OpenAPI: 34 paths, **55 operaciones** | Reporte inicial citó 34 como si fueran endpoints | Documentado correctamente en este reporte |

## Compatibilidad

- Endpoints existentes preservados: **Sí** (rutas, stops, schedules, vehicles, drivers, notices, auth, trip-feedback intactos).
- Mobile responses compatibles: **Sí** (`MobileRouteResponseDto extends RouteResponseDto`, aditivo `currentOperation`; detalle conserva `route`, `stops`, `schedules`).
- Swagger actualizado: **Sí** (tags `Admin Route Assignments`, `Driver Operations`).
- OpenAPI importable en Apidog: **Sí** (JSON válido, 55 operaciones, 58 schemas, UUID/date-time/enums/nullables correctos).

## Prisma y migración

- Migración revisada: `20260827_add_route_operations` — no destructiva (solo `ADD COLUMN` nullable, `CREATE TABLE`, `CREATE INDEX`, FK).
- Drift: **ninguno** (`prisma migrate status` → up to date).
- Riesgos de datos: `Driver.userId` es nullable; drivers existentes quedan con `NULL` (permitido por UNIQUE en PostgreSQL). FK `ON DELETE SET NULL` es seguro.
- Relaciones nuevas: `RouteAssignment`→`Route`/`Driver`/`Vehicle` (`ON DELETE RESTRICT`), `Trip`→`RouteAssignment`/`Route`/`Driver`/`Vehicle` (`ON DELETE RESTRICT`), `Driver`→`User` (`ON DELETE SET NULL`).

## Seguridad

- Admin endpoints protegidos: **Sí** (`@ApiBearerAuth`, `@Roles(ADMIN, SUPER_ADMIN)`, JwtAuthGuard global).
- Driver endpoints protegidos: **Sí** (`@Roles(DRIVER, ADMIN, SUPER_ADMIN)`, JwtAuthGuard global).
- Roles correctos: verificados en controllers; se rechaza DRIVER en admin y se exige pertenencia (Forbidden) en operaciones de conductor.
- Riesgos: ninguno crítico. `@SkipThrottle({ auth: true })` es consistente con los controllers existentes del repo.

## QA manual

| Flujo | Resultado | Evidencia (sin secretos) |
|---|---|---|
| `GET /health` | 200 | `{"status":"ok","service":"UPS ExpresosApp API"}` |
| `GET /driver/me/assignments/today` | 200 | Asignaciones del día con ruta, vehículo, conductor |
| `POST /driver/trips/start` | 201 | Trip `IN_PROGRESS`, `startedAt` seteado |
| `GET /driver/trips/current` | 200 | `data` con trip IN_PROGRESS + ruta + vehículo |
| `POST /driver/trips/:id/finish` | 200 | Trip y asignación `COMPLETED`, `endedAt` seteado |
| `GET /mobile/routes` | 200 | `currentOperation`: `SCHEDULED` para asignaciones de hoy, `COMPLETED` para la ruta finalizada, `null` para rutas sin operación |

Nota: el puerto 3000 puede estar ocupado por otra aplicación local; el API de la fase se levanta en el puerto 3101 para QA:

```bash
cd apps/api
pnpm build
PORT=3101 node dist/main.js
```

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm lint` | OK |
| `pnpm typecheck` | OK |
| `pnpm build` | OK |
| `pnpm test` | OK — 14 suites, 123 tests |
| `pnpm prisma validate` | OK (schema válido) |
| `pnpm prisma generate` | OK |
| `pnpm prisma migrate status` | OK (up to date, sin drift) |
| `pnpm export:openapi` | OK |
| JSON OpenAPI validado | OK (python `json.load`; `jq` no disponible en el entorno) |
| Búsqueda `any`/`@ts-ignore` | 0 en código propio (`expect.any` de Jest es excepción válida) |

## Riesgos residuales

- El seed usa datos demo marcados como reemplazables (`TODO` en `seed-data.ts`); rutas oficiales deben confirmarse.
- Solo 2 de 5 conductores demo tienen cuenta de usuario DRIVER vinculada; los demás no pueden iniciar recorridos hasta vincularlos.
- `prisma migrate dev` requiere TTY (no funciona en entornos no interactivos); se usa `migrate diff` + `migrate deploy` documentado.
- `currentOperation` usa la zona horaria del servidor para el "día de hoy"; validar la zona horaria de despliegue.
- El conteo de endpoints debe reportarse por **operaciones** (55), no por paths (34).

## Decisión

- **Commit**: Sí (solo los archivos de la Fase 1; excluir `apps/mobile/*` y `scripts/` que son cambios heredados de setup previo).
- **Pull Request**: Sí, hacia `main`.
- **Merge**: Sí, tras revisión del PR.
- **Entrega al equipo mobile/frontend**: Sí, ya pueden consumir `currentOperation` en `GET /mobile/routes` y `GET /mobile/routes/:id`.

## Siguiente acción recomendada

1. Hacer commit de la Fase 1 (excluyendo cambios heredados de mobile/scripts).
2. Abrir PR hacia `main`.
3. Actualizar Apidog con `docs/handoff/ups-expresosapp-openapi.json`.
4. Avisar al equipo mobile que puede consumir `currentOperation`.
5. Arrancar la fase móvil para mostrar rutas + horarios + conductor + vehículo + estado del recorrido.