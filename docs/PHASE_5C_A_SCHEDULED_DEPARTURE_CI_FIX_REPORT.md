# UPS GO — Phase 5C-A ScheduledDeparture CI Fix

## 1. Verdict

El CI fix está completo y validado localmente.

    CI FIX: PASS
    ScheduledDeparture package script: PASS
    ScheduledDeparture CI step: PASS
    Correct integration flag: PASS
    Hard fail: PASS
    PostgreSQL reused: YES
    Calendar gate preserved: YES
    Global Jest preserved: YES
    Node: 20
    pnpm: 10.34.5

La certificación remota queda pendiente de push y ejecución real de GitHub
Actions.

    GO CI FIX RE-REVIEW: YES
    GO GIT CLOSURE: NO
    GO 5C-B: NO

## 2. Original Finding

Finding F5CA-001 del review independiente:

    HIGH — Remote ScheduledDeparture Integration Gate: MISSING

El workflow ejecutaba la integración Calendar, pero no ejecutaba la nueva suite
scheduled-departure.integration.spec.ts. Esto permitía que el Jest global la
dejara skipped.

## 3. Package Script

Se agregó exactamente un script en apps/api/package.json:

    test:scheduled-departure:integration

El comando ejecuta:

    jest --runInBand --runTestsByPath src/modules/calendar/scheduled-departure.integration.spec.ts

No se agregaron dependencias ni se modificó el lockfile.

## 4. CI Workflow Change

Se agregó exactamente un step al API Quality Gate existente:

      - name: ScheduledDeparture PostgreSQL integration
        env:
          RUN_SCHEDULED_DEPARTURE_INTEGRATION: "true"
        run: pnpm test:scheduled-departure:integration

El step usa el working-directory apps/api heredado del job.

## 5. PostgreSQL Reuse

El step reutiliza:

- el mismo job API;
- el mismo PostgreSQL 17-alpine;
- el mismo DATABASE_URL;
- las mismas credenciales efímeras;
- las cinco migraciones ya aplicadas.

No se creó otro servicio PostgreSQL, otro job ni otra base.

## 6. Hard-Fail Semantics

El step es obligatorio.

No contiene:

- continue-on-error;
- || true;
- wrappers que oculten el exit code.

Si la integración falla, el API Quality Gate falla.

## 7. Global Jest Preservation

Se conserva sin cambios:

    pnpm exec jest --runInBand

El resultado local continúa siendo:

    16 suites passed
    2 suites skipped opt-in
    160 tests passed
    2 tests skipped

Los dos skips corresponden únicamente a Calendar y ScheduledDeparture, ambas
ejecutadas en sus gates dedicados.

## 8. Calendar Gate Preservation

El step existente permanece sin cambios:

    Calendar PostgreSQL integration
    RUN_CALENDAR_INTEGRATION=true
    pnpm test:calendar:integration

Se ejecutó y pasó.

## 9. ScheduledDeparture Gate

La suite usa un flag dedicado, separado del gate de Calendar:

    RUN_SCHEDULED_DEPARTURE_INTEGRATION=true

El test semántico no fue debilitado ni se eliminaron assertions.

La ejecución ocurre después de:

1. Prisma generate;
2. migrate deploy;
3. migrate status;
4. Calendar PostgreSQL integration.

## 10. Local Validation

Script nuevo:

    NODE_ENV=test RUN_SCHEDULED_DEPARTURE_INTEGRATION=true
    pnpm test:scheduled-departure:integration

Resultado:

    1 suite passed
    1 test passed

También se verificó independencia de orden:

    Calendar → ScheduledDeparture: PASS
    ScheduledDeparture → Calendar: PASS

Calendar integration:

    1 suite passed
    1 test passed

## 11. Prisma/Migration Integrity

    prisma validate: PASS
    prisma migrate status: PASS
    migrations: 5
    database: up to date

El CI fix no modificó:

- apps/api/prisma/schema.prisma;
- la migración ScheduledDeparture;
- migraciones históricas;
- datos;
- seed;
- backfill.

El diff de schema y migración continúa siendo el de 5C-A.

## 12. Runtime Integrity

No se modificó runtime NestJS, CalendarResolver, repositories,
controllers, DTOs ni servicios de producción.

La búsqueda de materializer, ServiceAssignment y ServiceRun no muestra
implementación nueva.

## 13. Legacy

No se eliminaron ni modificaron:

- Schedule;
- RouteAssignment;
- Trip;
- currentOperation;
- consumidores legacy.

## 14. OpenAPI

    pnpm test:openapi: PASS
    new controller: NO
    new route: NO
    new DTO: NO

No hay cambio de contrato API.

## 15. Mobile

apps/mobile permanece sin cambios.

## 16. Remaining Risk

El gate está corregido en la rama local, pero todavía no existe evidencia de una
ejecución remota porque no se ha hecho push y el usuario no autorizó Git Closure.

La única validación pendiente es GitHub Actions real sobre el PR futuro.

## 17. Next Step

Solicitar CI Fix Re-Review.

Después de push y PR, confirmar en GitHub Actions que API Quality Gate ejecute:

- Calendar PostgreSQL integration;
- ScheduledDeparture PostgreSQL integration;
- lint;
- typecheck;
- build;
- Jest global;
- OpenAPI.

No hacer commit, push, PR, merge ni iniciar 5C-B en este turno.
