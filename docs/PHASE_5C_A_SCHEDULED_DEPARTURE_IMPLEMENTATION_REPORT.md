# UPS GO — Phase 5C-A ScheduledDeparture Implementation

**Estado:** BUILD COMPLETED / READY FOR INDEPENDENT REVIEW

**Baseline:** \`4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc\`

**Branch:** \`feature/phase-5c-a-scheduled-departure\`

## 1. Verdict

Se implementó únicamente la primera entidad operacional:

\`\`\`text
ScheduleTime + serviceDate → ScheduledDeparture
\`\`\`

La tabla permanece vacía. No se implementaron materializer, assignment, run,
API, Mobile, seed ni backfill.

\`\`\`text
ScheduledDepartureTemplate: ABSENT
ScheduledDepartureStatus:   ABSENT
Direct journey relation:    ABSENT
GO independent review:      YES
GO commit/push/PR:          NO — reservado para review posterior
\`\`\`

## 2. Scope

Cambios de esta rama:

- enum \`ScheduledDepartureSource\`;
- modelo \`ScheduledDeparture\`;
- relaciones inversas mínimas en \`ServiceLine\`, \`ServiceCalendar\`,
  \`ScheduleTime\` y \`ServiceException\`;
- unique source/date, índices y FKs \`RESTRICT\`;
- migración aditiva \`20260829035744_add_scheduled_departure\`;
- integración PostgreSQL sintética de constraints/snapshots;
- copia idéntica del readiness aprobado;
- este reporte.

No se tocaron \`Schedule\`, \`RouteAssignment\`, \`Trip\`, \`currentOperation\`,
Mobile, OpenAPI, CI, seed, datos oficiales, catálogo ni migraciones previas.

## 3. ScheduledDeparture Model

La entidad es una oferta programada para una fecha civil. No representa bus,
conductor, path elegido, viaje iniciado, GPS, ETA o \`ServiceRun\`.

\`\`\`text
sourceScheduleTimeId + serviceDate → una fila
\`\`\`

## 4. ScheduledDepartureSource

Valores cerrados:

\`\`\`text
REGULAR
EXCEPTION_REPLACE
EXCEPTION_ADD
\`\`\`

No se usan strings libres ni se agregó un enum de status.

## 5. Relaciones

La entidad mantiene FKs hacia:

\`\`\`text
ScheduleTime       required, RESTRICT
ServiceCalendar    required, RESTRICT
ServiceLine        required, RESTRICT
ServiceException   nullable, RESTRICT
\`\`\`

No tiene relación con \`ScheduleJourneyTemplate\`, \`RoutePath\`, \`Vehicle\`,
\`Driver\`, \`RouteAssignment\` ni \`Trip\`.

## 6. Natural Identity

Implementada físicamente:

\`\`\`text
UNIQUE(sourceScheduleTimeId, serviceDate)
\`\`\`

Dos \`ScheduleTime\` distintos con \`16:50\` en la misma fecha pueden coexistir.
La misma fuente y fecha no puede duplicarse.

## 7. Snapshots

Se persisten:

\`\`\`text
serviceCalendarId
serviceLineId
direction
serviceDate
scheduledTime
source
sourceExceptionId
\`\`\`

\`scheduledTime\` es \`TIME(0)\` y \`serviceDate\` es \`DATE\`. Sólo se conserva
\`createdAt\`; el snapshot no es un CRUD mutable y no tiene \`updatedAt\`.

## 8. Constraints

La migración contiene:

- PK UUID;
- unique source/date;
- cuatro FKs \`ON DELETE RESTRICT\`;
- columnas snapshot no nulas;
- sin cascadas destructivas;
- sin CHECK, trigger, función, partial index o exclusion constraint.

Las relaciones cruzadas source/calendar/line/direction quedan explícitamente
como invariantes de aplicación para el materializer futuro.

## 9. Indexes

Se implementaron exactamente los aprobados:

\`\`\`text
UNIQUE(sourceScheduleTimeId, serviceDate)
INDEX(serviceLineId, serviceDate, direction, scheduledTime)
INDEX(serviceCalendarId, serviceDate)
INDEX(sourceExceptionId)
\`\`\`

No se agregaron índices individuales especulativos.

## 10. Delete Policy

Todas las FKs nuevas usan \`ON DELETE RESTRICT\`. Una fuente, calendario, línea o
excepción utilizada no puede eliminar silenciosamente la trazabilidad de una
departure.

## 11. Migration

\`\`\`text
20260829035744_add_scheduled_departure
\`\`\`

Se generó con:

\`\`\`bash
npx --yes pnpm@10.34.5 prisma migrate dev --create-only --name add_scheduled_departure
\`\`\`

Se aplicó localmente con:

\`\`\`bash
npx --yes pnpm@10.34.5 prisma migrate deploy
\`\`\`

Resultado: cinco migraciones aplicadas y base actualizada.

## 12. Migration SQL Audit

El SQL fue inspeccionado antes de aplicarse. Sólo contiene:

\`\`\`text
CREATE TYPE ScheduledDepartureSource
CREATE TABLE scheduled_departures
CREATE UNIQUE INDEX source/date
CREATE INDEX × 3
ALTER TABLE ADD CONSTRAINT FOREIGN KEY × 4
\`\`\`

No contiene \`DROP\`, \`UPDATE\`, \`DELETE\`, \`INSERT\`, \`TRUNCATE\`, \`CASCADE\`,
alteraciones legacy ni datos de negocio.

\`\`\`text
MANUAL_SQL_REQUIRED = NO
\`\`\`

## 13. Clean Database Reproduction

Se levantó una PostgreSQL 17 efímera local en el puerto \`55432\`, con nombre
explícito \`ups-go-5ca-clean\`.

Las cinco migraciones se aplicaron desde cero:

\`\`\`text
init
route operations
transport domain foundation
calendar timetable foundation
scheduled departure
\`\`\`

Resultado:

\`\`\`text
Database schema is up to date!
scheduled_departures table exists
scheduled_departures rows = 0
container cleanup = removed
\`\`\`

No se tocó producción.

## 14. Constraint Tests

\`scheduled-departure.integration.spec.ts\` usa UUIDs sintéticos, PostgreSQL
real, transacción de setup y cleanup explícito.

Verificado:

- primera inserción source/date: PASS;
- duplicado source/date: \`P2002\`, PASS;
- FK \`ScheduleTime\` con \`RESTRICT\`: \`P2003\`, PASS;
- FK \`ServiceException\` nullable/válida: PASS;
- limpieza sin datos residuales: PASS.

## 15. Nominal Collision Test

Dos \`ScheduleTime\` distintos con \`06:40\` y la misma fecha fueron insertados en
dos departures distintas. Ambas fueron aceptadas.

\`\`\`text
ScheduleTime A + 2026-09-01 → PASS
ScheduleTime B + 2026-09-01 → PASS
\`\`\`

## 16. Snapshot Test

La departure se creó con \`scheduledTime = 06:40\`. Después se cambió el
\`ScheduleTime\` sintético a \`07:00\`; la departure continuó almacenando \`06:40\`.

## 17. Legacy Compatibility

\`\`\`text
Schedule:          UNCHANGED
RouteAssignment:   UNCHANGED
Trip:              UNCHANGED
currentOperation:  UNCHANGED
\`\`\`

Consumers legacy permanecen activos en Admin, Driver, Mobile, feedback, seed y
tests. No se eliminó ningún consumer, contrato o endpoint.

## 18. Dead-Code / Residue Audit

\`\`\`text
ScheduledDepartureTemplate: absent
ServiceAssignment:          absent
ServiceRun:                 absent
ScheduledDepartureStatus:   absent
temporary SQL files:        0
experimental migrations:    0
legacy consumers removed:   0
dead code removed:          0
historical migrations deleted: 0
\`\`\`

No se crearon imports, scripts productivos, flags productivos, adapters ni
código comentado. El flag \`RUN_CALENDAR_INTEGRATION\` pertenece al gate de
CalendarResolver; el flag específico de ScheduledDeparture se separó durante
la remediación posterior del CI.

## 19. Prisma Validation

Ejecutado con Node del entorno y pnpm \`10.34.5\`:

\`\`\`text
prisma format:          PASS
prisma validate:        PASS
prisma generate:        PASS
prisma migrate status:  PASS — 5 migrations, database up to date
\`\`\`

## 20. Regression Tests

\`\`\`text
lint:       PASS
typecheck:  PASS
build:      PASS
Jest:       16 suites passed, 160 tests passed, 2 integration suites skipped
\`\`\`

Las integraciones se ejecutaron separadamente con \`NODE_ENV=test\` y sus flags
dedicados:

\`\`\`text
Calendar resolver PostgreSQL integration:       1 suite / 1 test PASS
ScheduledDeparture constraints integration:     1 suite / 1 test PASS
\`\`\`

## 21. OpenAPI

\`\`\`text
openapi contract checks passed
\`\`\`

No se agregaron endpoints, DTOs, controllers ni cambios Swagger.

## 22. Mobile

\`\`\`text
UNCHANGED
\`\`\`

No se modificó \`apps/mobile/**\` en esta rama.

## 23. Remaining Risks

Quedan deliberadamente para fases posteriores:

- materialization window y reconciliación;
- cancelación y \`NO_SERVICE\` persistido;
- validación cruzada source/calendar/line/direction en materializer;
- selección de \`ScheduleJourneyTemplate\` por \`ServiceAssignment\`;
- versionado/inmutabilidad de templates publicados;
- catálogo oficial, perfiles y backfill de los 90 \`Schedule\`;
- API pública, Admin, Driver, Mobile switch, GPS y realtime.

## 24. Next Step

Solicitar \`FASE 5C-A INDEPENDENT IMPLEMENTATION REVIEW\`.

No hacer commit, push, PR, merge ni iniciar 5C-B antes de esa revisión.

## 25. Final Build Gate

\`\`\`text
ScheduledDeparture model                 PASS
ScheduledDepartureTemplate absent        PASS
ScheduledDepartureStatus absent          PASS
Direct journey relation absent           PASS
Natural unique source/date               PASS
Nominal collision allowed                PASS
ServiceLine FK                           PASS
Calendar FK                              PASS
ScheduleTime FK                          PASS
Exception nullable FK                    PASS
All delete policies RESTRICT             PASS
Indexes exact                            PASS
Snapshot scheduledTime                   PASS
Append-only model                        PASS
Migration additive                       PASS
No legacy mutation                       PASS
No data migration                        PASS
No backfill                              PASS
No db push                               PASS
Clean DB migration                       PASS
New table empty                          PASS
Prisma format                            PASS
Prisma validate                          PASS
Prisma generate                          PASS
Prisma migrate status                    PASS
lint                                     PASS
typecheck                                PASS
build                                     PASS
Jest                                     PASS
Calendar PostgreSQL integration          PASS
OpenAPI                                  PASS
Mobile unchanged                         PASS
Legacy behavior unchanged                PASS
Dead-code / residue audit                PASS
\`\`\`

\`\`\`text
GO 5C-A INDEPENDENT REVIEW: YES
GO COMMIT:                  NO
GO PUSH:                    NO
GO PR:                      NO
GO 5C-B MATERIALIZER:       NO
GO SERVICE ASSIGNMENT:     NO
GO SERVICE RUN:            NO
\`\`\`
