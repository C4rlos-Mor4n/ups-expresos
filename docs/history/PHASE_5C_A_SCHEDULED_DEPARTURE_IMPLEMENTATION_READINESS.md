# UPS GO — Fase 5C-A ScheduledDeparture

**Estado:** IMPLEMENTATION READINESS / SCHEMA FREEZE

**Baseline auditado:** `4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc`

**Fecha:** 2026-08-29

## 1. Corrección de alcance

La auditoría corrige el alcance anterior: **no se autoriza ni se propone
`ScheduledDepartureTemplate`**.

El modelo existente `ScheduleJourneyTemplate` ya representa las alternativas
de recorrido/timetable. La selección del template corresponde al futuro
`ServiceAssignment`, no a `ScheduledDeparture`.

```text
ScheduledDeparture 0..N ServiceAssignment
ServiceAssignment   → ScheduleJourneyTemplate
```

Resultado:

```text
SCHEDULED_DEPARTURE_TEMPLATE_REQUIRED = NO
SCHEDULED_DEPARTURE_HAS_JOURNEY       = NO
```

## 2. Veredicto

`ScheduledDeparture` representa una oferta concreta de servicio programada
para una fecha civil, originada por un `ScheduleTime` resuelto.

```text
GO ScheduledDeparture domain:       YES
GO Natural identity:                YES
GO Snapshot strategy:               YES
GO ServiceLine relation:            YES
GO Direction snapshot:              YES
GO Calendar provenance:             YES
GO Pattern provenance:              NO — derivable, no duplicar
GO Exception provenance:            YES — source + nullable FK
GO Journey relation:                NO — future assignment
GO ScheduledDepartureTemplate:      NO
GO Status model:                    NO — queda para 5C-B
GO Mutability model:                YES — snapshot append-only
GO Delete policy:                   YES — RESTRICT
GO Index strategy:                  YES
GO Idempotency:                     YES — database unique
GO Concurrency design:              YES — unique barrier
GO Legacy coexistence:              YES
GO Dead-code plan:                  YES

GO 5C-A schema implementation:      YES — solo ScheduledDeparture
GO 5C-A migration:                  YES — aditiva
GO 5C-B materializer:              NO
GO ServiceAssignment:              NO
GO ServiceRun:                     NO
GO Backfill:                       NO
GO Public API:                     NO
GO Mobile:                         NO
GO Legacy deletion:                NO
```

El GO autoriza el BUILD físico posterior, no significa que el schema ni la
migración ya estén implementados.

## 3. Alcance protegido

El BUILD de 5C-A podrá modificar únicamente:

- `apps/api/prisma/schema.prisma` para el nuevo enum/modelo y relaciones
  inversas estrictamente necesarias;
- una migración Prisma nueva y aditiva;
- pruebas/documentación de la propia implementación.

No se autoriza tocar:

- `Schedule`, `RouteAssignment`, `Trip` ni `currentOperation`;
- `ScheduleJourneyTemplate` semánticamente;
- `CalendarResolverService` o sus reglas;
- Mobile, OpenAPI, API pública, seed, catálogo, backfill o producción;
- `ServiceAssignment`, `ServiceRun`, GPS, Driver Auth o materialización.

## 4. Responsabilidad e identidad

Ejemplo:

```text
ServiceLine: Ruta Norte
Direction: IDA
ServiceDate: 2026-09-01
Source ScheduleTime: sch_time_123
Scheduled Time: 06:40

→ exactamente una ScheduledDeparture para esa fuente y fecha
```

La identidad natural e idempotencia son:

```text
UNIQUE(sourceScheduleTimeId, serviceDate)
```

No se utiliza `serviceLineId + direction + scheduledTime + serviceDate`,
porque dos `ScheduleTime` distintos pueden producir la misma hora visible.

El PK técnico continúa siendo UUID, siguiendo la convención vigente:

```prisma
id String @id @default(uuid()) @db.Uuid
```

## 5. Snapshots y provenance

### `scheduledTime` — YES

Se persiste como `TIME(0)`. La FK conserva la fuente y el snapshot conserva la
verdad histórica si posteriormente cambia el `ScheduleTime`.

### `serviceLineId` — YES

Es obligatorio para consultas Student/Admin, índices y futura operación. La
materialización debe validar que coincida con:

```text
ScheduleTime → SchedulePattern → ServiceCalendar.serviceLineId
```

### `direction` — YES

Es un snapshot operacional y debe coincidir con el `SchedulePattern` fuente.

### `serviceCalendarId` — YES

Es provenance directo del calendario publicado que originó la salida. Aunque
pueda reconstruirse por joins, aporta trazabilidad e histórico sin duplicar el
pattern.

### `sourceSchedulePatternId` — NO

El pattern se reconstruye desde `sourceScheduleTimeId`; guardarlo además
duplicaría provenance sin una responsabilidad operativa aprobada.

### Exception provenance — YES

El resolver ya distingue `REGULAR`, `EXCEPTION_REPLACE` y `EXCEPTION_ADD`.
Se conservarán:

```text
source: REGULAR | EXCEPTION_REPLACE | EXCEPTION_ADD
sourceExceptionId: nullable FK
```

Para una salida regular, `sourceExceptionId` es `NULL`. Para una salida de
excepción, el materializador debe validar que la excepción corresponda al
calendario y fecha resueltos. La FK será `RESTRICT`.

## 6. Journey semantics

`ScheduledDeparture` no tendrá `routePathId` ni
`scheduleJourneyTemplateId`.

Una hora puede tener varios recorridos posibles:

```text
ScheduleTime 06:40
├── ScheduleJourneyTemplate A → RoutePath A
├── ScheduleJourneyTemplate B → RoutePath B
└── ScheduleJourneyTemplate C → RoutePath C
```

La salida representa una sola oferta horaria. Más adelante:

```text
ScheduledDeparture
├── ServiceAssignment → JourneyTemplate A → Bus 1
├── ServiceAssignment → JourneyTemplate B → Bus 2
└── ServiceAssignment → JourneyTemplate C → Bus 3
```

Esto permite múltiples buses sin crear departures duplicadas y sin elegir
prematuramente un ramal.

## 7. Status y mutabilidad

### Status — NO en 5C-A

No se agrega enum `ScheduledDepartureStatus` todavía. La necesidad de
`CANCELLED`, su relación con `NO_SERVICE` y la reconciliación de assignments
pertenece a 5C-B. No se mezclan estados `IN_PROGRESS` o `COMPLETED` con esta
entidad.

`NO_SERVICE` produce cero departures; no crea placeholders cancelados.

### Mutabilidad

La fila no es un CRUD editable de horarios. Después de materializarla son
conceptualmente inmutables:

```text
sourceScheduleTimeId
serviceCalendarId
serviceLineId
direction
serviceDate
scheduledTime
source
sourceExceptionId
```

Se conserva únicamente `createdAt`; `updatedAt` no aporta valor a un snapshot
append-only y se evita agregarlo por inercia.

## 8. Modelo Prisma exacto propuesto

```prisma
enum ScheduledDepartureSource {
  REGULAR
  EXCEPTION_REPLACE
  EXCEPTION_ADD
}

model ScheduledDeparture {
  id                   String                    @id @default(uuid()) @db.Uuid
  sourceScheduleTimeId String                    @db.Uuid
  serviceCalendarId    String                    @db.Uuid
  serviceLineId        String                    @db.Uuid
  serviceDate          DateTime                  @db.Date
  scheduledTime        DateTime                  @db.Time(0)
  direction            Direction
  source               ScheduledDepartureSource
  sourceExceptionId    String?                   @db.Uuid
  createdAt            DateTime                  @default(now()) @db.Timestamptz(3)

  sourceScheduleTime ScheduleTime      @relation(fields: [sourceScheduleTimeId], references: [id], onDelete: Restrict)
  serviceCalendar    ServiceCalendar   @relation(fields: [serviceCalendarId], references: [id], onDelete: Restrict)
  serviceLine        ServiceLine       @relation(fields: [serviceLineId], references: [id], onDelete: Restrict)
  sourceException    ServiceException? @relation(fields: [sourceExceptionId], references: [id], onDelete: Restrict)

  @@unique([sourceScheduleTimeId, serviceDate])
  @@index([serviceLineId, serviceDate, direction, scheduledTime])
  @@index([serviceCalendarId, serviceDate])
  @@index([sourceExceptionId])
  @@map("scheduled_departures")
}
```

Relaciones inversas mínimas que el BUILD deberá agregar:

```prisma
ServiceLine.scheduledDepartures
ServiceCalendar.scheduledDepartures
ScheduleTime.scheduledDepartures
ServiceException.scheduledDepartures
```

No se agrega ninguna relación inversa en `ScheduleJourneyTemplate`, porque no
existe relación directa en esta fase.

## 9. Invariantes físicos y de aplicación

PostgreSQL/Prisma impondrán:

| Invariante | Mecanismo |
|---|---|
| PK UUID no nulo | primary key |
| source/date idempotente | unique compuesto |
| source válido | FK `ScheduleTime`, `RESTRICT` |
| calendar válido | FK `ServiceCalendar`, `RESTRICT` |
| línea válida | FK `ServiceLine`, `RESTRICT` |
| excepción válida | FK nullable, `RESTRICT` |
| consultas por línea/fecha/sentido/hora | índice compuesto |
| consultas por calendar/date | índice compuesto |
| consultas por excepción | índice FK |

La aplicación/materializador deberá validar:

1. source, calendar, line y direction pertenecen a la misma cadena publicada;
2. `sourceExceptionId` coincide con `source` y la fecha resuelta;
3. `EXCEPTION_*` no se crea si el resolver devuelve `NO_SERVICE` o error;
4. una `ResolvedDeparture` crea una sola departure, aunque tenga varios
   journeys;
5. no se materializa por `ScheduleJourneyTemplate`;
6. una salida no se reescribe por cambios posteriores del timetable.

No se agregan constraints monstruosas para expresar estas relaciones cruzadas.
Se probarán con transacciones y fixtures de integración en el BUILD/materializer.

## 10. Tiempo, materializer e idempotencia futura

```text
serviceDate   PostgreSQL DATE, fecha civil de America/Guayaquil
scheduledTime PostgreSQL TIME(0), hora local
stops         serviceDate + hora + offset, pudiendo cruzar medianoche
real events   TIMESTAMPTZ en fases operacionales
```

El recorrido puede terminar al día siguiente sin alterar `serviceDate`.

5C-B consumirá exclusivamente:

```text
CalendarResolverService.resolveSchedule()
  → ResolvedSchedule.departures[]
  → 0/1 ScheduledDeparture por ResolvedDeparture
```

`NO_SERVICE` produce cero filas. Los errores del resolver producen fallo
cerrado; no se convierten en lista vacía.

La concurrencia de dos workers sobre la misma fuente/fecha queda protegida por
el unique compuesto. 5C-B decidirá si un `P2002` se reporta como existente o
se reintenta, pero nunca usará `SELECT exists → CREATE` como única protección.

La materialización será una ventana explícita `fromDate/toDate`; no se fija
aún un horizonte de 7, 14 o 30 días.

## 11. Delete policy

Todos los vínculos nuevos usan `ON DELETE RESTRICT`. Una fuente publicada o
una excepción utilizada por una salida no puede borrar silenciosamente su
historia.

No se hace delete físico de una salida una vez que exista cualquier operación
futura. La política de cancelación/reconciliación se diseñará en 5C-B.

## 12. LEGACY / DEAD-CODE GATE

### Clasificación verificada

| Elemento | Clasificación | Consumidores reales |
|---|---|---|
| `Schedule` | ACTIVE / futura compatibilidad | `SchedulesService`, Mobile, seed y tests |
| `RouteAssignment` | ACTIVE / futura compatibilidad | Admin, Driver Operations, Mobile y tests |
| `Trip` | ACTIVE / futura compatibilidad | Driver start/finish, Mobile, feedback y tests |
| `currentOperation` | ACTIVE / contrato legacy | `MobileService`, DTOs y pantallas Mobile |
| `Route` / `RouteStop` | ACTIVE | módulos, contratos y respuestas legacy |
| `AuditLog` | ACTIVE | servicios administrativos y operacionales |
| `RUN_CALENDAR_INTEGRATION` | TEST-ONLY | integración PostgreSQL de CI |
| código DEAD identificado | ninguno | no hay retiro seguro en esta fase |

No se clasifica una migración aplicada como dead code: es historia del schema.

5C-A no modifica consumidores, endpoints, DTOs, respuestas, seed ni helpers
legacy. `Schedule`, `RouteAssignment`, `Trip` y `currentOperation` deben
permanecer intactos.

### Criterios futuros de retiro

Sólo se podrá retirar una pieza cuando exista:

1. búsqueda real de consumidores con resultado cero;
2. adapter o contrato nuevo validado por cohorte;
3. comparación shadow/dual-read sin diferencias no explicadas;
4. plan de rollback y fecha de eliminación;
5. eliminación del código, imports, scripts, flags y tests huérfanos en la
   misma fase.

## 13. Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Duplicar materialización | HIGH | unique source/date en DB |
| Colisiones de hora visible | HIGH | source/date; no deduplicar |
| Mutación de fuente | HIGH | snapshots + política append-only |
| Borrado en cascada | HIGH | FKs `RESTRICT` |
| Provenance de excepción perdida | MEDIUM | source + FK nullable |
| Journey elegido demasiado pronto | HIGH | ninguna relación directa en departure |
| Backfill ambiguo de 90 Schedule | HIGH | permanece NO-GO |
| Dos fuentes de verdad | MEDIUM | ScheduleJourneyTemplate sólo se selecciona en assignment |
| Cancelación mal definida | MEDIUM | status fuera de 5C-A |

## 14. Migration design autorizado

La migración futura de 5C-A debe contener únicamente:

- enum `ScheduledDepartureSource`, si el BUILD conserva esta decisión;
- tabla `scheduled_departures`;
- FKs `RESTRICT`;
- unique source/date;
- índices mínimos aprobados;
- ninguna tabla de template puente;
- ninguna modificación de tablas legacy;
- ninguna modificación de datos, seed o contratos.

Prisma expresa completamente esta tabla, unique, índices y FKs. Por ello:

```text
MANUAL_SQL_REQUIRED = NO
```

El SQL generado deberá revisarse antes de aplicarse. No se usará `db push`, no
se editarán migraciones existentes y no se ejecutará `migrate reset`.

## 15. GIT GATE

Verificación requerida al terminar readiness:

```bash
git status --short
git diff -- apps/api
git diff -- apps/mobile
git diff -- apps/api/prisma/schema.prisma
git diff -- apps/api/prisma/migrations
git diff -- .github/workflows
```

Resultado esperado de esta fase:

```text
0 runtime changes
0 Prisma changes
0 migrations
0 Mobile changes
0 CI changes
No commit
No push
No PR
```

El único archivo nuevo es:

```text
docs/PHASE_5C_A_SCHEDULED_DEPARTURE_IMPLEMENTATION_READINESS.md
```

## 16. Delivery Gate — Readiness

| Check | Estado | Evidencia |
|---|---|---|
| Baseline auditado | ✅ | `4733f304e3c21b8f3bb3e474f5661bdfa5dca7bc` |
| Corrección de scope aplicada | ✅ | sin `ScheduledDepartureTemplate` |
| Schema actual validado | ✅ | `pnpm prisma validate` — válido |
| Migraciones actuales | ✅ | `pnpm prisma migrate status` — 4, actualizadas |
| Schema/migrations sin cambios | ✅ | `git diff --exit-code` sobre Prisma — limpio |
| ScheduledDeparture física existente | ✅ | no existe modelo ni tabla actual |
| Identidad natural | ✅ | unique source/date congelada |
| Snapshots/provenance | ✅ | secciones 5 y 8 |
| Legacy audit | ✅ | sección 12, consumidores reales verificados |
| Manual SQL | ✅ | no requerido por el modelo propuesto |
| Lint/typecheck/build/tests | N/A | no hubo cambios de código |
| API/OpenAPI/Mobile/CI | N/A | explícitamente fuera del alcance |
| BUILD físico | N/A | queda para el siguiente checkpoint |

**Estado:** `5C-A READINESS — GO para ScheduledDeparture schema únicamente`.

**No autorizado:** `ScheduledDepartureTemplate`, 5C-B Materializer,
ServiceAssignment, ServiceRun, backfill, API, Mobile y eliminación legacy.
