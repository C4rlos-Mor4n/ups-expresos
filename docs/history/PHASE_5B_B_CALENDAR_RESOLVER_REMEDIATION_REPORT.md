# UPS GO — Phase 5B-B Resolver Remediation

Estado: REMEDIATION BUILD COMPLETADO LOCALMENTE — PENDIENTE DE RE-REVIEW
Fecha: 2026-08-28
Rama: `feature/phase-5b-calendar-resolver`
Baseline: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`

## 1. Verdict

Los cuatro hallazgos del independent build review fueron atendidos dentro del
alcance autorizado. La remediación pasa los gates locales, deja preparado el
integration gate obligatorio de CI y no modifica Prisma schema, migraciones,
API pública, OpenAPI, Mobile ni Fase 5C.

La certificación remota aún no existe porque no se hizo push. Tampoco se
autoriza todavía commit, PR, merge ni cierre formal de 5B-B: corresponde ahora
la independent re-review.

## 2. Findings Addressed

| Finding | Resultado |
|---|---|
| F5BB-B-01 CI integration gate | Corregido en package script y `.github/workflows/ci.yml` |
| F5BB-B-02 Journey ordering | Corregido en la capa de dominio y cubierto con C/A/B |
| F5BB-B-03 Integration depth | Corregido con RoutePath, stops, journeys y stop times reales |
| F5BB-B-04 Test evidence | Ampliada la matriz de fechas, weekdays, excepciones, journeys y offsets |

## 3. Journey Determinism

`ResolvedDeparture.journeys` se ordena explícitamente por
`journeyTemplateId ASC` en la función pura, independiente del orden del
repository o de aggregates sintéticos. El repository también solicita
journeys por ID ascendente como consistencia adicional.

El test unitario entrega `journey-C`, `journey-A`, `journey-B` y exige:

```text
journey-A
journey-B
journey-C
```

La integración PostgreSQL crea primero el journey B y luego A, y verifica que
el resultado queda ordenado por identidad.

## 4. Integration Expansion

El fixture sigue siendo sintético y aislado mediante UUIDs propios. Ahora
incluye:

```text
Campus
ServiceLine
ServiceCalendar
SchedulePattern
SchedulePatternDay
ScheduleTime
Stop
RoutePath
RoutePathStop
ScheduleJourneyTemplate
ScheduledStopTime
```

Se crean dos RoutePath para el mismo ScheduleTime y tres paradas por path, sin
usar catálogo real UPS.

## 5. Full Timetable Fixture

El fixture usa salida `23:50` y offsets `0`, `20`, `30`. La integración verifica
para ambos journeys:

```text
23:50:00 → dayOffset 0
00:10:00 → dayOffset 1
00:20:00 → dayOffset 1
```

También verifica `COMPLETE`, source identity, patrón, calendario, path,
paradas, `stopOrder` y offsets.

## 6. Test Matrix

La evidencia unitaria cubre ahora las reglas principales del contrato:

| Área | Evidencia |
|---|---|
| Date | ISO, timestamp rechazado, leap year, fecha imposible, rango inclusivo y fuera de rango |
| Weekdays | Monday a Sunday explícitos |
| Calendar | cero, uno, múltiples y timezone no soportado |
| Regular pattern | válido, sin patrón y ambiguo |
| Exceptions | DRAFT/CANCELLED, global, específica, prioridad, NO_SERVICE, REPLACE, ADD |
| Exception patterns | faltante, múltiple, otro calendario y weekdays inválidos |
| Identity | colisión visible preservando distintos `scheduleTimeId` |
| Journeys | cero, múltiples, orden determinista, service line y direction inválidos |
| Stops | completo, incompleto, offset inicial, decrecimiento, igualdad y `stopOrder` |
| Time | medianoche y resolución repetida semánticamente idéntica |

La suite calendar ejecuta `37` tests unitarios. El test PostgreSQL dedicado
ejecuta `1` test de integración completo.

## 7. Timezone Validation

Se ejecutó la suite calendar con:

```text
TZ=UTC
TZ=America/Guayaquil
TZ=Asia/Tokyo
```

En los tres casos el resultado fue `37 passed` y `1 skipped` suite de
integración por el guard opt-in. La integración explícita pasó por separado.

La normalización de `TIME(0)` permanece basada en métodos UTC y la salida
`06:40:00`/`23:50:00` no depende del timezone del host.

## 8. PostgreSQL Integration

La integración se ejecutó con PostgreSQL local real mediante:

```bash
RUN_CALENDAR_INTEGRATION=true pnpm test:calendar:integration
```

Resultado:

```text
1 suite passed
1 test passed
```

El setup usa `$transaction`, UUIDs sintéticos y no imprime secretos. El
cleanup usa únicamente IDs de esta suite y respeta el orden de dependencias:
stop times, journeys, schedule, patrón, paths, stops, calendario, línea y
campus. El test compara conteos antes y después de resolver y verifica que no
hay escrituras durante la resolución.

## 9. CI Gate

Se añadió el script:

```json
"test:calendar:integration": "jest --runInBand --runTestsByPath src/modules/calendar/calendar-resolver.integration.spec.ts"
```

El workflow existente conserva el job PostgreSQL, Node `20`, pnpm `10.34.5`,
DATABASE_URL y migraciones. Después de `prisma migrate deploy`/status ejecuta
un paso dedicado con:

```yaml
RUN_CALENDAR_INTEGRATION: "true"
```

El paso no tiene `continue-on-error`, por lo que un fallo hace fallar el job.
El Jest global se conserva y no es reemplazado.

El workflow está preparado localmente, pero su ejecución remota queda pendiente
hasta el flujo posterior de re-review, commit y push autorizado.

## 10. Read-only Guarantee

El runtime del resolver continúa sin create/update/delete/upsert. Las escrituras
del integration fixture ocurren únicamente durante setup/cleanup explícitos y
no dentro de `resolveSchedule`.

## 11. Legacy Isolation

No se consulta `Schedule` legacy ni se añade fallback. Mobile continúa fuera
del resolver nuevo.

## 12. Prisma

`apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations` no fueron
modificados. `prisma validate` pasa y `prisma migrate status` reporta cuatro
migraciones aplicadas y la base actualizada. No se usó `db push`.

## 13. OpenAPI

No se creó controller, DTO público, route ni cambio de Swagger/OpenAPI.
`pnpm test:openapi` pasa.

## 14. Mobile

`apps/mobile/**` no fue modificado por esta remediación. Los cambios históricos
del worktree se preservaron, incluido su whitespace.

## 15. Validation

| Gate | Resultado |
|---|---|
| Focused calendar unit tests | PASS — 37 passed |
| Calendar integration | PASS — 1/1 |
| Jest global | PASS — 16 suites, 160 passed, 1 skipped |
| Prisma validate | PASS |
| Prisma migrate status | PASS — database up to date |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| OpenAPI contract | PASS |
| TZ UTC / Guayaquil / Tokyo | PASS — mismo resultado semántico |

## 16. Remaining Risks

- No existe todavía certificación remota porque no se ha hecho push.
- El Jest global conserva el skip deliberado; la cobertura PostgreSQL se exige
  en el paso dedicado de CI.
- Backfill, catálogo oficial, perfiles, ScheduledDeparture, assignments, runs,
  Driver Auth, GPS, API pública y switch Mobile siguen fuera de alcance.

## 17. Next Step

Solicitar `FASE 5B-B REMEDIATION INDEPENDENT RE-REVIEW`. Hasta recibirla:

```text
COMMIT: NO
PUSH:   NO
PR:     NO
MERGE:  NO
5B-B:   CLOSURE PENDING
5C:     NOT AUTHORIZED
```

No se ejecutaron acciones Git durante la remediación.
