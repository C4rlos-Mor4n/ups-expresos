# Modelo de dominio

Fuente de verdad: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)
(22 modelos, 14 enums, 11 migraciones). Todos los identificadores son UUID.

```text
Campus
  └── ServiceLine ──── ServiceLineCampus (campus atendidos)
        ├── RoutePath ── RoutePathStop ── Stop
        └── ServiceCalendar            (DRAFT → PUBLISHED → ARCHIVED)
              └── SchedulePattern      (dirección + días, tipo EXPLICIT_TIMES)
                    ├── SchedulePatternDay
                    └── ScheduleTime               (hora civil recurrente)
                          └── ScheduleJourneyTemplate  (1..N recorridos por hora)
                                └── ScheduledStopTime  (offsetMinutes por parada)

ScheduleTime ──► ScheduledDeparture (salida concreta por fecha)
                    └── ServiceAssignment (0..N: bus + conductor + recorrido)
                          └── ServiceRun  (0..1: ejecución real)

Soporte: User, Session, AuthVerificationCode, AuditLog, Vehicle, Driver, ServiceException
```

## Transporte (referencia)

- **Campus**: sede UPS (`code`, `name`, dirección, coordenadas, `isActive`).
- **ServiceLine**: línea lógica visible al usuario (`NORTE`, `SUR`, `URB_LA_JOYA`). Tipo `CAMPUS_ROUTE` o `INTERCAMPUS`.
  `ServiceLine.campusId` es el **campus propietario administrativo**; los campus que la línea
  **atiende** están en `ServiceLineCampus`. No se deben confundir.
- **RoutePath**: camino físico predefinido por el Admin, con dirección (`IDA`/`RETORNO`). El conductor nunca crea recorridos.
- **RoutePathStop**: parada dentro de un recorrido; `stopOrder` es la fuente de verdad del orden.
- **Stop**: parada reutilizable (nombre, referencia, coordenadas, `isActive`).

IDA y RETORNO pueden tener recorridos, paradas, offsets y horas distintos. Nunca se deriva uno del otro.

## Horarios

- **ServiceCalendar**: vigencia (`validFrom`/`validUntil`), zona horaria y estado `DRAFT | PUBLISHED | ARCHIVED`.
- **SchedulePattern / SchedulePatternDay**: dirección y días de la semana (enum `Weekday`).
- **ScheduleTime**: hora civil de salida (no es un instante UTC).
- **ScheduleJourneyTemplate**: asocia una hora con un recorrido. Una misma hora puede tener varios.
- **ScheduledStopTime**: `offsetMinutes` de cada parada. La hora visible es `ScheduleTime + offsetMinutes`.
  Reglas: offset ≥ 0, primera parada en 0, no decreciente según `stopOrder`, la parada debe pertenecer al recorrido,
  sin duplicados, cobertura completa del recorrido para publicar. **Nunca** se estima por distancia, GPS o velocidad.
- **ServiceException**: `NO_SERVICE | REPLACE_TIMES | ADD_TIMES` (razones: feriado, vacaciones, exámenes…),
  estados `DRAFT | PUBLISHED | CANCELLED`.

### Puerta de publicación

Un calendario en `DRAFT` puede estar incompleto; uno `PUBLISHED` no. Publicar rechaza horas sin recorrido válido,
recorridos de otra línea o dirección, paradas ajenas o duplicadas, cobertura incompleta y offsets inválidos
(código `SCHEDULE_CONFIGURATION_INCOMPLETE`, con la lista de problemas).

### CalendarResolver y materializador

`CalendarResolver` calcula qué se opera una fecha (calendario publicado + días + excepciones).
`ScheduledDepartureMaterializer` persiste el resultado como `ScheduledDeparture` para un rango de fechas:

- Idempotente: identidad natural `sourceScheduleTimeId + serviceDate`. Repetir un rango no duplica.
- Fuente de cada salida: `REGULAR | EXCEPTION_REPLACE | EXCEPTION_ADD`.
- Si una salida ya materializada difiere de la resuelta, no se sobrescribe en silencio.

Hoy se materializa con `POST /admin/schedules/materialization` o con los seeds. No hay trabajo programado automático.

## Operación

- **Vehicle** (`code`, `plate`, `capacity`, `status`) y **Driver** (`name`, `phone`, `licenseNumber`, `status`, `userId` único opcional).
  Se desactivan, no se borran.
- **ServiceAssignment**: bus + conductor + recorrido para una salida; ventana `plannedStartAt`/`plannedEndAt`;
  estado `ASSIGNED | CANCELLED`. Una salida admite **0..N** asignaciones (multibus).
- **ServiceRun**: ejecución real (`IN_PROGRESS | COMPLETED`), una por asignación. Lo inicia el conductor explícitamente.
- **Conflictos**: PostgreSQL impide solapes con constraints de exclusión (`btree_gist`) por vehículo y por conductor
  sobre ventanas `[inicio, fin)` de asignaciones `ASSIGNED`; un traspaso exacto es válido. La UI puede prevenir, pero la
  base de datos es la defensa final.

### Estado agregado de una salida

Lo calcula el backend (no se persiste):

```text
sin asignaciones                  → SCHEDULED
alguna IN_PROGRESS                → IN_PROGRESS
alguna ASSIGNED sin completar     → ASSIGNED
todas completadas                 → COMPLETED
```

## Autenticación y auditoría

- **User**: `email` único, `role` (`STUDENT | DRIVER | ADMIN | SUPER_ADMIN`), `isActive`, `emailVerified`.
- **AuthVerificationCode**: un OTP por correo (hash, intentos, expiración, `usedAt`).
- **Session**: refresh token hasheado, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`.
- **AuditLog**: acciones administrativas (escritura *best-effort*: no revierte la operación si falla).
- Los dominios permitidos de registro **no** están en base de datos: son la variable `ALLOWED_EMAIL_DOMAINS`.

## Datos de referencia

[`docs/ups_go_routes_reference_guayaquil.json`](../ups_go_routes_reference_guayaquil.json): 2 campus
(María Auxiliadora y Centenario), 3 líneas, 4 relaciones campus-línea, 7 recorridos, 14 paradas, 3 calendarios,
12 patrones, 53 horas, 349 tiempos de parada. Sirve para desarrollo, QA y demos. Las coordenadas de varias paradas son
aproximadas. Los buses, placas y conductores del showcase son sintéticos, no flota oficial.

## Migraciones

No se editan, renombran ni fusionan las migraciones históricas. Un cambio de esquema exige: migración nueva,
prueba desde cero y prueba de actualización sobre datos existentes (ver [`conventions.md`](./conventions.md)).
