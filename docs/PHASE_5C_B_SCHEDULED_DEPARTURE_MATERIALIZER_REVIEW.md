# UPS GO — Fase 5C-B

# Scheduled Departure Materializer — Independent Final Review

## Verdict

**GO técnico para revisión externa.**

La implementación local de Fase 5C-B satisface el contrato del materializador de
`ScheduledDeparture`, mantiene el nuevo dominio separado del legado y cerró todos
los findings identificados durante el review independiente inicial.

```text
Baseline certificado:
2119f5bcd967f7b6d432313d6e722a8e297e2097

Materializer domain:        PASS
Idempotency:                PASS
Concurrency:                PASS
Snapshot preservation:     PASS
Range processing:          PASS
Existing-row policy:       PASS
Reconciliation boundary:   PASS
Legacy coexistence:        PASS
Dead-code cleanliness:     PASS

Local QA:                   PASS
Remote CI configuration:   PRESENT
Remote CI execution:       PENDING
```

La aprobación no afirma que GitHub Actions haya ejecutado todavía esta rama. El
gate remoto está configurado, pero su ejecución sólo podrá certificarse después
de push/PR, operaciones expresamente no autorizadas en esta fase.

Evidencia final utilizada:

| Área                                      | Resultado                                                    |
| ----------------------------------------- | ------------------------------------------------------------ |
| Node.js                                   | `20.20.2`                                                    |
| pnpm                                      | `10.34.5`                                                    |
| Prisma validate                           | PASS                                                         |
| Migraciones                               | 5 aplicadas; base actualizada                                |
| lint                                      | PASS                                                         |
| typecheck                                 | PASS                                                         |
| build                                     | PASS                                                         |
| Jest global                               | 19 suites PASS, 3 opt-in skipped; 179 tests PASS, 12 skipped |
| Calendar PostgreSQL integration           | 1/1 PASS                                                     |
| ScheduledDeparture PostgreSQL integration | 1/1 PASS                                                     |
| Materializer PostgreSQL integration       | 10/10 PASS                                                   |
| OpenAPI con entorno CI                    | PASS                                                         |
| Cleanup PostgreSQL                        | campuses 0; scheduled departures 0                           |
| Prisma schema diff                        | 0                                                            |
| Migration diff                            | 0                                                            |
| API pública diff                          | 0                                                            |
| Mobile diff                               | 0                                                            |

## Findings

### Findings históricos y cierre

| ID       | Severidad | Finding original                                                                                                                                           | Impacto                                                                                                                                                            | Remediación                                                                                                                                                                                                                             | Estado |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F5CB-001 | HIGH      | `CalendarModule` dejó de exportar el `CalendarResolverService` preexistente.                                                                               | Introducía una ruptura del contrato interno del módulo aunque no hubiera un consumidor productivo localizado en ese momento.                                       | El módulo vuelve a exportar `CalendarResolverService`; el materializer se mantiene como provider privado hasta tener un consumidor real.                                                                                                | CLOSED |
| F5CB-002 | HIGH      | PostgreSQL integration descubrió que `createMany` recibía `serviceDate` como string corto `YYYY-MM-DD`. Prisma requiere `Date` o un DateTime ISO completo. | Toda ruta materializadora que intentaba escribir fallaba antes de llegar a PostgreSQL. `NO_SERVICE` era el único caso que pasaba porque no escribía.               | El repository convierte cada fecha civil a `new Date(\`${serviceDate}T00:00:00.000Z\`)`. Se agregó una regresión unitaria que verifica el valor entregado a `createMany`. La integración PostgreSQL completa pasa.                      | CLOSED |
| F5CB-003 | MEDIUM    | Faltaba una integración real para una fila con la misma identidad natural y snapshots divergentes de línea/dirección.                                      | Las dos lecturas batch estaban implementadas, pero no existía evidencia PostgreSQL de que una fila fuera de scope pudiera recuperarse y clasificarse sin mutación. | Se agregó una fila con la misma identidad `(sourceScheduleTimeId, serviceDate)`, `serviceLineId` divergente y dirección `RETORNO`. El materializer devuelve `RECONCILIATION_REQUIRED`, informa ambos campos y conserva la fila intacta. | CLOSED |
| F5CB-004 | MEDIUM    | `NO_SERVICE` sólo se probaba contra una fecha sin filas existentes.                                                                                        | No estaba certificado con PostgreSQL que una salida histórica se reportara para reconciliación sin eliminación.                                                    | Se agregó una departure histórica en una fecha `NO_SERVICE`. El resultado reporta `missingFromCurrentResolution`, crea cero filas y mantiene el snapshot original.                                                                      | CLOSED |
| F5CB-005 | LOW       | El materializer no tenía logging operacional.                                                                                                              | Un futuro worker no dispondría de evidencia concisa de inicio, cierre, reconciliaciones o fallos de infraestructura.                                               | Se agregó logging agregado por operación/rango: inicio, resumen, configuración fallida, reconciliación e infraestructura. No registra filas individuales, entidades Prisma, credenciales ni causas sensibles.                           | CLOSED |

### Findings actuales

```text
CRITICAL: NONE
HIGH:     NONE
MEDIUM:   NONE
LOW:      NONE
```

No quedan findings técnicos abiertos en el BUILD local de 5C-B.

## Idempotency Audit

La identidad natural permanece congelada como:

```text
sourceScheduleTimeId + serviceDate
```

El materializer no usa hora visible, línea o dirección como identidad. Por tanto,
dos `ScheduleTime` distintos que coinciden nominalmente a las `16:50` producen dos
filas válidas.

La persistencia utiliza:

```text
createMany({ skipDuplicates: true })
```

respaldado por el índice único PostgreSQL de 5C-A. No existe un patrón vulnerable
`find-then-create`, un upsert que pueda sobrescribir snapshots ni raw SQL.

La integración PostgreSQL verifica:

- primera ejecución: crea exactamente las filas resueltas;
- segunda ejecución: crea cero y reporta las filas iguales;
- diez ejecuciones adicionales: el conteo final permanece estable;
- una colisión nominal conserva ambas identidades;
- `created + existingSame` representa correctamente la resolución de cada
  ejecución cuando no existen diferencias.

Resultado:

```text
GO IDEMPOTENCY: YES
```

## Concurrency Audit

La unidad transaccional es una fecha, línea y dirección. El resolver y el mapping
se ejecutan antes de la transacción; la transacción se limita a:

1. un `createMany({ skipDuplicates: true })`;
2. una lectura batch por identidades naturales esperadas;
3. una lectura batch por scope de línea, fecha y dirección.

No existe una transacción global para todo el rango y no hay queries por cada
departure. El aislamiento PostgreSQL normal `READ COMMITTED`, combinado con el
índice único, es suficiente para este algoritmo append-only.

La integración ejecuta cuatro materializaciones concurrentes sobre la misma
entrada y demuestra:

- una sola fila final por identidad natural;
- ninguna exposición inesperada de `P2002`;
- conteos agregados consistentes;
- ningún supuesto sobre cuál worker gana la carrera;
- estado final determinista.

Resultado:

```text
GO CONCURRENCY: YES
```

## Snapshot Audit

Los snapshots persistidos son:

```text
sourceScheduleTimeId
serviceCalendarId
serviceLineId
serviceDate
scheduledTime
direction
source
sourceExceptionId
```

El materializer sólo crea o reconoce filas existentes. No actualiza ni elimina
snapshots.

La integración PostgreSQL certifica dos escenarios de divergencia:

1. Una salida se materializa a las `06:40`; el `ScheduleTime` fuente cambia a
   `07:00`. La fila materializada conserva `06:40` y el resultado informa
   `scheduledTime` como diferencia.
2. Una fila preexistente usa la misma identidad natural, pero conserva otra línea
   y dirección. La lectura por identidad la encuentra aunque esté fuera del scope
   nominal, informa `serviceLineId` y `direction`, y no modifica la fila.

La comparación semántica excluye correctamente `id` y `createdAt`.

Resultado:

```text
GO SNAPSHOT MAPPING: YES
GO EXISTING-ROW POLICY: YES
```

## Resolver Boundary Audit

`CalendarResolverService` permanece como única fuente de verdad del calendario.
El materializer no vuelve a calcular:

- días de semana;
- vigencia de calendarios;
- selección de calendario publicado;
- precedencia de excepciones;
- `NO_SERVICE`;
- `REPLACE_TIMES`;
- `ADD_TIMES`;
- journeys o stop timetables.

El flujo observado es:

```text
CalendarResolverService
        ↓
ResolvedSchedule
        ↓
ResolvedDeparture[]
        ↓
ScheduledDeparture[]
```

Cada `ResolvedDeparture` genera exactamente una fila, sin importar si tiene cero,
uno o varios journeys. Los journeys no forman parte de la identidad y quedan para
la futura `ServiceAssignment`.

El mapping de provenance es explícito:

```text
REGULAR           → REGULAR / sourceExceptionId null
EXCEPTION_REPLACE → EXCEPTION_REPLACE / exception requerida
EXCEPTION_ADD     → EXCEPTION_ADD / exception requerida
```

Las pruebas fail-closed cubren:

- schedule fuera de la línea/dirección/fecha solicitada;
- hora resuelta inválida;
- identidad fuente duplicada;
- excepción que no coincide con el schedule resuelto;
- `REGULAR` con `sourceExceptionId` indebido;
- servicio disponible sin departures;
- error inesperado lanzado por el resolver.

Un error de dominio del resolver produce `RESOLUTION_FAILED`, cero writes para la
fecha y permite continuar el rango. Un throw inesperado se convierte en
`MaterializerInfrastructureError`, preserva la causa, no consulta persistencia y
aborta la operación.

`CalendarModule` conserva la compatibilidad del export anterior y mantiene el
materializer como provider interno no exportado. No existe controller ni
activación automática.

Resultado:

```text
CalendarResolver reused:       PASS
Duplicate calendar logic:      NONE
Legacy fallback:               NONE
GO MATERIALIZER DOMAIN:        YES
```

## PostgreSQL Audit

La validación local usó PostgreSQL real con las cinco migraciones certificadas.

```text
Prisma schema validation:      PASS
Migration status:              5 migrations, database up to date
New migration in 5C-B:         NONE
Schema change in 5C-B:         NONE
```

La integración del materializer ejecutó 10 casos y todos pasaron:

1. `REGULAR` + `ADD_TIMES`, colisión nominal y múltiples journeys;
2. provenance `REPLACE_TIMES`;
3. `NO_SERVICE` sin filas previas;
4. `NO_SERVICE` con fila histórica intacta;
5. idempotencia 1x, 2x y 10x;
6. cuatro ejecuciones concurrentes;
7. snapshot de hora preservado;
8. identidad natural con línea/dirección divergentes;
9. fila ausente de la resolución preservada;
10. rollback completo de un batch con FK inválida.

El error de fecha corta detectado por esta suite fue un hallazgo real del BUILD,
no un problema cosmético del test. Su corrección convierte la fecha civil a
medianoche UTC antes del write y mantiene el string civil en el contrato interno.

La prueba de rollback demuestra atomicidad por fecha: una FK inválida impide que
permanezca la fila válida del mismo batch.

Cleanup final independiente:

```text
Synthetic campuses remaining:            0
Synthetic scheduled departures remaining: 0
```

No se usó `db push`, reset, base de producción ni cleanup global sin scope.

## Test Matrix Audit

### Acceptance matrix

| Requisito                          | Estado | Evidencia                                                          |
| ---------------------------------- | ------ | ------------------------------------------------------------------ |
| CalendarResolver reused            | PASS   | El service inyecta y consume `CalendarResolverService`.            |
| No duplicate calendar logic        | PASS   | No hay cálculo paralelo de patrones, weekdays o excepciones.       |
| One ResolvedDeparture = one row    | PASS   | Mapping por departure; integración real.                           |
| Multiple journeys != multiple rows | PASS   | Dos journeys del mismo departure generan una fila.                 |
| Natural identity                   | PASS   | `(sourceScheduleTimeId, serviceDate)`.                             |
| Repeated execution                 | PASS   | 1x, 2x y 10x con conteo estable.                                   |
| Concurrent execution               | PASS   | Cuatro ejecuciones simultáneas sin duplicados ni fallo inesperado. |
| Nominal collision                  | PASS   | Dos fuentes a la misma hora producen dos filas.                    |
| REGULAR mapping                    | PASS   | Source y provenance verificadas.                                   |
| EXCEPTION_REPLACE mapping          | PASS   | Integración PostgreSQL `REPLACE_TIMES`.                            |
| EXCEPTION_ADD mapping              | PASS   | Integración PostgreSQL `ADD_TIMES`.                                |
| Exception provenance               | PASS   | Invariants y FKs verificadas.                                      |
| NO_SERVICE                         | PASS   | Cero writes; estado válido.                                        |
| Resolver errors                    | PASS   | Error de dominio y throw inesperado cubiertos.                     |
| Infrastructure errors              | PASS   | Causa preservada; no se convierten en `NO_SERVICE`.                |
| Existing identical                 | PASS   | No-op y contador `existingSame`.                                   |
| Existing different                 | PASS   | Hora, línea y dirección divergentes detectadas.                    |
| No silent update                   | PASS   | Snapshots permanecen intactos.                                     |
| No physical reconciliation         | PASS   | No update ni delete.                                               |
| Date/range validation              | PASS   | Fecha civil estricta y orden válido.                               |
| Bounded range                      | PASS   | Máximo inclusivo de 31 días.                                       |
| Date-level transaction policy      | PASS   | Una transacción acotada por fecha/scope.                           |
| No legacy fallback                 | PASS   | El materializer sólo usa el resolver nuevo.                        |
| No backfill                        | PASS   | No lectura o conversión de los 90 `Schedule` legacy.               |
| No API                             | PASS   | Controllers y OpenAPI sin cambios.                                 |
| No Mobile                          | PASS   | Diff Mobile igual a cero.                                          |
| No ServiceAssignment               | PASS   | No implementada.                                                   |
| No ServiceRun                      | PASS   | No implementada.                                                   |
| Prisma unchanged                   | PASS   | Schema diff igual a cero.                                          |
| Migrations unchanged               | PASS   | Migration diff igual a cero.                                       |
| lint                               | PASS   | Validación completa reportada.                                     |
| typecheck                          | PASS   | `tsc --noEmit`.                                                    |
| build                              | PASS   | `nest build`.                                                      |
| Jest                               | PASS   | 19 suites y 179 tests pasaron; opt-in separadas.                   |
| Calendar integration               | PASS   | 1/1 PostgreSQL.                                                    |
| ScheduledDeparture integration     | PASS   | 1/1 PostgreSQL.                                                    |
| Materializer integration           | PASS   | 10/10 PostgreSQL.                                                  |
| OpenAPI                            | PASS   | Contrato validado con entorno CI.                                  |
| Dead-code/residue                  | PASS   | Sin residuos de 5C-B detectados.                                   |

### Suite summary

```text
Node.js:                                 20.20.2
pnpm:                                    10.34.5

Global Jest:
  passed suites:                         19
  skipped opt-in suites:                  3
  passed tests:                          179
  skipped tests:                          12

Calendar PostgreSQL integration:          1 / 1 PASS
ScheduledDeparture PostgreSQL integration:1 / 1 PASS
Materializer PostgreSQL integration:     10 / 10 PASS
OpenAPI contract:                         PASS
```

Las suites opt-in permanecen omitidas intencionalmente en Jest global y se
ejecutan mediante scripts/gates dedicados. No se usa el resultado global para
ocultar la integración PostgreSQL.

### CI audit

El workflow conserva:

```text
Node.js:          20
pnpm:             10.34.5
PostgreSQL:       17-alpine
Job:              API Quality Gate
```

El materializer añade un único script dedicado:

```text
test:scheduled-departure-materializer:integration
```

y un paso hard-fail con:

```text
RUN_SCHEDULED_DEPARTURE_MATERIALIZER_INTEGRATION=true
```

No existe `continue-on-error`, `|| true`, un segundo job o una segunda base de
datos.

```text
CI local configuration audit: PASS
Remote CI execution:          PENDING
```

## Legacy Audit

5C-B no modifica ni sustituye consumidores legacy.

| Pieza              | Clasificación actual | Estado en 5C-B | Criterio futuro de retiro                           |
| ------------------ | -------------------- | -------------- | --------------------------------------------------- |
| `Schedule`         | ACTIVE               | UNCHANGED      | Después de migrar API y Mobile al nuevo dominio.    |
| `RouteAssignment`  | ACTIVE               | UNCHANGED      | Después de introducir y migrar `ServiceAssignment`. |
| `Trip`             | ACTIVE               | UNCHANGED      | Después de introducir y migrar `ServiceRun`.        |
| `currentOperation` | ACTIVE               | UNCHANGED      | Después de reemplazo compatible en API y Mobile.    |

No existe:

- fallback desde `CalendarResolver` a `Schedule`;
- backfill de registros legacy;
- cambio de endpoint o response existente;
- controller nuevo;
- activación Mobile;
- `ServiceAssignment`;
- `ServiceRun`;
- scheduler, cron, BullMQ, Redis lock o materialización al startup.

Auditoría de scope:

```text
Prisma schema changes:  0
Migration changes:      0
Public API changes:     0
Mobile changes:         0
Legacy changes:         0
```

Resultado:

```text
GO LEGACY COEXISTENCE: YES
```

## Residue Audit

No se detectaron residuos introducidos por 5C-B:

- materializer alternativo o duplicado;
- helper de calendario duplicado;
- wrapper Prisma sin consumidor;
- imports o exports huérfanos;
- flags temporales reutilizados;
- código comentado;
- `TODO` de 5C-B sin criterio de salida;
- logs de debug o por fila;
- dependencias nuevas innecesarias;
- scripts fuera del gate dedicado;
- adapter legacy temporal;
- mutación o reconciliación destructiva.

El logging agregado usa metadatos operacionales acotados:

```text
line id
direction
date/range
counts
error operation/code
```

No imprime credenciales, URLs de base de datos, payloads completos, entidades
Prisma ni la causa interna del error.

```text
5C-B RESIDUE: NONE
GO DEAD-CODE CLEANLINESS: YES
```

## GO / NO-GO

```text
GO MATERIALIZER DOMAIN:          YES
GO IDEMPOTENCY:                  YES
GO CONCURRENCY:                  YES
GO SNAPSHOT MAPPING:             YES
GO RANGE PROCESSING:             YES
GO EXISTING-ROW POLICY:          YES
GO RECONCILIATION BOUNDARY:      YES
GO LEGACY COEXISTENCE:           YES
GO DEAD-CODE CLEANLINESS:        YES
GO 5C-B EXTERNAL REVIEW:         YES

GO COMMIT:                       NO
GO PUSH:                         NO
GO PR:                           NO
GO 5C-C:                         NO
```

La autorización para revisión externa se basa en evidencia local completa y en
la configuración del gate remoto. No equivale a una certificación de GitHub
Actions.

```text
REMOTE CI EXECUTION: PENDING
5C-B GIT CLOSURE:    NOT AUTHORIZED
5C-C:                NOT AUTHORIZED
```
