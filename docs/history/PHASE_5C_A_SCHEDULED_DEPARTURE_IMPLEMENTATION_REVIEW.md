# UPS GO — Phase 5C-A ScheduledDeparture Implementation Review

## 1. Verdict

Resultado de la auditoría independiente:

- El schema y la migración coinciden con el readiness aprobado.
- La migración es aditiva y funciona sobre PostgreSQL limpio.
- Las invariantes críticas tienen evidencia real en PostgreSQL.
- Legacy, Mobile, OpenAPI y CI existente no fueron alterados.
- El test nuevo de ScheduledDeparture pasa localmente con PostgreSQL real.
- Falta un gate remoto dedicado para ejecutar ese test nuevo en GitHub Actions.

Conclusión: el BUILD local es correcto, pero la certificación remota completa queda condicionada al CI fix.

    ScheduledDeparture schema: PASS
    Migration: PASS
    Clean PostgreSQL: PASS
    Local ScheduledDeparture Integration: PASS
    Remote ScheduledDeparture Integration Gate: MISSING
    Legacy: PASS
    Dead-code/residue: PASS

    COMMIT: NO
    PUSH: NO
    PR: NO
    MERGE: NO
    GO 5C-A GIT CLOSURE: NO
    GO CI FIX: YES
    GO 5C-A CLOSURE: CONDITIONAL
    GO 5C-B: NO

## 2. Scope

Worktree revisado:

    /home/cmoran/ups-expresos-phase-5c-a

Rama:

    feature/phase-5c-a-scheduled-departure

Baseline y origin/main verificados:

    4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc

Archivos esperados presentes:

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260829035744_add_scheduled_departure/migration.sql
- apps/api/src/modules/calendar/scheduled-departure.integration.spec.ts
- docs/PHASE_5C_A_SCHEDULED_DEPARTURE_IMPLEMENTATION_READINESS.md
- docs/PHASE_5C_A_SCHEDULED_DEPARTURE_IMPLEMENTATION_REPORT.md
- docs/PHASE_5C_A_SCHEDULED_DEPARTURE_IMPLEMENTATION_REVIEW.md

No hay archivos inesperados de Mobile, controllers, DTOs públicos, materializer,
ServiceAssignment o ServiceRun.

El worktree original conserva sus cambios históricos y no fue modificado por esta
revisión.

## 3. Git Diff

    HEAD:       4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc
    origin/main:4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc
    branch:     feature/phase-5c-a-scheduled-departure

El diff semántico tracked está limitado a schema.prisma. Los archivos nuevos son
exactamente la migración, el test, el readiness, el reporte de BUILD y este
reporte de revisión.

git diff --check y los checks de whitespace de archivos nuevos: PASS.

No hay diff en apps/mobile ni en .github/workflows.

## 4. ScheduledDepartureSource

El único enum nuevo es:

    enum ScheduledDepartureSource {
      REGULAR
      EXCEPTION_REPLACE
      EXCEPTION_ADD
    }

No existe ScheduledDepartureStatus, ScheduledDepartureTemplate ni
ScheduledDepartureJourney como implementación.

## 5. ScheduledDeparture Model

El modelo contiene exactamente:

- id UUID primary key;
- sourceScheduleTimeId UUID obligatorio;
- serviceCalendarId UUID obligatorio;
- serviceLineId UUID obligatorio;
- serviceDate DATE obligatorio;
- scheduledTime TIME(0) obligatorio;
- direction Direction obligatorio;
- source ScheduledDepartureSource obligatorio;
- sourceExceptionId UUID nullable;
- createdAt TIMESTAMPTZ(3).

No tiene updatedAt, status operacional, vehicle, driver, mutable route,
ServiceAssignment, ServiceRun ni relación directa con RoutePath o JourneyTemplate.

## 6. Natural Identity

Prisma y SQL implementan:

    UNIQUE(sourceScheduleTimeId, serviceDate)

El test intenta una segunda inserción con la misma fuente y fecha y obtiene
Prisma P2002. PASS.

## 7. Snapshot Semantics

scheduledTime es una columna persistida TIME(0), no un valor derivado en lectura.

El test crea el snapshot en 06:40, cambia el ScheduleTime origen a 07:00 y
comprueba que ScheduledDeparture conserva 06:40. PASS.

direction, serviceDate, source, serviceCalendarId y serviceLineId también son
campos persistidos del snapshot.

## 8. Relations

Las relaciones añadidas son únicamente las inversas necesarias en:

- ServiceLine;
- ServiceCalendar;
- ScheduleTime;
- ServiceException.

ScheduledDeparture tiene FKs obligatorias hacia ServiceLine, ServiceCalendar y
ScheduleTime, y una FK nullable hacia ServiceException.

No tiene schedulePatternId ni sourceSchedulePatternId.

## 9. Delete Policies

La migración SQL confirma las cuatro relaciones con ON DELETE RESTRICT:

- sourceScheduleTimeId;
- serviceCalendarId;
- serviceLineId;
- sourceExceptionId.

La integración PostgreSQL prueba que eliminar el ScheduleTime utilizado falla con
P2003. PASS.

## 10. Indexes

Están presentes exactamente los índices aprobados:

- UNIQUE(sourceScheduleTimeId, serviceDate);
- INDEX(serviceLineId, serviceDate, direction, scheduledTime);
- INDEX(serviceCalendarId, serviceDate);
- INDEX(sourceExceptionId).

La primary key genera adicionalmente su índice único normal. No se identificaron
índices especulativos ni una redundancia que requiera corrección.

## 11. Migration Audit

La migración 20260829035744_add_scheduled_departure contiene únicamente:

- CREATE TYPE para ScheduledDepartureSource;
- CREATE TABLE scheduled_departures;
- un índice único;
- tres índices normales;
- cuatro ALTER TABLE ADD CONSTRAINT para FKs.

No contiene DROP TABLE, DROP COLUMN, DELETE, UPDATE de datos, INSERT de datos,
TRUNCATE, triggers, funciones, partial indexes, exclusion constraints ni CHECK
manuales.

No modifica tablas legacy ni migraciones anteriores.

MANUAL_SQL_REQUIRED: NO.

## 12. Clean Database Reproduction

Se levantó PostgreSQL 17 efímero con nombre explícito y se aplicaron desde cero las
cinco migraciones:

1. init;
2. route operations;
3. transport domain foundation;
4. calendar timetable foundation;
5. scheduled departure.

Resultado:

    All migrations have been successfully applied.
    Database schema is up to date!
    scheduled_departures = 0 rows
    temporary container cleanup: PASS

No se utilizó producción, seed ni backfill.

## 13. Constraint Tests

El test usa PostgreSQL real y PrismaClient real; no usa mocks de Prisma.

La fixture usa UUIDs propios y datos sintéticos. El cleanup está limitado a esos
IDs y no utiliza deleteMany global.

Cobertura verificada:

- FK source ScheduleTime;
- FK calendar;
- FK service line;
- FK exception nullable y válida;
- duplicate source/date;
- nominal collision;
- snapshot de scheduledTime;
- RESTRICT al borrar la fuente.

No imprime secretos ni toca catálogo UPS.

## 14. Nominal Collision

Dos ScheduleTime reales distintos, ambos con 06:40 y la misma serviceDate,
generan dos ScheduledDeparture válidas.

Resultado: PASS.

La identidad no fue reducida a línea, dirección, hora y fecha.

## 15. PostgreSQL Integration

Comando ejecutado:

    NODE_ENV=test RUN_CALENDAR_INTEGRATION=true
    pnpm exec jest --runInBand --runTestsByPath
    src/modules/calendar/scheduled-departure.integration.spec.ts

Resultado:

    1 suite passed
    1 test passed

La regresión del resolver calendario también pasó:

    1 suite passed
    1 test passed

## 16. CI Integration Gate

Resultado obligatorio:

    REMOTE SCHEDULED DEPARTURE INTEGRATION GATE: MISSING

Evidencia:

- .github/workflows/ci.yml contiene el step Calendar PostgreSQL integration,
  pero no contiene un step para scheduled-departure.integration.spec.ts.
- apps/api/package.json contiene test:calendar:integration, pero no contiene
  test:scheduled-departure:integration.
- En el estado previo al CI fix, el test nuevo estaba protegido por
  RUN_CALENDAR_INTEGRATION=true, por lo que el Jest global lo omitía si no se
  invocaba con ese flag.

El workflow remoto actual puede ejecutar el gate de Calendar, pero no certifica
esta nueva integración de ScheduledDeparture.

Clasificación: HIGH para Git Closure y certificación remota. No invalida el schema
ni el BUILD local.

No se aplicó el CI fix porque esta revisión no autoriza modificar el workflow ni
cerrar Git.

## 17. Prisma

    prisma format: PASS
    prisma validate: PASS
    prisma generate: PASS
    prisma migrate status: PASS
    migrations: 5
    database: up to date
    db push used: NO

La revisión detectó que Prisma format reintroducía alineaciones históricas no
relacionadas. Se restauró únicamente ese churn de formato, conservando los
cambios semánticos aprobados. El schema final vuelve a tener diff semántico
acotado a 5C-A.

No hay evidencia de drift entre schema, historial y base local.

## 18. Regression Tests

    lint: PASS
    typecheck: PASS
    build: PASS
    Jest: PASS
    Jest suites: 16 passed, 2 skipped opt-in
    Jest tests: 160 passed, 2 skipped
    OpenAPI contract: PASS

Los dos skips globales corresponden a las dos integraciones opt-in:

- calendar-resolver.integration.spec.ts;
- scheduled-departure.integration.spec.ts.

Ambas fueron ejecutadas explícitamente y pasaron.

## 19. Calendar Integration

El test existente de Calendar/PostgreSQL pasó 1/1. No se modificó su runtime ni
su contrato.

Resultado:

    Calendar regression integration: PASS

## 20. Legacy Compatibility

Se mantuvieron sin cambios:

- Schedule;
- RouteAssignment;
- Trip;
- currentOperation;
- consumidores legacy;
- endpoints y DTOs existentes.

Clasificación vigente:

- ACTIVE: consumidores y contratos aún utilizados;
- COMPATIBILITY: piezas que serán sustituidas en fases posteriores;
- DEAD: ninguno creado ni eliminado en 5C-A.

No se eliminó ningún contrato todavía consumido.

## 21. Dead-Code / Residue Audit

Búsquedas sobre runtime y Prisma:

- ScheduledDepartureTemplate: absent como implementación;
- ScheduledDepartureStatus: absent;
- materializer nuevo: absent;
- ServiceAssignment: absent;
- ServiceRun: absent;
- backfill/seed de scheduled_departures: absent;
- imports productivos nuevos: none;
- scripts temporales: none;
- migraciones experimentales: none;
- código comentado nuevo: none;
- fixtures persistentes: none.

Resultado:

    5C-A DEAD CODE: NONE

Las menciones conceptuales en documentación no se clasifican como runtime.

## 22. OpenAPI

    new controller: NO
    new route: NO
    new DTO: NO
    OpenAPI contract checks: PASS

No existe diff de API producido por esta fase.

## 23. Mobile

    apps/mobile/**: UNCHANGED

No se modificó Mobile.

## 24. Findings

### F-5CA-001 — HIGH — Gate remoto de ScheduledDeparture ausente

Archivo/línea:

- .github/workflows/ci.yml:83-86 contiene únicamente Calendar integration.
- apps/api/package.json:14 contiene únicamente test:calendar:integration.

Evidencia histórica del estado previo al fix:

El test nuevo requería RUN_CALENDAR_INTEGRATION=true y no tenía script ni step
dedicado en CI.

Impacto técnico:

GitHub Actions puede dejar ScheduledDeparture integration en SKIPPED y certificar
el API Quality Gate sin ejecutar las invariantes PostgreSQL nuevas.

Impacto de negocio:

La garantía de idempotencia, colisiones nominales, snapshot y trazabilidad de
ScheduledDeparture no queda protegida remotamente contra regresiones.

Fix recomendado:

Agregar un script dedicado y un step CI usando el PostgreSQL existente, por
ejemplo test:scheduled-departure:integration. No crear un segundo servicio
PostgreSQL.

Bloquea commit: YES.
Bloquea PR: YES.
Bloquea merge: YES.
Bloquea 5C-B: YES.

### F-5CA-002 — INFO — Integración nueva opt-in en Jest global

Archivo/línea:

- scheduled-departure.integration.spec.ts:4-5.

Evidencia histórica del estado previo al fix:

La suite se omitía sin RUN_CALENDAR_INTEGRATION=true.

Evaluación:

Fue una deuda semántica del estado previo. Queda resuelta localmente con
RUN_SCHEDULED_DEPARTURE_INTEGRATION=true; la integración Calendar conserva su
flag original.

Bloquea commit: NO por sí solo.
Bloquea PR: NO por sí solo.
Bloquea merge: NO por sí solo.
Bloquea 5C-B: YES mientras F-5CA-001 permanezca sin resolver.

## 25. Fixes Applied

- Se retiró el churn de formato ajeno a 5C-A que reapareció al ejecutar Prisma
  format.
- No se modificó el schema semántico aprobado.
- No se modificaron migraciones ni runtime.
- No se hizo commit, push, PR ni merge.

## 26. Remaining Risks
- El gate remoto de ScheduledDeparture debe añadirse y revalidarse.
- El materializer futuro deberá validar coherencia entre source, calendar, line,
  direction y exception.
- La cancelación, NO_SERVICE, materialization window y reconciliación pertenecen
  a fases posteriores.
- ServiceAssignment, ServiceRun, APIs, Mobile, GPS y backfill siguen fuera de
  alcance.

## CI Remediation Update

El finding histórico F-5CA-001 — gate remoto de ScheduledDeparture ausente —
fue corregido localmente sin cambiar el schema, la migración ni el runtime.

Cambios aplicados:

- script `test:scheduled-departure:integration` en apps/api/package.json;
- step `ScheduledDeparture PostgreSQL integration` en .github/workflows/ci.yml;
- flag dedicado: `RUN_SCHEDULED_DEPARTURE_INTEGRATION=true`;
- ejecución después de migrate deploy y migrate status;
- hard-fail conservado: no hay `continue-on-error` ni `|| true`;
- PostgreSQL, DATABASE_URL y credenciales del job existente reutilizados;
- Calendar integration y Jest global preservados;
- Node 20 y pnpm 10.34.5 preservados.

Estado del finding:

    F5CA-001 original: HIGH
    Status after remediation: FIXED LOCALLY / REMOTE PENDING

La certificación remota queda pendiente de push y ejecución real de GitHub
Actions. No se autoriza todavía Git Closure ni 5C-B.

## 27. Decision

Estado posterior al CI remediation local:

    LOCAL BUILD: PASS
    LOCAL POSTGRES INTEGRATION: PASS
    REMOTE SCHEDULED DEPARTURE INTEGRATION GATE: PRESENT LOCALLY / REMOTE PENDING

    COMMIT: NO
    PUSH: NO
    PR: NO
    MERGE: NO

    GO CI FIX: YES
    GO CI FIX RE-REVIEW: YES
    GO 5C-A GIT CLOSURE: NO
    GO 5C-A CLOSURE: CONDITIONAL — REMOTE CI PENDING
    GO 5C-B: NO

La implementación física de ScheduledDeparture está aprobada técnicamente a
nivel local y el gate dedicado quedó corregido localmente. No está autorizada
todavía la clausura Git ni la siguiente fase. Primero debe ejecutarse el workflow
en GitHub Actions después del push y confirmarse el resultado remoto.
