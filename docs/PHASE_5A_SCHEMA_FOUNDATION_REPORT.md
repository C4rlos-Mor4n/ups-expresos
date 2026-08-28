# UPS GO — PHASE 5A SCHEMA FOUNDATION REPORT

## Veredicto

**GO para cerrar Fase 5A como foundation de schema.** La implementación es aditiva, está aplicada en la base local de desarrollo y conserva el modelo legacy. El GO no autoriza todavía backfill, catálogo oficial, APIs nuevas, Mobile, calendario, salidas, assignments ni runs.

## Baseline

- Rama creada: `feature/phase-5a-schema-foundation`.
- `main` estaba sincronizada con `origin/main` mediante `git pull --ff-only origin main`.
- El worktree ya tenía cambios locales y archivos no versionados de fases anteriores; fueron preservados y no se limpiaron.
- `pnpm install --frozen-lockfile`: PASS.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS.
- `pnpm prisma validate`: PASS.
- Baseline de migraciones: 2 migraciones encontradas, base sincronizada.
- El primer intento de `pnpm test` no entregó resumen dentro del límite del ejecutor. La repetición controlada `pnpm exec jest --runInBand` pasó completamente: **14 suites, 123 tests**.
- `pnpm exec ts-node test/swagger/openapi-contract.spec.ts`: PASS.

## Schema changes

Se añadieron exclusivamente las estructuras autorizadas:

- `Campus`.
- `ServiceLine`.
- `RoutePath`.
- `RoutePathStop`.
- `Direction`.
- `ServiceLineType`.

El modelo `Stop` solo recibió la relación inversa `routePathStops`; no se añadieron columnas ni se creó una entidad duplicada de paradas.

No se modificaron `User`, `Route`, `RouteStop`, `Schedule`, `RouteAssignment` ni `Trip`.

## Campus

`Campus` contiene código estable único, nombre, dirección opcional, coordenadas opcionales con el mismo tipo de `Stop` (`Decimal(10,7)`), estado activo y timestamps. Tiene relaciones separadas para campus propietario y campus destino.

No se insertaron campus oficiales ni valores como `CENTENARIO` o `MARIA_AUXILIADORA`.

## ServiceLine

`ServiceLine` representa la línea lógica visible al estudiante. Su identidad es `campusId + code`, por lo que el mismo código puede existir en campus distintos sin hacer `name` único global.

`destinationCampusId` es nullable y permite representar estructuralmente `INTERCAMPUS`. No se implementaron todavía validaciones de dominio, endpoints ni UI para exigir destino o impedir autorreferencias.

## RoutePath

`RoutePath` representa el camino físico planificado asociado a una `ServiceLine`. Incluye `code`, `displayName` requerido, `description` opcional, `Direction`, estado activo y timestamps.

La identidad es `serviceLineId + code`. El índice operativo cubre `serviceLineId + direction + isActive`.

## RoutePathStop

`RoutePathStop` reutiliza `Stop` y permite que una misma parada pertenezca a múltiples paths. Incluye orden y notas opcionales, más `createdAt`. No se añadió `updatedAt` porque el modelo de pertenencia legacy equivalente (`RouteStop`) no usa timestamps de actualización y el prompt dejó ese campo como opcional.

Constraints:

- `UNIQUE(routePathId, stopId)`.
- `UNIQUE(routePathId, stopOrder)`.
- índice por `stopId`.

## Enums

Se añadieron exactamente:

```prisma
enum Direction {
  IDA
  RETORNO
}

enum ServiceLineType {
  CAMPUS_ROUTE
  INTERCAMPUS
}
```

No se introdujeron `OUTBOUND` ni `INBOUND`.

## Migration

Nombre:

`20260828184934_add_transport_domain_foundation`

Archivo:

`apps/api/prisma/migrations/20260828184934_add_transport_domain_foundation/migration.sql`

La migración se creó y aplicó con `pnpm prisma migrate dev --name add_transport_domain_foundation`.

SQL destructivo: **NO**.

La revisión del SQL confirmó únicamente:

- `CREATE TYPE` para los dos enums.
- `CREATE TABLE` para las cuatro tablas nuevas.
- `CREATE INDEX` y `CREATE UNIQUE INDEX`.
- `ADD FOREIGN KEY` con `ON DELETE RESTRICT`.

No contiene `DROP TABLE`, `DROP COLUMN`, `DELETE`, `UPDATE` ni alteraciones destructivas en tablas legacy.

## Legacy impact

Las tablas legacy no recibieron columnas, renombres ni eliminación de datos. `Stop` solo fue referenciado por la nueva FK de `route_path_stops`.

No se creó seed oficial, no se mapearon las siete rutas existentes y no se realizó backfill.

## Existing data preservation

Después de la migración y de la QA transaccional, las tablas nuevas quedaron vacías:

```text
campuses=0
service_lines=0
route_paths=0
route_path_stops=0
```

Conteos legacy observados después de la migración:

```text
routes=7
stops=14
schedules=90
vehicles=5
drivers=5
route_assignments=4
trips=1
trip_feedbacks=15
```

La migración no contiene DML; la QA usó transacciones con rollback y confirmó que no dejó registros.

## Constraints

La QA contra la base real de desarrollo pasó para:

- código único de `Campus`;
- `ServiceLine(campusId, code)` único;
- mismo código de línea permitido en campus distintos;
- `RoutePath(serviceLineId, code)` único;
- `RoutePathStop(routePathId, stopOrder)` único;
- `RoutePathStop(routePathId, stopId)` único;
- FKs requeridas para campus, línea, path y parada;
- `destinationCampusId` nullable y `INTERCAMPUS` estructuralmente insertable.

Todas las transacciones de QA fueron revertidas.

## Indexes

- `Campus.code` unique y `Campus.isActive`.
- `ServiceLine(campusId, code)` unique.
- `ServiceLine(campusId, isActive)`.
- `ServiceLine.destinationCampusId`.
- `RoutePath(serviceLineId, code)` unique.
- `RoutePath(serviceLineId, direction, isActive)`.
- `RoutePathStop(routePathId, stopId)` unique.
- `RoutePathStop(routePathId, stopOrder)` unique.
- `RoutePathStop.stopId`.

No se añadió un índice redundante sobre `routePathId + stopOrder`, porque el índice unique obligatorio ya cubre esa consulta.

## Prisma validations

- `pnpm prisma format`: PASS.
- `pnpm prisma validate`: PASS.
- `pnpm prisma generate`: PASS.
- `pnpm prisma migrate status`: PASS; 3 migraciones encontradas y base sincronizada.

## Backend validations

No se crearon módulos NestJS, controllers, services, DTOs ni validaciones de dominio en Fase 5A. `lint`, `typecheck` y `build` de `apps/api` pasan.

## OpenAPI regression

`pnpm exec ts-node test/swagger/openapi-contract.spec.ts`: PASS (`openapi contract checks passed`).

No se modificaron endpoints ni contratos HTTP como parte de esta fase.

## Mobile impact

```text
Mobile modified: NO
API contracts modified: NO
```

Los cambios Mobile/API ya presentes en el worktree pertenecen a fases anteriores y fueron preservados; Fase 5A no añadió modificaciones en `apps/mobile` ni en los módulos HTTP.

## Risks

- Las tablas nuevas están vacías y todavía no tienen catálogo oficial.
- No existe aún mapping aprobado de las siete rutas legacy a campus, líneas y paths.
- `INTERCAMPUS` solo tiene soporte estructural; su regla de destino se validará en la capa de dominio futura.
- No se implementaron `SchedulePattern`, `ScheduledDeparture`, `ServiceAssignment` ni `ServiceRun`.
- `User.defaultCampusId` permanece fuera de Fase 5A.
- La base local de desarrollo fue migrada; producción requiere revisión y despliegue posterior con `prisma migrate deploy` bajo autorización.

## Next Phase Recommendation

Mantener el legacy como fuente funcional de Mobile y avanzar a Fase 5B únicamente después de aprobar el catálogo y las reglas de calendario. La siguiente fase debe agregar programación de forma aditiva, sin retirar los modelos legacy ni cambiar contratos existentes.
