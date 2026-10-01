# UPS GO — Phase 5B-A Calendar Schema Review

## 1. Verdict

**Resultado técnico local: GO con observaciones no bloqueantes de schema.** La
migración es aditiva, reproducible en PostgreSQL 17 temporal, no destructiva y
cumple el scope de Fase 5B-A.

**Cierre de release: CONDITIONAL.** No existe todavía una ejecución CI remota
para esta rama/SHA porque la rama no fue publicada; las reglas de esta revisión
prohíben push. Por ello no certifico todavía commit, push, PR ni merge.

## 2. Scope

Se revisaron el schema, la migración, los seis documentos obligatorios, el
reporte de implementación, el workflow CI, la base local y una base PostgreSQL
17 temporal limpia.

El scope físico contiene exactamente:

```text
ServiceCalendar
SchedulePattern
SchedulePatternDay
ScheduleTime
ScheduleJourneyTemplate
ScheduledStopTime
ServiceException
```

No existen en schema, migración ni base local:

```text
ScheduledDeparture
ScheduledDepartureTemplate
ServiceAssignment
ServiceRun
ServiceExceptionTime
```

No se modificaron API funcional, Mobile, seed, contratos, fixture, catálogo,
backfill ni `apps/web`.

## 3. Schema

El schema actual parte del baseline certificado
`87857d69f6e7187d0f3076c9f58e8bdb87a1714d` y añade únicamente enums, modelos e
inverse relations necesarias:

- `ServiceLine.calendars`.
- `RoutePath.journeyTemplates`.
- `RoutePathStop.scheduledStopTimes`.

Los modelos legacy y la fundación 5A no recibieron cambios destructivos. La
relación física nueva está correctamente separada de `Route`, `Schedule`,
`RouteAssignment` y `Trip`.

La implementación usa `Weekday` en `SchedulePatternDay.weekday` y deja
`DayOfWeek` legacy intacto en `Schedule`. Esto evita mezclar representaciones
dentro del nuevo dominio. El texto pseudo-modelo de un documento de freeze
anterior usa `dayOfWeek DayOfWeek`; la instrucción de review y la decisión de
compatibilidad del build establecen `Weekday` para el dominio nuevo. Esta
inconsistencia documental no altera el contrato legacy, pero debe mantenerse
explícita.

## 4. ServiceCalendar

La definición coincide con el freeze:

- `serviceLineId UUID NOT NULL`.
- `validFrom DATE NOT NULL`.
- `validUntil DATE NOT NULL`.
- `timezone TEXT NOT NULL DEFAULT 'America/Guayaquil'`.
- `status SchedulePublicationStatus NOT NULL DEFAULT DRAFT`.
- timestamps `TIMESTAMPTZ(3)`.
- FK a `ServiceLine` con `ON DELETE RESTRICT`.
- índice `(serviceLineId, validFrom, validUntil, status)`.

Existe físicamente `CHECK ("validFrom" <= "validUntil")` mediante
`service_calendars_valid_range_check`.

No existe exclusion constraint ni unique que prohíba solapamientos de
calendarios. Esto es correcto para 5B-A: los drafts pueden solaparse y la
publicación de calendarios PUBLISHED debe aplicar posteriormente un workflow
transaccional por línea, hasta cerrar la semántica de perfiles.

## 5. SchedulePattern

La definición coincide con el freeze:

- FK obligatoria a `ServiceCalendar`, `RESTRICT`.
- `direction Direction NOT NULL`.
- `type SchedulePatternType DEFAULT EXPLICIT_TIMES`.
- `status DRAFT | PUBLISHED | ARCHIVED`.
- `name` nullable y descriptivo.
- `exceptionId` nullable, FK a `ServiceException`, `RESTRICT`.
- índices `(serviceCalendarId, direction, status)` y `(exceptionId, direction)`.

`EXPLICIT_TIMES` es el único tipo. No hay frecuencia, headway, vehículo,
conductor, capacidad ni `RoutePath` directo.

## 6. ScheduleTime

La base real confirma:

- `departureTime TIME(0) NOT NULL`.
- `approximateArrivalTime TIME(0) NULL`.
- FK a `SchedulePattern`, `RESTRICT`.
- unique `(schedulePatternId, departureTime)`.

La misma hora en patrones distintos se permite; la misma hora dentro del
mismo patrón se rechaza.

## 7. JourneyTemplate

`ScheduleJourneyTemplate` vincula:

```text
ScheduleTime -> ScheduleJourneyTemplate -> RoutePath
```

Tiene FKs `RESTRICT`, unique `(scheduleTimeId, routePathId)` e índice sobre
`routePathId`. Una misma hora puede tener múltiples templates para caminos
distintos y varios buses futuros podrán seleccionar el mismo template. No se
colapsan horas nominales pertenecientes a patrones distintos.

La relación no contiene estado operativo, vehículo, conductor ni GPS.

## 8. ScheduledStopTime

La definición real coincide con el freeze:

- `journeyTemplateId UUID NOT NULL`.
- `routePathStopId UUID NOT NULL`.
- `offsetMinutes INT NOT NULL`.
- unique `(journeyTemplateId, routePathStopId)`.
- índice `(journeyTemplateId, offsetMinutes)`.
- FKs `RESTRICT`.
- `CHECK ("offsetMinutes" >= 0)` mediante
  `scheduled_stop_times_offset_minutes_check`.

No existen `plannedTime`, `arrivalTime` ni `departureTime` en esta tabla ni en
`RoutePathStop`. La ruta física conserva solamente paradas y orden.

Las reglas de primer offset cero, offsets no decrecientes y pertenencia exacta
de todas las paradas son invariantes de dominio futuras; no están ocultas como
si fueran garantías de estas FKs simples.

## 9. ServiceException

La definición real contiene:

```text
serviceCalendarId UUID NOT NULL
serviceDate DATE NOT NULL
direction Direction NULL
reason HOLIDAY | VACATION | EXAM_PERIOD
effect NO_SERVICE | REPLACE_TIMES | ADD_TIMES
status DRAFT | PUBLISHED | CANCELLED
description TEXT NOT NULL
```

La excepción reutiliza las horas mediante:

```text
ServiceException
  -> SchedulePattern.exceptionId
    -> ScheduleTime
      -> ScheduleJourneyTemplate
        -> ScheduledStopTime
```

No existe `ServiceExceptionTime`.

## 10. Exception Scope

### Decisión

**EXCEPTION SCOPE: CORRECTA PARA EL FREEZE — `ServiceCalendar + fecha + dirección`.**

El SQL implementado limita una excepción global por
`(serviceCalendarId, serviceDate)` y una direccional por
`(serviceCalendarId, serviceDate, direction)`, excluyendo `CANCELLED`.

La excepción pertenece al calendario porque solo modifica la programación de
ese calendario. No es una regla global de la línea independiente de la
versión/calendario.

### Riesgo condicionado

Si dos calendarios PUBLISHED de la misma `ServiceLine` cubrieran la misma
fecha, PostgreSQL permitiría excepciones separadas en cada calendario. Esto no
es un defecto del índice de 5B-A: es la consecuencia conocida de que el
solapamiento PUBLISHED todavía se bloquea por workflow y no por constraint.
Una política futura de excepción a nivel de línea exigiría una decisión de
dominio y migración separadas.

## 11. Partial Indexes

Los índices reales son:

```sql
service_exceptions_active_global_uq
  ("serviceCalendarId", "serviceDate")
  WHERE "direction" IS NULL
    AND "status" IN ('DRAFT', 'PUBLISHED')

service_exceptions_active_direction_uq
  ("serviceCalendarId", "serviceDate", "direction")
  WHERE "direction" IS NOT NULL
    AND "status" IN ('DRAFT', 'PUBLISHED')
```

La prueba aislada confirmó:

- dos globales activas para la misma fecha: rechazadas;
- una global `DRAFT` y otra `PUBLISHED`: rechazadas;
- una global y `IDA`/`RETORNO`: permitidas;
- dos excepciones `IDA` activas: rechazadas;
- `CANCELLED` histórico junto a una activa: permitido.

Impedir `DRAFT + PUBLISHED` es una decisión editorial estricta del freeze.
Admin no puede preparar en paralelo una excepción del mismo alcance mientras
existe otra activa publicada; si el workflow futuro necesita versionado en
paralelo, habrá que cambiar esta política deliberadamente.

## 12. Temporal Source of Truth

**Decisión C, sin ambigüedad operativa:**

- `ScheduleTime.departureTime` es la fuente de salida de la plantilla.
- `ScheduledStopTime.offsetMinutes` es la única fuente de tiempos planificados
  por parada: `departureTime + offsetMinutes`.
- `approximateArrivalTime` se conserva como metadata opcional y general de
  llegada aproximada del servicio, no como fuente de tiempos por parada y no
  como ETA GPS.
- Un resolver futuro no debe usar `approximateArrivalTime` para calcular
  paradas; los offsets ganan siempre.
- Antes de publicar, un servicio de dominio futuro debe validar o marcar una
  discrepancia entre la metadata de llegada aproximada y el offset terminal.

Así, el campo conservado no compite con el timetable publicado. Esta regla no
requiere eliminar el campo congelado, pero sí debe ser obligatoria antes de
5B-B resolver/implementación.

## 13. Constraints

Verificadas físicamente y funcionalmente en la base temporal:

| Regla | Resultado |
| --- | --- |
| `validFrom > validUntil` | Rechazada por CHECK |
| weekday duplicado dentro de patrón | Rechazado por unique |
| misma hora dentro de patrón | Rechazada por unique |
| misma hora en patrón diferente | Permitida |
| template duplicado `(time, path)` | Rechazado por unique |
| offset negativo | Rechazado por CHECK |
| stop duplicado en template | Rechazado por unique |
| exception global duplicada | Rechazada por índice parcial |
| exception direccional duplicada | Rechazada por índice parcial |
| global + `IDA` + `RETORNO` | Permitido, por alcance distinto |

No se probaron invariantes de publicación, precedencia o pertenencia cruzada
como si fueran constraints SQL: corresponden a la futura transacción de
dominio.

## 14. Foreign Keys

Las diez FKs nuevas fueron consultadas en PostgreSQL y todas reportan
`delete_rule = RESTRICT`. No hay cascada que pueda borrar calendarios,
patrones, templates, timetable ni historial de excepciones accidentalmente.

Siguen siendo invariantes application-level:

1. `ScheduleTime.pattern.serviceCalendar.serviceLine` debe coincidir con
   `ScheduleJourneyTemplate.routePath.serviceLine`.
2. `SchedulePattern.direction` debe coincidir con `RoutePath.direction`.
3. Cada `RoutePathStop` debe pertenecer al `RoutePath` del template.
4. `exceptionId` y `serviceCalendarId` deben pertenecer al mismo calendario.

No se añadieron FKs redundantes para simular estas reglas.

## 15. Migration

Migración auditada:

`apps/api/prisma/migrations/20260828204322_add_calendar_timetable_foundation/migration.sql`

Solo contiene `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` y `ALTER TABLE ...
ADD CONSTRAINT/FOREIGN KEY` sobre entidades nuevas. La búsqueda de
`DROP|DELETE|UPDATE|TRUNCATE|RENAME|DROP COLUMN|ALTER COLUMN` no encontró
operaciones destructivas.

## 16. Migration Reproduction

Se creó una base temporal aislada sobre PostgreSQL 17.10, se ejecutó:

```text
pnpm prisma migrate deploy
```

Resultado: las cuatro migraciones, desde `init` hasta
`add_calendar_timetable_foundation`, aplicaron correctamente. Después se
ejecutaron pruebas aisladas de constraints e índices y finalmente se eliminó
únicamente la base temporal. La consulta posterior confirmó que esa base ya no
existe (`0` registros en `pg_database`).

La base de desarrollo no fue destruida ni utilizada para la reproducción
limpia.

## 17. Legacy Preservation

La base de desarrollo conserva:

```text
routes              7
stops              14
schedules           90
vehicles             5
drivers              5
route_assignments    4
trips                1
trip_feedbacks      15
```

Las tablas 5A permanecen presentes y sin datos modificados:
`campuses`, `service_lines`, `route_paths`, `route_path_stops`.

Las siete tablas nuevas permanecen vacías en desarrollo. No hubo backfill ni
reinterpretación del JSON de Guayaquil.

## 18. Prisma

Evidencia local final:

- `pnpm prisma validate`: PASS.
- `pnpm prisma generate`: PASS, Prisma Client `6.19.3`.
- `pnpm prisma migrate status`: PASS, database up to date.
- `pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: PASS, `No difference detected`.

El diff funcional del schema contra baseline contiene solo las adiciones de
5B-A. La comprobación de whitespace de schema, migration y este reporte está
limpia.

## 19. Backend

No se modificaron módulos, controllers, services, DTOs ni lógica backend. La
única modificación de `apps/api` propia de esta fase es `schema.prisma` y la
migración candidata.

## 20. Tests

Ejecutados desde `apps/api`:

```text
pnpm lint                         PASS
pnpm typecheck                    PASS
pnpm build                        PASS
pnpm exec jest --runInBand        PASS — 14 suites, 123 tests
```

Los errores SMTP visibles pertenecen a escenarios mockeados de las pruebas de
correo; Jest terminó con cero fallos.

## 21. OpenAPI

`pnpm test:openapi` terminó con `openapi contract checks passed`.

Resultado de scope:

```text
0 endpoints nuevos
0 endpoints eliminados
0 DTOs públicos modificados
```

No aplica actualizar OpenAPI porque esta fase no cambia contratos.

## 22. Mobile

Impacto de Fase 5B-A: **NONE**.

El worktree muestra cambios Mobile históricos de UPS GO y whitespace existente
en esos archivos, pero no fueron creados por esta revisión. La comprobación
global `git diff --check` los reporta; los archivos propios de 5B-A no tienen
whitespace problemático. No se tocó Mobile durante el review.

## 23. Findings

| ID | Severidad | Hallazgo | Impacto | Bloquea |
| --- | --- | --- | --- | --- |
| F5BA-R01 | MEDIUM | No hay CI remoto para esta rama/SHA: `gh run list ... --branch feature/phase-5b-calendar-schema` devolvió `[]`; el ref remoto tampoco existe. | Impide certificar reproducibilidad oficial Node 20 + pnpm 10.34.5. | Cierre release, commit/push/PR/merge gate. No bloquea el schema local. |
| F5BA-R02 | LOW | `approximateArrivalTime` necesita la semántica explícita definida en esta revisión. | Sin regla, un resolver futuro podría usar dos fuentes. | 5B-B resolver; no bloquea migración vacía. |
| F5BA-R03 | LOW | Excepción scoped por calendario permite duplicidad entre calendarios solapados. | Ambigüedad solo si se publican calendarios solapados de una línea. | Publicación/resolver/backfill; no bloquea 5B-A. |
| F5BA-R04 | INFO | Pertenencia cruzada línea/sentido/path/exception no está garantizada por FKs simples. | Datos mal relacionados serían posibles sin transacción de dominio. | Servicio de dominio futuro; no bloquea schema. |
| F5BA-R05 | INFO | El pseudo-freeze usa `DayOfWeek`, mientras el build usa `Weekday`. | Debe conservarse la decisión documental para evitar futuras mezclas. | Documentación/implementación posterior; no rompe legacy. |

No se encontraron hallazgos CRITICAL ni HIGH. No se justificó ningún fix de
código o SQL durante esta auditoría.

## 24. Fixes Applied

Ninguno. La revisión fue read-only sobre implementación y base de desarrollo.
El único archivo creado por esta auditoría es este reporte.

## 25. Remaining Risks

- Ejecutar CI remoto sobre el commit candidato usando Node 20 y pnpm 10.34.5.
- Definir el workflow de publicación que impida calendarios PUBLISHED
  solapados por `ServiceLine`.
- Implementar validaciones transaccionales de pertenencia y offsets antes del
  resolver.
- Confirmar si el workflow editorial acepta o no preparar `DRAFT` junto a una
  excepción activa publicada.
- Mantener separados timetable publicado, `ScheduledDeparture` futura y
  `ServiceRun` real.
- No cargar catálogo, fixture ni backfill hasta aprobación independiente.

## 26. Decision

```text
COMMIT:                 NO — prohibido durante esta revisión
PUSH:                   NO — prohibido durante esta revisión
PR:                     NO — prohibido durante esta revisión
MERGE:                  NO — no existe CI candidato ni PR

GO 5B-A CLOSURE:        CONDITIONAL — local PASS; pendiente CI remoto candidato
GO 5B-B DESIGN:         NO — no iniciar en este turno
GO 5B-B IMPLEMENTATION: NO
GO 5C IMPLEMENTATION:   NO
GO BACKFILL:            NO
GO DEV FIXTURE:         NO
```

### Delivery Gate — Independent Review

| Check | Estado | Evidencia |
|---|---|---|
| schema additive | PASS | Diff de `schema.prisma`: solo enums, modelos e inverse relations 5B-A |
| migration reproducible | PASS | `migrate deploy` en PostgreSQL 17 temporal, cuatro migraciones aplicadas |
| SQL non-destructive | PASS | Auditoría de patrones destructivos sin coincidencias |
| CHECK constraints | PASS | Dos checks presentes y probados con rechazos |
| partial indexes semantically correct | PASS condicionado | Scope por calendar coincide con freeze; overlap de calendars queda en workflow |
| exception scope correct | PASS condicionado | Correcto por `ServiceCalendar`; riesgo documentado para overlap publicado |
| temporal source unambiguous | PASS condicionado | Offsets son autoridad por parada; approximate arrival es metadata |
| Prisma | PASS | validate, generate, status y diff sin diferencias |
| lint | PASS | `pnpm lint` |
| typecheck | PASS | `pnpm typecheck` |
| build | PASS | `pnpm build` |
| tests | PASS | 14 suites, 123 tests |
| OpenAPI | PASS | `pnpm test:openapi` |
| legacy preserved | PASS | Conteos legacy sin cambios |
| 5A preserved | PASS | Tablas presentes; sin datos modificados |
| new tables empty | PASS | Siete tablas nuevas en cero |
| Mobile untouched | PASS | Sin cambios causados por esta fase; cambios previos separados |
| no 5C | PASS | Sin modelos/tablas 5C en schema ni DB |
| CI remoto oficial | PENDING | Workflow está configurado correctamente, pero no hay run para esta rama |

**Estado: REVIEW PASS LOCAL / CIERRE CONDICIONAL — NO CERTIFICAR RELEASE TODAVÍA.**
