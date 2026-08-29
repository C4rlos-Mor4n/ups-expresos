# UPS GO — Phase 5B-B Resolver Remediation Review

Fecha: 2026-08-28
Rama: `feature/phase-5b-calendar-resolver`
Baseline auditado: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`
Modo: independent re-review, sin cierre Git

## 1. Verdict

Los cuatro hallazgos de la auditoría anterior quedan **CLOSED** después de
verificar el código, los tests, la integración PostgreSQL y el workflow CI.
Durante esta re-review sólo se añadió evidencia pequeña y directamente
relacionada: igualdad explícita de conteos, aserción de `TIME(0)` `06:40` y un
caso unitario de `RoutePathStop` ajeno.

El workflow está listo para ejecutar el gate remoto, pero no existe ejecución
remota en esta rama porque no se ha hecho push. Por esa razón Git Closure queda
autorizado como siguiente paso, no ejecutado en este turno.

## 2. Scope

Se revisaron físicamente:

- `apps/api/src/modules/calendar/**`;
- `apps/api/package.json`;
- `.github/workflows/ci.yml`;
- `apps/api/prisma/schema.prisma` y migraciones;
- los cinco documentos de diseño, BUILD, review y remediation indicados.

Se preservaron todos los cambios históricos del worktree. No se inició 5C, no
se cargó catálogo oficial y no se tocaron Mobile, Prisma schema, migraciones,
API pública u OpenAPI.

## 3. Findings Closure

| Finding | Estado | Evidencia |
|---|---|---|
| F5BB-B-01 — CI integration gate | CLOSED | Script dedicado y paso CI explícito con flag |
| F5BB-B-02 — Journey ordering | CLOSED | Sort en dominio y test C/A/B |
| F5BB-B-03 — Integration depth | CLOSED | Aggregate PostgreSQL completo y dos journeys |
| F5BB-B-04 — Test evidence | CLOSED | Matrices unitarias y ejecución TZ × 3 |

## 4. Journey Determinism

`calendar-resolver.functions.ts:120-123` define el orden inmutable por
`journeyTemplateId ASC`. `calendar-resolver.functions.ts:417-462` ordena los
templates antes de resolver y vuelve a ordenar el output de dominio. El
repository añade defensa secundaria en `calendar.repository.ts:44-45`.

El test `calendar-resolver.functions.spec.ts:388-415` entrega C, A y B,
compara IDs explícitos y exige A, B, C. No usa snapshot.

## 5. Unit Coverage

La suite calendar ejecuta `37 passed` tests unitarios. Cubre fechas ISO,
leap-year, fechas imposibles, timestamps, límites inclusivos, fuera de rango,
los siete weekdays, calendarios 0/1/múltiples, timezone no soportado, patrones,
excepciones, identidad, journeys, stops, offsets y repetición determinista.

## 6. PostgreSQL Integration

`calendar-resolver.integration.spec.ts:79-201` crea con PostgreSQL real todos
los elementos del aggregate:

```text
Campus, ServiceLine, ServiceCalendar, SchedulePattern,
SchedulePatternDay, ScheduleTime, Stop, RoutePath,
RoutePathStop, ScheduleJourneyTemplate, ScheduledStopTime
```

No hay mocks de repository ni catálogo oficial.

## 7. Full Timetable

La integración crea dos RoutePath y dos JourneyTemplate para el mismo
ScheduleTime. Inserta B antes de A y verifica IDs ordenados. Valida:

```text
RoutePathStop count = ScheduledStopTime count = 6
timetableCompleteness = COMPLETE
offsets = 0, 20, 30
```

También comprueba `serviceCalendarId`, `patternId`, `scheduleTimeId`,
`journeyTemplateId` y `routePathId` desde el output real.

## 8. Cleanup Safety

`calendar-resolver.integration.spec.ts:43-55` elimina únicamente UUIDs de la
suite, en orden inverso de dependencias, sin `deleteMany({})` global ni borrado
por nombres. `afterAll:204-210` usa `try/finally` y desconecta Prisma incluso
si falla una assertion. El setup usa `$transaction:78-201`, aislando fallos de
creación sin ocultar la lectura posterior del resolver.

## 9. Date and Weekday

Los tests verifican ISO válido, leap year 2024, fecha imposible, timestamp
rechazado, límites `validFrom`/`validUntil`, fecha fuera de rango y Monday a
Sunday explícitos.

## 10. Timezone Independence

La suite calendar y la integración completa pasaron bajo:

```text
TZ=UTC
TZ=America/Guayaquil
TZ=Asia/Tokyo
```

Cada ejecución de integración pasó `1 suite / 1 test` y comprobó las horas y
los offsets de medianoche.

## 11. TIME(0)

`calendar.repository.ts:89-91` usa `getUTCHours`, `getUTCMinutes` y
`getUTCSeconds`. La integración persiste `23:50:00` y metadata
`approximateArrivalTime = 06:40:00`, y verifica ambos valores bajo los tres
TZ. Los planned stop times siguen derivados de departure + offsets, no de
approximate arrival.

## 12. Exception Matrix

La suite verifica DRAFT/CANCELLED ignorados, excepción específica sobre global,
global sobre regular, `NO_SERVICE`, `REPLACE_TIMES`, `ADD_TIMES`, patrón faltante,
múltiples patrones, calendario ajeno y patrón con weekdays inválidos.

## 13. Journey Matrix

Se verifican cero journeys como `PARTIAL`, múltiples journeys, orden
determinista C/A/B, ServiceLine ajena y dirección incorrecta.

## 14. Stop Matrix

Se verifican timetable completo e incompleto, `RoutePathStop` ajeno, primer
offset distinto de cero, offsets decrecientes, offsets iguales y orden por
`stopOrder`.

## 15. Read-only

El runtime de resolver/repository sólo contiene lecturas Prisma. Las escrituras
detectadas pertenecen exclusivamente al setup y cleanup del fixture. El test
compara conteos antes/después y pasa con cero cambios durante `resolveSchedule`.

## 16. Legacy Isolation

No existe acceso a `prisma.schedule`, fallback a `Schedule` legacy ni
implementación de `ScheduledDeparture`, `ServiceAssignment` o `ServiceRun` en
el módulo nuevo.

## 17. Package Script

`apps/api/package.json:14` contiene:

```text
test:calendar:integration
```

La ruta real se ejecutó con éxito mediante:

```bash
RUN_CALENDAR_INTEGRATION=true pnpm test:calendar:integration
```

## 18. CI Workflow

`.github/workflows/ci.yml` conserva PostgreSQL `postgres:17-alpine`,
`DATABASE_URL`, Node `20` y pnpm `10.34.5`. El paso dedicado está en las líneas
83-86, después de install, Prisma generate, migrate deploy y migrate status.

El workflow mantiene además el Jest global en las líneas 97-98.

## 19. CI Gate Semantics

El paso dedicado exporta `RUN_CALENDAR_INTEGRATION: "true"`, no tiene
`continue-on-error` y reutiliza el único servicio PostgreSQL existente. Un
fallo propaga el exit code y hace fallar el job `API Quality Gate`.

No hay ejecución remota actual: la rama no se ha enviado al remoto.

## 20. Prisma

No hay diff en `apps/api/prisma/schema.prisma` ni en
`apps/api/prisma/migrations`. `pnpm prisma validate` pasa y
`pnpm prisma migrate status` reporta cuatro migraciones y base actualizada.
No se utilizó `db push`.

## 21. OpenAPI

No se añadió controller, ruta, DTO público ni Swagger. `pnpm test:openapi`
termina con `openapi contract checks passed`.

## 22. Mobile

No se modificó `apps/mobile/**` durante la remediación ni la re-review. Los
cambios Mobile existentes son históricos y fueron preservados.

## 23. Findings

No quedan findings CRITICAL, HIGH, MEDIUM o LOW abiertos dentro del alcance de
Fase 5B-B. La única limitación informativa es que no hay CI remoto ejecutado
hasta hacer push; no es un defecto del workflow localmente auditado.

## 24. Fixes Applied

Durante la remediation build se aplicaron el orden de journeys, el fixture
PostgreSQL completo, el script y el paso CI, y la ampliación de la matriz.
Durante esta re-review se añadió únicamente:

- assertion explícita `RoutePathStop count == ScheduledStopTime count`;
- comprobación de `06:40:00` como `TIME(0)` metadata junto con `23:50:00`;
- assertion unitaria para `RoutePathStop` ajeno.

No se modificó el review histórico `PHASE_5B_B_CALENDAR_RESOLVER_BUILD_REVIEW.md`.

## 25. Remaining Risks

- La certificación remota depende de ejecutar el workflow después del push.
- Commit, PR y merge siguen fuera de esta re-review.
- Catálogo oficial, backfill, ScheduledDeparture, assignments, runs, Driver
  Auth, GPS, API pública, Mobile switch y Fase 5C siguen congelados.

## 26. Decision

```text
F5BB-B-01: CLOSED
F5BB-B-02: CLOSED
F5BB-B-03: CLOSED
F5BB-B-04: CLOSED

LOCAL BUILD:           PASS
LOCAL FULL POSTGRESQL: PASS — integración completa bajo TZ × 3
CI WORKFLOW READY:     PASS

COMMIT:                NO — no ejecutado
PUSH:                  NO — no ejecutado
PR:                    NO — no creado
MERGE:                 NO — pendiente de CI remoto

GO 5B-B GIT CLOSURE:   YES — siguiente paso autorizado
GO REMOTE CI:          YES — después de push
GO 5B-B CLOSURE:       CONDITIONAL — requiere CI remoto y merge
GO 5C-A:               NO
```

## Delivery Gate

| Check | Estado | Evidencia |
|---|---|---|
| Journey determinism | ✅ | Sort de dominio + C/A/B |
| Full PostgreSQL integration | ✅ | 1/1, aggregate completo |
| Midnight / TIME(0) | ✅ | 23:50, 06:40 y offsets bajo TZ × 3 |
| Test matrix | ✅ | 37 unit tests + integración |
| Cleanup / DB safety | ✅ | UUIDs, transaction setup, try/finally |
| Read-only / legacy | ✅ | Sin writes runtime ni Schedule legacy |
| CI dedicated hard gate | ✅ | Script + step sin soft-fail |
| Node/pnpm preserved | ✅ | Node 20 / pnpm 10.34.5 |
| Prisma/migrations unchanged | ✅ | validate/status y diff vacío |
| OpenAPI unchanged | ✅ | Contract test PASS |
| Mobile untouched | ✅ | Sin cambios de esta fase |
| lint | ✅ | `pnpm lint` |
| typecheck | ✅ | `pnpm typecheck` |
| build | ✅ | `pnpm build` |
| Jest | ✅ | 16 suites, 160 passed, 1 skipped |

**Estado: REMEDIATION INDEPENDENT RE-REVIEW — PASS. Git Closure autorizado,
pero no ejecutado.**
