# FASE 5B-A — Calendar & Timetable Schema Foundation

## Verdict

**GO para revisión independiente de Fase 5B-A.** La fundación de calendario y timetable fue construida en modo `EXPAND ONLY`, aplicada mediante una migración Prisma aditiva y verificada sin cargar datos de negocio.

La rama queda lista para auditoría. No se hizo commit, push ni PR.

## Baseline

- Rama: `feature/phase-5b-calendar-schema`
- Baseline certificado: `87857d69f6e7187d0f3076c9f58e8bdb87a1714d`
- Migración: `20260828204322_add_calendar_timetable_foundation`
- Base local verificada: PostgreSQL `krionix`, schema `public`
- Estado de migraciones: `Database schema is up to date!`

El worktree ya contenía cambios históricos de UPS GO y documentación de fases anteriores. Fueron preservados; los únicos cambios de esta fase son el schema Prisma, la migración y este reporte.

## Models Added

Se añadieron exactamente los siete modelos autorizados:

| Modelo | Propósito |
| --- | --- |
| `ServiceCalendar` | Vigencia, zona horaria y publicación de un calendario de una `ServiceLine`. |
| `SchedulePattern` | Patrón explícito por dirección, asociado al calendario y opcionalmente a una excepción. |
| `SchedulePatternDay` | Días de semana normalizados para un patrón. |
| `ScheduleTime` | Hora explícita de salida y llegada aproximada opcional usando `TIME(0)`. |
| `ScheduleJourneyTemplate` | Vincula una hora con un `RoutePath` sin materializar una salida operativa. |
| `ScheduledStopTime` | Offset en minutos de cada parada dentro de una plantilla de viaje. |
| `ServiceException` | Excepción fechada, global o por dirección, con efecto y estado. |

La cadena queda preparada para:

```text
ServiceLine
  -> ServiceCalendar
    -> SchedulePattern
      -> SchedulePatternDay
      -> ScheduleTime
        -> ScheduleJourneyTemplate
          -> ScheduledStopTime
```

No se añadieron `ScheduledDeparture`, `ScheduledDepartureTemplate`, `ServiceAssignment` ni `ServiceRun`.

## Enums

Se añadieron:

- `Weekday`: `MONDAY` a `SUNDAY`.
- `SchedulePatternType`: `EXPLICIT_TIMES`.
- `SchedulePublicationStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- `ServiceExceptionReason`: `HOLIDAY`, `VACATION`, `EXAM_PERIOD`.
- `ServiceExceptionEffect`: `NO_SERVICE`, `REPLACE_TIMES`, `ADD_TIMES`.
- `ServiceExceptionStatus`: `DRAFT`, `PUBLISHED`, `CANCELLED`.

El enum legacy `DayOfWeek` se conserva intacto porque es utilizado por `Schedule`. Los patrones nuevos usan `Weekday`; no se mezclan ambas representaciones en una misma relación ni se cambia el contrato legacy.

## Constraints

- `ServiceCalendar.validFrom <= validUntil` mediante `service_calendars_valid_range_check`.
- `ScheduledStopTime.offsetMinutes >= 0` mediante `scheduled_stop_times_offset_minutes_check`.
- Un día no puede repetirse dentro del mismo patrón: `(schedulePatternId, weekday)`.
- Una hora de salida no puede repetirse dentro del mismo patrón: `(schedulePatternId, departureTime)`.
- Una plantilla no puede repetir la combinación `(scheduleTimeId, routePathId)`.
- Una parada no puede repetirse dentro de una plantilla: `(journeyTemplateId, routePathStopId)`.
- Las nuevas FKs usan `ON DELETE RESTRICT`.
- No se agregó una restricción de solapamiento de calendarios: el workflow de perfiles y publicación aún debe definirse antes de convertirlo en una invariante física.

Se mantiene una sola fuente temporal para cada concepto: `ScheduleTime.departureTime` y `ScheduleTime.approximateArrivalTime`. No se añadió `plannedTime` absoluto.

## Partial Indexes

Las excepciones activas admiten historial `CANCELLED`, pero limitan a una excepción activa por alcance:

- `service_exceptions_active_global_uq`: un registro global por `(serviceCalendarId, serviceDate)` cuando `direction IS NULL` y el estado es `DRAFT` o `PUBLISHED`.
- `service_exceptions_active_direction_uq`: un registro por `(serviceCalendarId, serviceDate, direction)` cuando existe dirección y el estado es `DRAFT` o `PUBLISHED`.

La regla de prioridad de una excepción publicada sobre el calendario regular queda para la capa de dominio/materialización posterior; esta fase no crea resolvers ni servicios.

## Migration

Flujo ejecutado:

1. `pnpm prisma migrate dev --name add_calendar_timetable_foundation --create-only --skip-generate`
2. Auditoría manual del SQL generado.
3. Inclusión de los dos `CHECK` y dos índices únicos parciales.
4. `pnpm prisma migrate deploy`

No se usó `db push`. No hubo seed, fixture import, backfill ni carga de catálogo.

## Destructive SQL Audit

Resultado del gate destructivo: **PASS — no se detectó SQL destructivo**.

La migración solo contiene `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT` y `ALTER TABLE ... ADD FOREIGN KEY` para las entidades nuevas. La auditoría de patrones no encontró `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, renombres ni reemplazos destructivos.

No se alteraron ni eliminaron tablas legacy.

## QA

### New tables empty

Después de aplicar la migración, las siete tablas nuevas quedaron vacías:

```text
service_calendars             0
schedule_patterns             0
schedule_pattern_days         0
schedule_times                0
schedule_journey_templates    0
scheduled_stop_times          0
service_exceptions            0
```

Checks e índices parciales fueron consultados en PostgreSQL y existen con los nombres esperados. No existen tablas de Fase 5C.

### Legacy preservation

Conteos antes y después de la migración:

```text
routes              7
stops              14
schedules           90
vehicles             5
drivers              5
route_assignments    4
trips                1
trip_feedbacks      15
```

Los valores permanecieron iguales.

## Prisma

- `pnpm prisma format`: PASS antes de la comprobación final del schema.
- `pnpm prisma validate`: PASS.
- `pnpm prisma generate`: PASS, Prisma Client `6.19.3`.
- `pnpm prisma migrate status`: PASS.
- `pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: PASS, `No difference detected.`

El entorno local usado reporta Node `v24.19.0` y pnpm `11.20.0`. El baseline de CI documentado es Node 20 + pnpm `10.34.5`; esa diferencia queda registrada y debe mantenerse alineada antes de una validación de release.

## Backend

No se modificaron módulos, controladores, servicios, DTOs, contratos ni lógica de `apps/api`. El único cambio backend autorizado es la ampliación de `apps/api/prisma/schema.prisma` y su migración.

## Tests

- Lint: PASS.
- Typecheck: PASS.
- Build: PASS.
- Jest: PASS — 14 suites, 123 tests.
- OpenAPI contract checks: PASS.

Los logs de SMTP observados pertenecen a casos mockeados de las pruebas de correo; el proceso terminó correctamente.

## OpenAPI

No hubo cambios de contrato ni de generación OpenAPI. Las comprobaciones de contrato pasaron.

## Mobile

`apps/mobile` no fue modificado por esta fase. No se añadieron pantallas, llamadas de API, navegación ni cambios de identidad visual.

## Remaining Blockers

Estos puntos permanecen fuera de Fase 5B-A y no deben resolverse agregando datos en esta migración:

- Definir perfiles/calendarios oficiales y resolver la política de solapamiento entre calendarios publicados.
- Definir y validar la compatibilidad semántica entre `ScheduleJourneyTemplate.routePathId`, `RoutePathStop` y la dirección de la línea en la capa de dominio.
- Diseñar el materializador de `ScheduledDeparture` para Fase 5C.
- Definir asignación operativa, `ServiceRun`, Driver Auth y GPS en fases posteriores.
- Diseñar backfill de los 90 `Schedule` legacy con revisión y ejecución separadas.
- Alinear desarrollo local con Node 20 + pnpm 10.34.5 para reproducir exactamente el entorno de CI.

## Next Step

Solicitar revisión independiente de Fase 5B-A sobre esta rama. Si la revisión da GO, la siguiente fase autorizable es la evolución posterior del dominio, manteniendo separadas la programación publicada y la operación real.
