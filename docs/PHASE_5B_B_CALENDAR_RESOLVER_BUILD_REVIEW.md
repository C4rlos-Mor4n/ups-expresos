# UPS GO — Fase 5B-B Independent Build Review

Estado: REVIEW COMPLETADO — CIERRE NO AUTORIZADO
Fecha: 2026-08-28
Rama auditada: `feature/phase-5b-calendar-resolver`
Baseline: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`

## 1. Veredicto ejecutivo

El BUILD funciona localmente y la integración PostgreSQL explícita pasa, pero
no queda certificado para cierre. El workflow remoto no ejecuta la integración
calendar; además, la implementación todavía tiene un gap de determinismo en el
orden de journeys y la prueba PostgreSQL no cubre la cadena completa de ruta,
paradas y timetable.

No se modificaron código, Prisma, migraciones, CI, API, OpenAPI ni Mobile
durante esta auditoría. No se hizo commit, push, PR ni merge.

## 2. Resultado solicitado

```text
LOCAL POSTGRES INTEGRATION:  PASS (1 suite, 1 test)
REMOTE CI INTEGRATION GATE:  MISSING

COMMIT:                       NO
PUSH:                         NO
PR:                           NO
MERGE:                        NO
```

Estado de cierre:

```text
5B-B BUILD:                  COMPLETED LOCALMENTE
5B-B INDEPENDENT REVIEW:     CONDITIONAL / FINDINGS OPEN
5B-B CLOSURE:                NO
5C:                          NOT AUTHORIZED
```

## 3. Evidencia de validación local

| Gate | Resultado | Evidencia |
|---|---|---|
| lint | PASS | `pnpm lint` |
| typecheck | PASS | `pnpm typecheck` |
| build | PASS | `pnpm build` |
| Prisma validate | PASS | `pnpm prisma validate` |
| Migration status | PASS | 4 migraciones, base actualizada |
| OpenAPI | PASS | `openapi contract checks passed` |
| Jest global | PASS CON OMITIDO | 16 suites passed; 145 tests passed; 1 suite y 1 test skipped |
| PostgreSQL explícito | PASS | `RUN_CALENDAR_INTEGRATION=true ...calendar-resolver.integration.spec.ts`; 1/1 |
| Legacy isolation | PASS | No hay `prisma.schedule` ni fallback legacy en el módulo |
| Resolver runtime read-only | PASS | No hay create/update/delete/upsert en repository o resolver |
| Prisma schema/migrations | PASS | Sin cambios producidos por el BUILD |
| API/OpenAPI boundary | PASS | No se añadió controller ni endpoint público |

La integración no se ejecuta en Jest global porque
`calendar-resolver.integration.spec.ts:13-14` elige `describe.skip` salvo que
`RUN_CALENDAR_INTEGRATION=true` esté presente.

## 4. Hallazgos abiertos

### F5BB-B-01 — El CI remoto no tiene integration gate

**Severidad:** HIGH — bloquea certificación remota y cierre.

`.github/workflows/ci.yml:44-47` define `DATABASE_URL`, pero no define
`RUN_CALENDAR_INTEGRATION=true`. El paso `Unit tests` de
`.github/workflows/ci.yml:93` ejecuta sólo `pnpm exec jest --runInBand`, por lo
que el test de PostgreSQL queda omitido. `apps/api/package.json` tampoco tiene
un script dedicado para esta integración.

El job sí tiene PostgreSQL efímero y ejecuta migraciones, de modo que no falta
infraestructura base; falta convertirla en un gate explícito.

### F5BB-B-02 — Orden de journeys no determinista

**Severidad:** HIGH — contradice el contrato de determinismo.

El diseño exige `journeys: journeyTemplateId ASC`. El repository carga
`journeyTemplates` sin `orderBy` en `calendar.repository.ts:42-66`, y la
resolución agrega los journeys en el orden recibido sin una ordenación final.
Las departures sí se ordenan, y los stops se ordenan por `stopOrder`, pero el
orden de múltiples journeys queda dependiente del orden entregado por Prisma o
por otra fuente del aggregate.

Debe corregirse antes de certificar el resolver y acompañarse de un test con
dos journeys que verifique el orden por `journeyTemplateId`.

### F5BB-B-03 — La integración PostgreSQL es válida pero superficial

**Severidad:** MEDIUM — cobertura insuficiente para certificar relaciones completas.

El fixture de `calendar-resolver.integration.spec.ts:29-77` crea Campus,
ServiceLine, ServiceCalendar, SchedulePattern, SchedulePatternDay y
ScheduleTime. No crea RoutePath, RoutePathStop, ScheduleJourneyTemplate ni
ScheduledStopTime. Por tanto, el PASS local comprueba selección del agregado,
estado publicado, hora y read-only de la resolución básica, pero no la carga y
validación relacional completa del timetable.

El aislamiento del fixture es razonable: usa UUIDs sintéticos, una base
PostgreSQL real y cleanup explícito. La solución correcta es ampliar ese mismo
fixture, no eliminar el skip ni mezclarlo silenciosamente con los unit tests.

### F5BB-B-04 — La matriz mínima del diseño no está completamente demostrada

**Severidad:** MEDIUM — gap de evidencia, no fallo observado en los gates.

La matriz aprobada en `PHASE_5B_B_CALENDAR_RESOLVER_DESIGN.md` exige, entre
otros, límites inclusivos y fechas fuera de rango, timezone no soportado,
lunes a domingo, excepciones DRAFT/CANCELLED, múltiples patrones de excepción,
múltiples journeys, template incompleto, primer offset distinto de cero y
sorting determinista. La suite reporta 22 casos unitarios, pero varios de esos
escenarios no tienen una aserción dedicada o están combinados parcialmente.

El resultado `22/22` es correcto como conteo de tests ejecutados; no equivale a
demostrar toda la matriz contractual de 25 reglas.

## 5. Qué sí queda aprobado

- La separación entre calendario publicado, patrón regular y excepción está
  implementada sin fallback a `Schedule` legacy.
- La precedencia de excepción, `NO_SERVICE`, `REPLACE_TIMES`, `ADD_TIMES`, la
  identidad por `scheduleTimeId` y la aritmética de medianoche están cubiertas
  por tests existentes.
- El resolver no crea `ScheduledDeparture`, `ServiceAssignment` ni
  `ServiceRun`.
- No hay endpoint público nuevo ni cambio de contrato OpenAPI.
- `apps/api/prisma/schema.prisma` y las migraciones permanecen intactos.
- Mobile no fue tocado por este BUILD; el worktree contiene cambios Mobile
  históricos ajenos a esta auditoría y se preservó sin limpieza.

## 6. Próximo paso autorizado

```text
GO CI FIX:                   YES, pero después de cerrar F5BB-B-02
GO INTEGRATION EXPANSION:    YES
GO TEST-MATRIX COMPLETION:   YES
GO REMOTE REVALIDATION:      YES, después de los fixes
GO 5B-B CLOSURE:             NO, todavía
GO 5C:                       NO
```

La corrección mínima de CI debería ser explícita y usar el PostgreSQL que ya
levanta el workflow, por ejemplo:

```json
"test:calendar:integration": "RUN_CALENDAR_INTEGRATION=true jest src/modules/calendar/calendar-resolver.integration.spec.ts --runInBand"
```

y un paso separado después de `prisma migrate deploy`. No se aplicó ese cambio
en esta revisión.

## Delivery Gate — Independent Build Review

| Check | Estado |
|---|---|
| Resolver contract | CONDITIONAL — ordenar journeys |
| Domain rules | PASS focal / matrix incompleta |
| Read-only | PASS |
| Unit tests | PASS — 145 globales; 22 calendar ejecutados |
| Local PostgreSQL integration | PASS — alcance básico |
| Full timetable integration | PENDING |
| Legacy isolation | PASS |
| Prisma unchanged | PASS |
| OpenAPI unchanged | PASS |
| Mobile unchanged by BUILD | PASS |
| Remote CI integration gate | MISSING |
| Git closure | NOT AUTHORIZED |

**Conclusión:** el BUILD está completo localmente, pero la certificación es
CONDITIONAL. Primero deben cerrarse el orden determinista de journeys, la
integración relacional suficiente y el gate PostgreSQL remoto. 5C permanece
congelada.
