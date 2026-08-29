# UPS GO — Phase 5C-A ScheduledDeparture CI Fix Review

## 1. Verdict

La re-review independiente confirma que el CI fix queda correctamente resuelto en
la rama local.

    F5CA-001: CLOSED LOCALLY
    CI CONFIGURATION: PASS
    REMOTE CI EXECUTION: PENDING
    Integration flag: PASS
    Flag semantics: PASS
    Dead-code/residue: PASS

La separación del flag fue necesaria: RUN_CALENDAR_INTEGRATION nació para
CalendarResolver en 5B-B y se estaba reutilizando accidentalmente. Ahora
ScheduledDeparture usa RUN_SCHEDULED_DEPARTURE_INTEGRATION.

    COMMIT: NO
    PUSH: NO
    PR: NO
    MERGE: NO
    GO 5C-A GIT CLOSURE: YES
    GO REMOTE CI: YES
    GO 5C-A CLOSURE: CONDITIONAL — REMOTE CI PENDING
    GO 5C-B: NO

GO Git Closure significa que la siguiente operación queda autorizada; no fue
ejecutada en esta re-review.

## 2. Scope

Worktree:

    /home/cmoran/ups-expresos-phase-5c-a

Branch:

    feature/phase-5c-a-scheduled-departure

Baseline:

    4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc

El CI fix contiene exactamente:

- un script en apps/api/package.json;
- un step en .github/workflows/ci.yml;
- la separación inequívoca del flag en el test y el step;
- actualización de los reportes correspondientes.

No se agregaron jobs, servicios PostgreSQL, dependencias ni scripts auxiliares.

## 3. Original Finding

F5CA-001 era:

    HIGH — Remote ScheduledDeparture Integration Gate: MISSING

El workflow tenía el gate de Calendar, pero no ejecutaba la nueva integración de
ScheduledDeparture.

La configuración local ahora contiene el script y el step dedicados. El finding
queda CLOSED LOCALLY; la ejecución remota sigue PENDING hasta push y GitHub
Actions real.

## 4. Package Script

Existe exactamente un script:

    test:scheduled-departure:integration

Ejecuta únicamente:

    jest --runInBand --runTestsByPath src/modules/calendar/scheduled-departure.integration.spec.ts

No ejecuta Jest completo accidentalmente y no modificó el lockfile.

## 5. Integration Flag

CalendarResolver conserva:

    RUN_CALENDAR_INTEGRATION=true

ScheduledDeparture usa:

    RUN_SCHEDULED_DEPARTURE_INTEGRATION=true

Evidencia de origen:

- git history sólo muestra RUN_CALENDAR_INTEGRATION asociado al CalendarResolver
  y su gate 5B-B;
- no existe documentación previa que lo defina como flag común;
- el nombre anterior en ScheduledDeparture era reutilización accidental.

Resultado:

    Flag semantics: PASS
    Technical debt from shared flag: CLOSED LOCALLY

No se creó RUN_ALL_INTEGRATIONS ni otra abstracción global.

## 6. ScheduledDeparture CI Gate

El workflow contiene un step dedicado:

    - name: ScheduledDeparture PostgreSQL integration
      env:
        RUN_SCHEDULED_DEPARTURE_INTEGRATION: "true"
      run: pnpm test:scheduled-departure:integration

El step usa el working-directory apps/api heredado del job y no tiene wrappers que
oculten errores.

## 7. Calendar CI Gate

El gate existente permanece sin cambios:

    - name: Calendar PostgreSQL integration
      env:
        RUN_CALENDAR_INTEGRATION: "true"
      run: pnpm test:calendar:integration

## 8. PostgreSQL Reuse

El workflow mantiene un único servicio PostgreSQL 17-alpine.

El nuevo step reutiliza:

- el mismo job API;
- el mismo DATABASE_URL;
- las mismas credenciales efímeras;
- la misma base migrada;
- el mismo servicio PostgreSQL.

No se creó un segundo contenedor ni otro job.

## 9. Execution Order

El step ScheduledDeparture aparece después de:

1. install;
2. Prisma generate;
3. migrate deploy;
4. migrate status;
5. Calendar PostgreSQL integration.

Por tanto, corre contra el schema completo de las cinco migraciones.

## 10. Hard-Fail Semantics

Validado:

- no hay continue-on-error;
- no hay continue-on-error;
- no hay || true;
- no hay wrapper que oculte el exit code.

Una falla de ScheduledDeparture hace fallar el API Quality Gate.

## 11. Global Jest

Se conserva:

    pnpm exec jest --runInBand

Resultado local:

    16 suites passed
    2 suites skipped opt-in
    160 tests passed
    2 tests skipped

Los dos skips son únicamente las dos integraciones PostgreSQL dedicadas.

## 12. Test Isolation

Orden Calendar → ScheduledDeparture:

    PASS

Orden ScheduledDeparture → Calendar:

    PASS

Ambos tests usan UUIDs propios y datos sintéticos. No hubo colisiones entre
fixtures.

## 13. Database Cleanup

La integración ScheduledDeparture:

- no usa deleteMany global;
- elimina sólo IDs sintéticos propios;
- limpia departures antes de sus fuentes;
- no toca catálogo oficial ni datos legacy.

Después de las ejecuciones:

    scheduled_departures rows = 0

## 14. Toolchain

Configuración CI verificada:

    Node: 20
    pnpm: 10.34.5
    PostgreSQL: 17-alpine

El entorno shell local utilizado para esta re-review reporta Node 24.19.0 y
pnpm 10.34.5. Esto no modifica la configuración CI, que continúa fijada
explícitamente en Node 20.

## 15. Schema/Migration Integrity

El CI fix no modificó semánticamente:

- apps/api/prisma/schema.prisma;
- 20260829035744_add_scheduled_departure/migration.sql;
- migraciones históricas.

El diff de schema continúa siendo exclusivamente el BUILD 5C-A previo.

    prisma validate: PASS
    prisma migrate status: PASS
    migrations: 5
    database: up to date

## 16. Runtime Integrity

No se modificaron CalendarResolver, repositories, servicios NestJS, controllers,
DTOs ni runtime de ScheduledDeparture.

Materializer, ServiceAssignment y ServiceRun continúan ausentes.

## 17. Legacy

El CI fix no toca ni elimina:

- Schedule;
- RouteAssignment;
- Trip;
- currentOperation;
- consumidores legacy.

## 18. Dead-Code / Residue Audit

Resultado:

    CI FIX RESIDUE: NONE

No hay:

- script duplicado;
- step duplicado;
- variable sin uso;
- workflow temporal;
- shell auxiliar;
- código comentado;
- dependencia nueva;
- lockfile innecesariamente modificado.

## 19. Validation

Ejecutado localmente:

    package JSON parse: PASS
    workflow YAML/format check: PASS
    prisma validate: PASS
    prisma migrate status: PASS
    lint: PASS
    typecheck: PASS
    build: PASS
    global Jest: PASS
    Calendar integration: PASS 1/1
    ScheduledDeparture integration: PASS 1/1
    OpenAPI: PASS

La integración ScheduledDeparture pasó con:

    NODE_ENV=test
    RUN_SCHEDULED_DEPARTURE_INTEGRATION=true

## 20. Findings

No quedan findings abiertos del CI fix.

    F5CA-001: CLOSED LOCALLY
    F5CA-002 shared-flag debt: CLOSED LOCALLY
    New findings: NONE

La única condición restante es externa a la validación local:

    REMOTE CI EXECUTION: PENDING

## 21. Fixes Applied

- Se agregó un único script dedicado.
- Se agregó un único step CI dedicado.
- Se separó el flag accidental de ScheduledDeparture.
- Se conservó intacto RUN_CALENDAR_INTEGRATION para CalendarResolver.
- Se actualizaron los reportes para reflejar el flag definitivo.
- No se modificó schema, migración, runtime, Mobile ni API.
- No se hizo commit, push, PR ni merge.

## 22. Remaining Risk

La configuración todavía no ha sido ejecutada por GitHub Actions porque no se ha
hecho push. Debe confirmarse remotamente que el API Quality Gate ejecuta ambas
integraciones y falla si ScheduledDeparture falla.

## 23. Decision

    F5CA-001: CLOSED
    CI CONFIGURATION: PASS
    REMOTE CI EXECUTION: PENDING
    Integration flag: RUN_SCHEDULED_DEPARTURE_INTEGRATION
    Flag semantics: PASS
    Dead-code/residue: PASS

    COMMIT: NO
    PUSH: NO
    PR: NO
    MERGE: NO

    GO 5C-A GIT CLOSURE: YES
    GO REMOTE CI: YES
    GO 5C-A CLOSURE: CONDITIONAL
    GO 5C-B: NO

Report generated after local re-review.
