# UPS GO — PHASE 5A SCHEMA FOUNDATION REVIEW

## Veredicto

**GO para commit, PR y posterior merge de Fase 5A**, sujeto a mantener separados los cambios históricos ya presentes en el worktree. La foundation revisada es aditiva, reproducible y no destructiva. No se autoriza en este review implementar Fase 5B, hacer backfill ni cambiar Mobile o contratos API.

## Git Scope

Rama confirmada:

```text
feature/phase-5a-schema-foundation
```

`main` estaba alineada con `origin/main` cuando se creó la rama. El worktree contiene cambios locales históricos de branding UPS GO, documentación, configuración, assets y handoff que ya existían antes de Fase 5A y fueron preservados.

Cambios atribuibles a Fase 5A:

- `apps/api/prisma/schema.prisma`.
- `apps/api/prisma/migrations/20260828184934_add_transport_domain_foundation/migration.sql`.
- `docs/PHASE_5A_SCHEMA_FOUNDATION_REPORT.md`.
- Este reporte de review.

No se debe mezclar el resto del worktree en el commit de Fase 5A.

## Schema

El diff semántico de `schema.prisma` añade únicamente:

- `Direction`.
- `ServiceLineType`.
- `Campus`.
- `ServiceLine`.
- `RoutePath`.
- `RoutePathStop`.
- La relación inversa `Stop.routePathStops`.

No se modificaron columnas, enums, relaciones operativas ni contratos de `Route`, `RouteStop`, `Schedule`, `RouteAssignment`, `Trip`, `User`, `Vehicle`, `Driver` o `TripFeedback`.

No existen `apps/web`, módulos NestJS nuevos ni consumo del dominio nuevo desde servicios existentes.

## Migration

Migración revisada:

`apps/api/prisma/migrations/20260828184934_add_transport_domain_foundation/migration.sql`

Incluye:

- 2 `CREATE TYPE`.
- 4 `CREATE TABLE`.
- índices normales y únicos.
- 5 FKs.

La migración se reprodujo en una PostgreSQL temporal aislada desde cero, aplicando en orden:

```text
20260630003417_init_mvp_schema
20260827_add_route_operations
20260828184934_add_transport_domain_foundation
```

Las tres migraciones aplicaron correctamente y el contenedor temporal fue retirado después de la prueba.

## Destructive SQL Audit

Resultado: **NO DESTRUCTIVO**.

El escaneo de sentencias destructivas no encontró `DROP`, `DELETE`, `UPDATE`, `TRUNCATE`, `RENAME` ni alteraciones destructivas. El SQL solo agrega tipos, tablas, índices y FKs.

Las FKs usan `ON DELETE RESTRICT`. Prisma genera `ON UPDATE CASCADE` por defecto; no representa riesgo práctico aquí porque las PK UUID no se editan y la política de borrado conservadora está aplicada.

## Campus

Validado:

- UUID y `@db.Uuid` consistentes.
- `code` único.
- `name` requerido.
- `address` opcional.
- `latitude` y `longitude` opcionales con `Decimal(10,7)`, igual que `Stop`.
- `isActive`, `createdAt` y `updatedAt`.
- relaciones de líneas propietarias y líneas destino.

No se insertaron campus oficiales.

## ServiceLine

`ServiceLine` representa la línea lógica visible al estudiante, no el recorrido físico.

Validado:

- `campusId` requerido.
- `code` estable.
- `name` y `description`.
- `type` con `CAMPUS_ROUTE` por defecto.
- `destinationCampusId` nullable.
- `isActive` y timestamps.
- `UNIQUE(campusId, code)`.
- `name` no es unique global.

La QA aceptó `NORTE` en dos campus distintos y rechazó el duplicado dentro del mismo campus.

## RoutePath

`RoutePath` representa el camino físico planificado y reutilizable.

Validado:

- vínculo requerido a `ServiceLine`;
- `code` y `displayName` requerido;
- `description` opcional;
- `direction` con `IDA` o `RETORNO`;
- `isActive` y timestamps;
- `UNIQUE(serviceLineId, code)`;
- índice `serviceLineId + direction + isActive`.

No se insertaron paths como `GARZOTA`, `SAMANES` o `SAUCES`.

## RoutePathStop

Reutiliza el modelo `Stop`; no duplica paradas físicas.

Validado:

- `routePathId` requerido.
- `stopId` requerido.
- `stopOrder` requerido.
- `notes` opcional.
- `UNIQUE(routePathId, stopId)`.
- `UNIQUE(routePathId, stopOrder)`.
- índice por `stopId`.

La QA confirmó que una misma parada puede participar en paths distintos y que los duplicados de parada u orden se rechazan.

`createdAt` está presente; `updatedAt` no se añadió porque el modelo de pertenencia legacy equivalente no lo usa y el diseño lo dejó opcional.

## Constraints

QA contra la base real de desarrollo, siempre con rollback:

```text
Campus.code unique: PASS
ServiceLine campus+code unique: PASS
mismo code en campus diferentes: PASS
RoutePath serviceLine+code unique: PASS
RoutePathStop path+order unique: PASS
RoutePathStop path+stop unique: PASS
FK inválida Campus: rechazo esperado PASS
FK inválida ServiceLine: rechazo esperado PASS
FK inválida RoutePath: rechazo esperado PASS
FK inválida Stop: rechazo esperado PASS
```

No quedó basura de QA.

## Foreign Keys

Todas las relaciones esperadas existen:

```text
ServiceLine.campusId → Campus
ServiceLine.destinationCampusId → Campus nullable
RoutePath.serviceLineId → ServiceLine
RoutePathStop.routePathId → RoutePath
RoutePathStop.stopId → Stop
```

La política `ON DELETE RESTRICT` evita borrar campus, líneas, paths o paradas referenciadas accidentalmente.

## Indexes

Los índices generados son razonables y cubren:

- `Campus.code` unique y `isActive`.
- `ServiceLine(campusId, code)` unique.
- `ServiceLine(campusId, isActive)`.
- `ServiceLine.destinationCampusId`.
- `RoutePath(serviceLineId, code)` unique.
- `RoutePath(serviceLineId, direction, isActive)`.
- `RoutePathStop(routePathId, stopId)` unique.
- `RoutePathStop(routePathId, stopOrder)` unique.
- `RoutePathStop.stopId`.

No se encontró índice redundante grave. El unique de `routePathId + stopOrder` ya cubre esa consulta.

## Legacy Data

Conteos antes y después de la QA transaccional:

```text
                 antes   después
campuses             0        0
service_lines        0        0
route_paths          0        0
route_path_stops     0        0
routes               7        7
stops               14       14
schedules            90       90
vehicles              5        5
drivers               5        5
route_assignments     4        4
trips                 1        1
trip_feedbacks       15       15
```

La reproducción aislada confirmó además que el schema completo puede construirse desde las migraciones anteriores sin intervención manual.

## Backfill Check

PASS: las tablas nuevas permanecen vacías.

No existen registros nuevos de Norte, Sur, La Joya, Centenario, María Auxiliadora ni mapping legacy. No se modificó el seed oficial.

## Prisma

- `pnpm prisma validate`: PASS.
- `pnpm prisma generate`: PASS.
- `pnpm prisma migrate status`: PASS; 3 migraciones, schema al día.
- `pnpm prisma migrate diff --from-url ... --to-schema-datamodel ... --exit-code`: PASS; `No difference detected`.
- `pnpm prisma format` en copia aislada: PASS.

La prueba de idempotencia del formatter detectó únicamente ajustes de alineación en líneas históricas de modelos legacy. Es un hallazgo de formato, no de schema ni de SQL, y no se modificó para preservar el alcance.

## Backend

PASS:

- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm build`.
- No hay controllers, DTOs, services ni módulos nuevos de Campus/ServiceLine/RoutePath.

## Tests

`pnpm exec jest --runInBand`: **14 suites y 123 tests PASS**.

Los mensajes de error SMTP observados pertenecen a casos esperados de pruebas de `MailService`; no produjeron fallos.

## OpenAPI

`pnpm test:openapi`: PASS (`openapi contract checks passed`).

No se añadieron, eliminaron ni modificaron endpoints por Fase 5A.

## Mobile

Fase 5A no introdujo cambios en `apps/mobile`. El diff Mobile existente corresponde al trabajo histórico de identidad UPS GO y fue separado de esta review.

## API Contracts

```text
0 controllers nuevos
0 endpoints nuevos
0 endpoints eliminados
0 DTOs cambiados por Fase 5A
```

Los servicios actuales continúan usando el dominio legacy.

## Findings

### LOW-01 — Formato completo del schema no es idempotente

- Evidencia: ejecutar `prisma format` sobre una copia aislada ajusta alineación/comentarios de modelos legacy preexistentes.
- Riesgo técnico: ruido de diff y posible mezcla de housekeeping con cambios de dominio.
- Riesgo de negocio: ninguno identificado.
- Recomendación: tratarlo como limpieza independiente; no mezclarlo con Fase 5A.
- Bloquea GO: **NO**.

### INFO-01 — Swagger está deshabilitado en el proceso por defecto

- Evidencia: `GET http://127.0.0.1:3000/docs` devuelve 404 con `SWAGGER_ENABLED=false`.
- Validación: un arranque temporal con `SWAGGER_ENABLED=true` devolvió `/docs` 200, `/health` 200, `/health/db` 200 y `/mobile/routes` 401.
- Riesgo: el smoke esperado de `/docs` requiere habilitar Swagger explícitamente.
- Atribución: configuración histórica, no regresión de Fase 5A.
- Bloquea GO: **NO**.

No se encontraron hallazgos CRITICAL, HIGH o MEDIUM.

## Fixes Applied

Ninguno. La auditoría fue read-only respecto al código, schema y migraciones. Solo se creó este reporte solicitado.

## Risks

- El catálogo nuevo está vacío y requiere aprobación operativa antes del backfill.
- El mapping de las siete rutas legacy sigue pendiente.
- `INTERCAMPUS` tiene soporte estructural, pero sus reglas de dominio aún no existen.
- Calendarios, horarios nuevos, salidas, assignments y runs pertenecen a fases posteriores.
- El worktree no está limpio; el commit debe seleccionar exclusivamente los archivos de Fase 5A.

## Decision

```text
Commit: YES — autorizado después de separar el scope de Fase 5A
PR: YES — autorizado después del commit limpio
Merge: YES — autorizado solo tras revisión del PR
Proceed Phase 5B Design: NO — no se inicia dentro de esta auditoría
Proceed Phase 5B Implementation: NO
```

La secuencia segura posterior es: preparar un commit limpio de Fase 5A, abrir PR, revisar/mergear y recién después decidir el diseño de Fase 5B. La implementación de Fase 5B permanece fuera de este review.
