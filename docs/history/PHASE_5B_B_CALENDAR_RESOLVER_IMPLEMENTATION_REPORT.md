# UPS GO — Phase 5B-B Calendar Resolver Implementation

Estado: BUILD INTERNO COMPLETADO
Fecha: 2026-08-28
Rama: `feature/phase-5b-calendar-resolver`
Baseline: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`

## 1. Verdict

Se implementó el motor interno read-only de resolución de calendario. Acepta
línea, dirección y fecha civil, lee el agregado nuevo y devuelve un resultado
determinista sin materializar salidas ni consultar `Schedule` legacy.

No se implementaron endpoints, DTOs públicos, Mobile, Admin Web,
ScheduledDeparture, assignments, runs, Driver, GPS, cache, seed, fixture
oficial ni backfill.

## 2. Scope

Implementado: servicio interno, repositorio Prisma read-only, tipos y errores
de dominio, parser de fecha, weekday, calendarios, excepciones, patrones,
horarios, journeys, paradas, offsets, medianoche y tests.

Fuera de alcance: toda operación de 5C, contratos públicos y escritura durante
la resolución.

## 3. Architecture

```text
CalendarResolverService
        ↓
CalendarRepository
        ↓
PrismaService
```

Archivos principales bajo `apps/api/src/modules/calendar`:

```text
calendar.module.ts
calendar-resolver.service.ts
calendar.repository.ts
calendar.types.ts
calendar.errors.ts
calendar-resolver.functions.ts
*.spec.ts
```

Las reglas de negocio y aritmética temporal están en funciones puras.

## 4. Domain Contract

```ts
type ResolveScheduleInput = {
  serviceLineId: string;
  direction: Direction;
  serviceDate: string;
};
```

El resultado conserva `serviceCalendarId`, `patternId`, `scheduleTimeId`,
fuente, excepción, journeys, `timetableCompleteness` y warnings internos.
Las funciones usan `Result<T, E>` discriminado y no lanzan excepciones HTTP.

## 5. Repository

El repositorio primero distingue línea inexistente/inactiva, luego obtiene
calendarios candidatos con `findMany`, rango inclusivo y `take: 2`, y finalmente
carga el único agregado con `select` anidado. No usa `findFirst`, N+1, raw SQL,
cache ni operaciones de escritura.

Las horas `TIME(0)` se normalizan con métodos UTC de `Date`, sin depender del
timezone del host.

## 6. Calendar Resolution

Sólo se aceptan calendarios `PUBLISHED`, con:

```text
validFrom <= serviceDate <= validUntil
timezone = America/Guayaquil
```

La cardinalidad es `NO_PUBLISHED_CALENDAR`, un calendario para continuar o
`AMBIGUOUS_CALENDAR`. No existe fallback ni elección arbitraria.

## 7. Pattern Resolution

Los patrones regulares requieren calendario, dirección, `PUBLISHED`,
`EXPLICIT_TIMES`, `exceptionId = null` y weekday ISO. Cero produce
`NO_SERVICE` si no hay excepción; uno se resuelve; más de uno produce
`AMBIGUOUS_PATTERN`.

## 8. Exception Resolution

Las excepciones se buscan sólo en el calendario elegido, fecha exacta y estado
`PUBLISHED`. La prioridad es:

```text
direction-specific > global > regular > NO_SERVICE
```

Los patrones excepcionales se filtran por excepción, calendario, dirección,
estado y tipo. Se valida la pertenencia cruzada que el schema no impone con
una FK compuesta. No existe `ServiceExceptionTime`; se usa
`ServiceException → SchedulePattern → ScheduleTime`.

## 9. Timetable Resolution

```text
NO_SERVICE    → departures []
REPLACE_TIMES → sólo tiempos excepcionales
ADD_TIMES     → tiempos regulares + excepcionales
```

No se deduplica por hora. Para `REPLACE_TIMES` y `ADD_TIMES` debe existir un
patrón excepcional válido por sentido; cero es configuración inválida y más de
uno es `AMBIGUOUS_PATTERN`.

## 10. Temporal Logic

El parser rechaza timestamps y fechas imposibles. El weekday se calcula sin
`Date#getDay()`.

Los stop times se ordenan por `stopOrder`, exigen primer offset cero, offsets
no negativos y no decrecientes; offsets iguales son válidos. Se conserva
`dayOffset`, por ejemplo `23:50 + 30 = 00:20, dayOffset 1`.

`approximateArrivalTime` es metadata; el fin planificado usa
`departureTime + max(offsetMinutes)` cuando existe timetable válido.

## 11. Errors

Se implementaron:

```text
INVALID_DATE
SERVICE_LINE_NOT_FOUND
SERVICE_LINE_INACTIVE
NO_PUBLISHED_CALENDAR
AMBIGUOUS_CALENDAR
INVALID_CALENDAR_CONFIGURATION
AMBIGUOUS_PATTERN
INVALID_EXCEPTION_CONFIGURATION
INVALID_TIMETABLE_RELATION
INVALID_STOP_TIMETABLE
```

`NO_SERVICE` es estado de negocio. Los errores Prisma/PostgreSQL no se
convierten en `NO_SERVICE`.

## 12. Read-only Guarantee

Los paths de runtime del resolver no contienen `create`, `update`, `delete` ni
`upsert`. La integración PostgreSQL contó `ServiceCalendar`,
`SchedulePattern` y `ScheduleTime` antes y después de resolver, sin cambios.

## 13. Tests

La suite unitaria del módulo cubre 22 casos: parsing, weekdays, línea,
calendarios, patrones, excepciones, efectos, colisiones, journeys, stops,
offsets, sorting y medianoche.

## 14. Integration Tests

La integración usa PostgreSQL real y datos sintéticos propios, activada con
`RUN_CALENDAR_INTEGRATION=true`. Verifica el agregado Prisma, el resultado
regular y cero escrituras durante la resolución; limpia sus IDs al terminar.

Resultado explícito: 1 suite, 1 test, PASS.

## 15. Legacy Isolation

El módulo no consulta el modelo `Schedule` y no implementa fallback legacy.
Mobile continúa aislado con su flujo existente.

## 16. OpenAPI

No se creó controller, route ni DTO público. `pnpm test:openapi` pasó y no se
modificó el contrato OpenAPI.

## 17. Mobile

`apps/mobile` no fue modificado por este BUILD.

## 18. Prisma

`apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations` no fueron
modificados. `pnpm prisma validate` pasó y `pnpm prisma migrate status` reportó
cuatro migraciones y base actualizada. No se usó `db push`.

## 19. Remaining Risks

Siguen fuera de esta fase: catálogo oficial, perfiles y colisiones 13/14,
backfill de 90 `Schedule`, materialización, assignments, runs, Driver Auth,
GPS, API pública y switch Mobile.

El entorno local usado es Node `v24.19.0` y pnpm `11.20.0`; CI mantiene como
referencia Node 20 y pnpm 10.34.5.

## 20. Next Step

Solicitar revisión independiente del BUILD y del diff. Si se aprueba, el
siguiente diseño/implementación posible pertenece a 5C y requiere autorización
separada. No se hizo commit, push ni PR.

## Delivery Gate

| Gate | Estado | Evidencia |
|---|---|---|
| Resolver read-only | PASS | Escaneo sin operaciones de escritura |
| Calendar/pattern/exception resolution | PASS | Tests unitarios y código implementado |
| Journey/stop/midnight validation | PASS | Casos unitarios cubiertos |
| Unit tests | PASS | 22/22 módulo calendar |
| Integration tests | PASS | 1/1 PostgreSQL explícito |
| Zero writes | PASS | Conteos antes/después iguales |
| No legacy fallback | PASS | Escaneo exacto sin `prisma.schedule` |
| Prisma/migrations | PASS | validate y migrate status |
| OpenAPI | PASS | `pnpm test:openapi` |
| Mobile untouched | PASS | Sin cambios realizados por esta fase |
| lint | PASS | `pnpm lint` |
| typecheck | PASS | `pnpm typecheck` |
| build | PASS | `pnpm build` |
| Jest global | PASS | 145 passed, 1 integración omitida por flag |

Estado: BUILD COMPLETADO — PENDIENTE DE REVIEW INDEPENDIENTE

## 21. Remediation Update

La remediación posterior al independent build review corrigió el orden
determinista de journeys, amplió la integración PostgreSQL al timetable
completo, completó la evidencia de la matriz contractual y añadió el script y
paso dedicado de CI para ejecutar la integración con
`RUN_CALENDAR_INTEGRATION=true`.

La validación local posterior quedó en:

```text
Calendar unit tests: 37 passed
Calendar integration: 1 suite, 1 test passed
Jest global: 16 suites passed, 160 tests passed, 1 skipped suite/test
lint/typecheck/build: PASS
Prisma validate/migrate status: PASS
OpenAPI: PASS
TZ UTC/Guayaquil/Tokyo: PASS
```

El informe original conserva el estado histórico del BUILD inicial. El estado
actual es `REMEDIATION BUILD COMPLETADO LOCALMENTE — PENDIENTE DE
INDEPENDENT RE-REVIEW`. No se hizo commit, push, PR ni merge; 5C continúa sin
autorización.
