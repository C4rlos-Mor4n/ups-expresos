# UPS GO — Phase 5C-B Materializer External Review

## 1. Verdict

**PASS técnico externo.** El BUILD satisface 5C-B y está listo para Git
Closure. La ejecución de CI remoto permanece pendiente porque aún no hay
commit, push ni pull request.

## 2. Scope

Se revisaron el materializer, repository, Calendar module, pruebas, script,
CI y documentación. No se implementó API, Mobile, backfill, cron, BullMQ,
Redis, ServiceAssignment ni ServiceRun.

## 3. Git Diff

```text
Branch:      feature/phase-5c-b-scheduled-departure-materializer
HEAD:        2119f5bcd967f7b6d432313d6e722a8e297e2097
origin/main: 2119f5bcd967f7b6d432313d6e722a8e297e2097
diff --check: PASS
```

El scope real se limita a Calendar, CI, package script y documentación 5C-B.

## 4. Architecture

El flujo es input → CalendarResolverService → ResolvedSchedule → snapshots →
ScheduledDepartureRepository. El service coordina y el repository persiste.
No hay controller ni activación automática.

## 5. Resolver Boundary

El materializer consume únicamente CalendarResolverService. No recalcula
calendario, patrones, excepciones o journeys y no toca Schedule legacy, Trip,
RouteAssignment ni currentOperation.

## 6. Input / Range

Valida UUID, dirección, fecha civil, orden y rango inclusivo máximo de 31 días.
El rango se procesa secuencialmente por fecha, sin mega-transacción.

## 7. Date Semantics

serviceDate es una fecha civil ISO y se convierte explícitamente a
YYYY-MM-DDT00:00:00.000Z para el DATE PostgreSQL. La iteración usa UTC, no
setters ni getters locales.

## 8. Mapping

Cada ResolvedDeparture produce una sola snapshot con identidad de fuente,
calendario, línea, fecha, hora, dirección y provenance. Los journeys no
participan en identidad ni multiplican filas.

## 9. Idempotency

La identidad natural es sourceScheduleTimeId + serviceDate. La repetición
1x/2x/10x deja estable el conteo físico y no actualiza snapshots.

## 10. createMany / skipDuplicates

createMany con skipDuplicates está respaldado por el único
@@unique([sourceScheduleTimeId, serviceDate]) aplicable a la proyección. No se
confía sólo en su contador: las dos lecturas batch reconstruyen filas same,
different y stale dentro de la transacción.

## 11. Concurrency

Cuatro materializaciones concurrentes reales en PostgreSQL produjeron una sola
fila por identidad, sin P2002, duplicación ni deadlock. Qué worker informa
created es observacional; el estado final es determinista.

## 12. Transaction Boundary

Resolver y mapping ocurren fuera. Por fecha disponible, createMany y ambas
lecturas batch ocurren dentro de una sola transacción PostgreSQL READ COMMITTED.
Un fallo revierte toda esa fecha, no todo el rango.

## 13. Post-Transaction Reads

No existen lecturas post-commit: ambas lecturas ocurren dentro de $transaction.
Los resultados son observacionales frente a commits concurrentes, pero no
producen decisiones destructivas; no se justifica SERIALIZABLE ni locks extra.

## 14. Existing Identical

Una fila igual devuelve existingSame, sin update ni error.

## 15. Existing Different

Compara calendario, línea, hora, dirección, source y sourceExceptionId,
incluido null frente a valor. Una diferencia devuelve RECONCILIATION_REQUIRED,
sin mutar.

## 16. NO_SERVICE

NO_SERVICE crea cero filas. Las snapshots históricas del scope se reportan como
missingFromCurrentResolution y no se eliminan.

## 17. Reconciliation

Sólo detecta y reporta filas iguales, diferentes y ausentes de la resolución
actual. No existe reparación física en 5C-B.

## 18. Errors

Errores de dominio del resolver devuelven RESOLUTION_FAILED sin writes de esa
fecha. Errores inesperados del resolver o Prisma se propagan como
MaterializerInfrastructureError, nunca como NO_SERVICE.

## 19. Repository / Query Audit

Por fecha disponible hay un bulk insert y dos findMany batch. No hay N+1 por
departure, raw SQL, upsert, update, delete ni deleteMany en código productivo;
las mutaciones existentes son fixture cleanup.

## 20. PostgreSQL Integration

En PostgreSQL 17 aislado con las cinco migraciones aplicadas, la suite pasó
10/10: ADD/REPLACE, colisión nominal, journeys, NO_SERVICE, historia,
idempotencia, concurrencia, snapshots, stale rows y rollback atómico.

## 21. Timezone Audit

Las suites focales 19/19 y la integración materializer 10/10 pasaron bajo:

```text
TZ=UTC
TZ=America/Guayaquil
TZ=Asia/Tokyo
```

Se preservaron serviceDate y scheduledTime. El gate CI fija ahora
TZ=America/Guayaquil.

## 22. Test Matrix

| Integración materializer   | Requisito                                 |
| -------------------------- | ----------------------------------------- |
| regular + ADD y journeys   | una fila por departure y colisión nominal |
| REPLACE                    | provenance exacta                         |
| NO_SERVICE                 | cero writes                               |
| NO_SERVICE histórico       | reconciliation sin delete                 |
| 1x/2x/10x                  | idempotencia física                       |
| Promise.all 4x             | concurrencia real                         |
| cambio de source time      | snapshot immutable                        |
| línea/dirección divergente | existing different                        |
| stale source               | missing from resolution                   |
| FK inválida                | rollback de fecha                         |

## 23. Global Jest Skips

Los 12 skips están contabilizados y tienen gate dedicado:

| Suite                                                | Tests skipped | Gate                                             |
| ---------------------------------------------------- | ------------: | ------------------------------------------------ |
| calendar-resolver.integration.spec.ts                |             1 | RUN_CALENDAR_INTEGRATION                         |
| scheduled-departure.integration.spec.ts              |             1 | RUN_SCHEDULED_DEPARTURE_INTEGRATION              |
| scheduled-departure-materializer.integration.spec.ts |            10 | RUN_SCHEDULED_DEPARTURE_MATERIALIZER_INTEGRATION |

El Jest global dio 179 passed y 12 skipped; las tres suites opt-in se ejecutaron
por separado en esta revisión.

## 24. CI Integration Gate

El único API Quality Gate usa PostgreSQL 17-alpine, Node 20 y pnpm 10.34.5.
Ejecuta Calendar, ScheduledDeparture y Materializer con flags separados, sin
continue-on-error, || true, segundo job ni segunda base.

```text
REMOTE MATERIALIZER CI GATE: PRESENT
REMOTE CI EXECUTION:          PENDING
```

## 25. Legacy

No hay referencias del materializer a legacy. Schedule, RouteAssignment, Trip y
currentOperation permanecen ACTIVE y sin cambios.

## 26. Prisma / Migrations

```text
schema.prisma: UNCHANGED
new migrations: 0
migration status: 5 applied / up to date
```

## 27. API / Mobile

No hay controller, DTO público, OpenAPI/Swagger, ruta ni respuesta modificada.
apps/mobile no tiene cambios.

## 28. Dead-Code / Residue

No se detectaron helpers duplicados, materializer alternativo, flags huérfanos,
TODO sin salida, debug logs o dependencias Redis/BullMQ/cron. El materializer
dejó de exportarse desde CalendarModule porque no tiene consumidor externo;
permanece como provider interno testeable.

## 29. Findings

| ID           | Severidad | Evidencia                           | Impacto                          | Bloquea Git Closure |
| ------------ | --------- | ----------------------------------- | -------------------------------- | ------------------- |
| F5CB-EXT-001 | LOW       | CI no fijaba TZ para el gate opt-in | Riesgo preventivo de regresión   | No, corregido       |
| F5CB-EXT-002 | LOW       | materializer exportado sin consumer | Superficie de módulo innecesaria | No, corregido       |

No hay findings abiertos CRITICAL, HIGH ni MEDIUM.

## 30. Fixes Applied

1. El step CI del materializer ahora usa TZ=America/Guayaquil.
2. CalendarModule preserva el export de CalendarResolverService, pero mantiene
   el materializer como provider privado hasta que exista consumidor autorizado.
3. Los reports previos se ajustaron sin borrar hallazgos históricos.

## 31. Remaining Risks

GitHub Actions aún no ejecuta esta rama; reconciliation aún no tiene workflow de
reparación y el materializer no se activa automáticamente. Una
ScheduledDeparture tampoco prueba que un bus esté en recorrido.

## 32. Decision

```text
EXTERNAL REVIEW:                 PASS
Materializer domain:             PASS
Idempotency:                     PASS
Concurrency:                     PASS
Date semantics:                  PASS
Transaction semantics:           PASS
Reconciliation:                  PASS
Materializer integration:        PASS
REMOTE MATERIALIZER CI GATE:     PRESENT
Global Jest skips:               ACCOUNTED

Prisma:                          UNCHANGED
Migrations:                      UNCHANGED
Legacy:                          UNCHANGED
Residue:                         NONE

COMMIT:                          YES
PUSH:                            YES
PR:                              YES
MERGE:                           NO
GO 5C-B GIT CLOSURE:             YES
GO REMOTE CI:                    YES
GO 5C-B CLOSURE:                 CONDITIONAL
GO 5C-C:                         NO
```

No commit, push ni PR fueron ejecutados durante esta revisión.
