# UPS GO — Fase 5B: Calendar & Schedule Domain Design

**Fecha:** 2026-08-28
**Modo:** diseño de dominio y preparación de implementación
**Estado:** `GO DESIGN` / `NO-GO IMPLEMENTATION`

> **DESIGN ONLY — NOT IMPLEMENTED**

Este documento define cómo UPS GO debe representar la programación del servicio
después de la foundation de Fase 5A. No modifica `apps/api`, `apps/mobile`,
Prisma, migraciones, contratos API, datos, seed ni `apps/web`.

## 1. Alcance y autoridad

La propuesta se apoya en:

- `docs/PHASE_4_PRODUCT_DOMAIN_UX_BLUEPRINT.md`;
- `docs/PHASE_4_1_BUSINESS_RULES_DECISION_PACK.md`;
- `docs/PHASE_5_1_CAMPUS_ROUTEPATH_DOMAIN_CORRECTION.md`;
- `docs/PHASE_5A_SCHEMA_FOUNDATION_REPORT.md` y su review;
- el schema actual de `apps/api/prisma/schema.prisma`.

La corrección 5.1 es obligatoria para esta fase:

```text
Campus
  └── ServiceLine
        ├── RoutePath[]
        └── ServiceCalendar[]
              └── SchedulePattern[]
                    └── ScheduleTime[]
```

`RoutePath` no pertenece al calendario ni al horario. Un camino físico se
seleccionará posteriormente en `ServiceAssignment` y quedará congelado en
`ServiceRun`. La programación responde cuándo existe el servicio; la
operación responde qué bus lo ejecuta y por dónde.

## 2. Resultado ejecutivo

El dominio de programación debe separar cinco preguntas:

| Pregunta | Entidad o regla |
|---|---|
| ¿Qué línea se programa? | `ServiceLine`, propiedad de `Campus` |
| ¿En qué fechas puede existir? | `ServiceCalendar.validFrom/validUntil` |
| ¿Qué días de la semana aplica? | `SchedulePatternDay` |
| ¿A qué horas sale? | `ScheduleTime` con hora local explícita |
| ¿Qué cambia una fecha concreta? | `ServiceException` |

El futuro flujo de lectura será:

```text
Campus
  ↓
ServiceLine
  ↓
ServiceCalendar vigente
  ↓
SchedulePattern por IDA/RETORNO
  ↓
ScheduleTime explícito
  ↓
ServiceException aplicada, si existe
  ↓
ScheduledDeparture materializada posteriormente
```

La regla principal es:

```text
effectiveSchedule(serviceLine, serviceDate, direction)
  = exception(date, direction)
    si existe una excepción aplicable
  = regular calendar + pattern + times
    si no existe excepción
```

La existencia de una salida programada nunca significa que exista un bus en
recorrido. `IN_PROGRESS` seguirá siendo exclusivo de `ServiceRun` iniciado por
el mecanismo operativo autorizado.

## 3. Hechos actuales y gaps que resuelve 5B

### 3.1 Estado actual

El modelo legacy contiene:

```text
Schedule
  routeId
  dayOfWeek
  direction: String
  departureTime: String
  approximateArrivalTime: String?
  status
```

La auditoría previa registró 90 filas `Schedule`, siete `Route` y horarios
semanales principalmente de lunes a viernes. La fila legacy no contiene:

- una fecha de inicio o fin de vigencia;
- una zona horaria explícita;
- una excepción de feriado, vacaciones o exámenes;
- una entidad de patrón reusable;
- una salida concreta para una fecha;
- un vínculo con un bus que realmente inició recorrido.

### 3.2 Gaps de Fase 5B

1. El mismo string de dirección puede tener significados diferentes y no
   existe un `Direction` canónico en `Schedule`.
2. La ausencia de una fila legacy no demuestra que un día sea feriado o que no
   haya servicio.
3. Una semana lectiva no puede extrapolarse a todo el año sin un período
   autorizado.
4. Las vacaciones pueden interrumpir una vigencia regular sin cambiar el
   horario base.
5. Un período de exámenes puede mantener servicio con horas diferentes, no
   necesariamente eliminarlo.
6. Ida y Retorno pueden tener listas de horas diferentes.
7. Un viernes puede tener tiempos distintos a los del lunes sin recurrir a
   columnas como `mondayTime1` o `fridayTime2`.
8. Aún no existe `ScheduledDeparture`; por eso 5B debe definir su fuente y
   materialización futura sin crearla ahora.
9. La ruta física no puede usarse como sustituto de una regla de calendario.

## 4. Decisiones de diseño

### 4.1 Calendario ligado a línea

En este MVP, `ServiceCalendar` pertenece a una `ServiceLine`.

Motivos:

- hace determinista la resolución pública de una fecha;
- permite que Norte, Sur y La Joya tengan vigencias independientes;
- evita que una excepción de una línea afecte accidentalmente a otra;
- mantiene la navegación `Campus → ServiceLine → programación`;
- permite publicar o archivar la programación de una línea sin tocar el resto.

Un feriado institucional que afecte a muchas líneas se aplicará mediante una
operación administrativa transaccional a los calendarios afectados. No se
introduce todavía un calendario global con herencia implícita, porque ocultaría
qué líneas quedaron realmente publicadas.

### 4.2 Vigencia y solapamientos

Un calendario expresa un intervalo cerrado de fechas:

```text
validFrom <= serviceDate <= validUntil
```

Para una misma `ServiceLine`, dos calendarios `PUBLISHED` no deben cubrir la
misma fecha. La implementación futura debe validar esto dentro de la
transacción de publicación y, si el equipo lo aprueba, reforzarlo con una
constraint PostgreSQL de exclusión sobre rangos de fecha.

Los calendarios `DRAFT` pueden solaparse durante edición, pero no pueden
publicarse mientras exista ambigüedad.

### 4.3 Días de semana en patrones

Los días de semana se modelan como relación normalizada
`SchedulePatternDay`, no como columnas de horas y no como JSON.

Esto permite:

- un patrón lunes-viernes con una misma lista de tiempos;
- un patrón separado para viernes si sus horas cambian;
- distintos conjuntos de días para IDA y RETORNO;
- reutilizar una regla sin duplicar cada hora;
- verificar que el patrón sea subconjunto de la vigencia del calendario.

El calendario decide si una fecha está dentro del período. El patrón decide si
el día de semana de esa fecha activa esa lista de horas.

### 4.4 Horas explícitas en el MVP

La primera implementación soportará únicamente `EXPLICIT_TIMES`:

```text
06:40, 08:30, 17:00
```

Cada hora es una fila `ScheduleTime`. No se agregan todavía intervalos,
frecuencias, headway, ventanas de generación ni reglas automáticas de
capacidad. La frecuencia futura puede añadirse como un tipo nuevo sin cambiar
la semántica de las horas explícitas.

### 4.5 Zona horaria

La zona de negocio del calendario es `America/Guayaquil`.

- `serviceDate` es una fecha civil, no medianoche UTC;
- `departureTime` y `approximateArrivalTime` son horas locales;
- `createdAt` y demás eventos operativos futuros son instantes con timestamp;
- la aplicación no debe interpretar una hora local como UTC por defecto;
- si en el futuro se permiten otras zonas, la zona se valida con una lista
  IANA y no se acepta texto arbitrario como regla de negocio.

Ecuador continental no usa cambios estacionales de horario actualmente, pero
se conserva el identificador IANA para que la semántica no dependa de una
abreviatura fija ni de la zona del servidor.

### 4.6 Publicación y archivo

`DRAFT`, `PUBLISHED` y `ARCHIVED` sí están justificados para el calendario y
los patrones porque el negocio necesita editar y previsualizar antes de
exponer una programación al estudiante. No se duplica ese ciclo con un
`isActive` paralelo: `ARCHIVED` es la condición de archivo.

Las horas y días pertenecen a un patrón que debe editarse antes de publicar.
Una corrección de una regla publicada crea una nueva versión lógica o un nuevo
patrón para las fechas futuras; no muta silenciosamente salidas ya operadas.
Las acciones de publicación, archivo y excepción se registrarán mediante el
`AuditLog` existente, sin añadir `createdById`/`updatedById` a cada fila de
programación.

## 5. Modelo conceptual propuesto

### 5.1 Enums

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum SchedulePatternType {
  EXPLICIT_TIMES
}

enum SchedulePublicationStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ServiceExceptionReason {
  HOLIDAY
  VACATION
  EXAM_PERIOD
}

enum ServiceExceptionEffect {
  NO_SERVICE
  REPLACE_TIMES
  ADD_TIMES
}

enum ServiceExceptionStatus {
  DRAFT
  PUBLISHED
  CANCELLED
}
```

`Direction` ya existe en la foundation 5A con `IDA` y `RETORNO`. No se debe
crear otro enum paralelo.

### 5.2 ServiceCalendar

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceCalendar {
  id          String                    @id @default(uuid()) @db.Uuid
  serviceLineId String                  @db.Uuid
  name        String
  validFrom   DateTime                  @db.Date
  validUntil  DateTime                  @db.Date
  timezone    String                    @default("America/Guayaquil")
  status      SchedulePublicationStatus @default(DRAFT)
  createdAt   DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime                  @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine       @relation(fields: [serviceLineId], references: [id])
  patterns    SchedulePattern[]
  exceptions ServiceException[]

  @@index([serviceLineId, validFrom, validUntil, status])
  @@map("service_calendars")
}
```

Invariantes:

- `validFrom` no puede ser posterior a `validUntil`;
- `timezone` debe ser exactamente `America/Guayaquil` en este MVP;
- un calendario `ARCHIVED` no se usa para resolver servicio público;
- una excepción debe estar dentro de la vigencia de su calendario;
- publicar requiere que la línea exista y esté activa;
- publicar requiere al menos un patrón válido para cada sentido que la línea
  declare como operativo;
- no se crean calendarios oficiales con nombres o fechas inventados.

### 5.3 SchedulePattern

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model SchedulePattern {
  id                String                    @id @default(uuid()) @db.Uuid
  serviceCalendarId String                    @db.Uuid
  direction         Direction
  type              SchedulePatternType      @default(EXPLICIT_TIMES)
  status            SchedulePublicationStatus @default(DRAFT)
  name              String?
  exceptionId       String?                   @db.Uuid
  createdAt         DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime                  @updatedAt @db.Timestamptz(3)

  serviceCalendar ServiceCalendar     @relation(fields: [serviceCalendarId], references: [id])
  exception       ServiceException?   @relation(fields: [exceptionId], references: [id])
  days            SchedulePatternDay[]
  times           ScheduleTime[]

  @@index([serviceCalendarId, direction, status])
  @@index([exceptionId, direction])
  @@map("schedule_patterns")
}
```

Semántica de `exceptionId`:

- `NULL`: patrón regular reutilizable según días de semana;
- valor: patrón exclusivo de una `ServiceException` publicada;
- un patrón de excepción no participa en semanas regulares;
- un patrón de excepción no lleva `RoutePath`;
- `REPLACE_TIMES` puede tener un patrón para IDA y otro para RETORNO;
- `ADD_TIMES` agrega horas excepcionales a las horas regulares.

La base futura debe reforzar que `exceptionId` pertenezca al mismo calendario
del patrón y que no existan dos patrones de excepción publicados para la misma
excepción y dirección.

### 5.4 SchedulePatternDay

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model SchedulePatternDay {
  id               String    @id @default(uuid()) @db.Uuid
  schedulePatternId String   @db.Uuid
  dayOfWeek        DayOfWeek

  pattern SchedulePattern @relation(fields: [schedulePatternId], references: [id])

  @@unique([schedulePatternId, dayOfWeek])
  @@map("schedule_pattern_days")
}
```

Ejemplo de horarios variables:

```text
Calendario académico 2026-2
├── Pattern IDA · lunes-jueves → 06:40, 08:30, 17:00
└── Pattern IDA · viernes       → 06:40, 12:30
```

El patrón de viernes no crea una nueva línea ni un nuevo camino físico.

### 5.5 ScheduleTime

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ScheduleTime {
  id                    String   @id @default(uuid()) @db.Uuid
  schedulePatternId     String   @db.Uuid
  departureTime         DateTime @db.Time(0)
  approximateArrivalTime DateTime? @db.Time(0)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)

  pattern SchedulePattern @relation(fields: [schedulePatternId], references: [id])

  @@unique([schedulePatternId, departureTime])
  @@map("schedule_times")
}
```

Reglas:

- `departureTime` se almacena como `TIME`, no como string libre;
- se devuelve como `HH:mm` en el contrato futuro;
- `approximateArrivalTime` es opcional y también local;
- la llegada aproximada no sustituye una ruta ni un ETA GPS;
- dos horas iguales dentro del mismo patrón son inválidas;
- cambiar una hora publicada requiere versionar/publicar una nueva regla o
  reconciliar únicamente salidas futuras todavía no operadas.

### 5.6 ServiceException

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceException {
  id                String                  @id @default(uuid()) @db.Uuid
  serviceCalendarId String                  @db.Uuid
  serviceDate       DateTime                @db.Date
  direction         Direction?
  reason            ServiceExceptionReason
  effect            ServiceExceptionEffect
  status            ServiceExceptionStatus  @default(DRAFT)
  description       String
  createdAt         DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime                @updatedAt @db.Timestamptz(3)

  serviceCalendar    ServiceCalendar   @relation(fields: [serviceCalendarId], references: [id])
  replacementPatterns SchedulePattern[]

  @@index([serviceCalendarId, serviceDate, status, direction])
  @@index([serviceDate, reason, effect, status])
  @@map("service_exceptions")
}
```

`direction = NULL` significa ambos sentidos. Una dirección concreta limita la
excepción a `IDA` o `RETORNO`.

La unicidad efectiva futura debe ser:

```text
un solo exception global por (calendar, date)
como máximo una exception por (calendar, date, direction)
```

Como PostgreSQL trata varios `NULL` como valores distintos en un índice único,
la implementación deberá usar índices parciales SQL controlados o una tabla de
alcance explícito. Prisma por sí solo no debe ocultar esa regla.

## 6. Excepciones: feriados, vacaciones y exámenes

### 6.1 Feriado

```text
reason = HOLIDAY
effect = NO_SERVICE
```

La fecha se registra explícitamente. No se deduce por calendario nacional
externo ni por la ausencia de horarios.

Si UPS decide operar con horario reducido:

```text
reason = HOLIDAY
effect = REPLACE_TIMES
replacement pattern(s) = horas autorizadas
```

### 6.2 Vacaciones

Las vacaciones suelen ser un período, pero la resolución pública debe ser
determinista por fecha. En este MVP, el comando administrativo futuro recibirá
un intervalo y generará una excepción diaria idempotente:

```text
2026-08-10 ... 2026-08-23
  → una ServiceException NO_SERVICE por cada fecha aplicable
```

No se agrega todavía una entidad de períodos de vacaciones, porque sería una
capa de autoría que no es necesaria para resolver el servicio y duplicaría la
semántica de vigencia. El origen del lote, actor, intervalo y motivo quedará
registrado en `AuditLog`.

Si una fecha de vacaciones sí tiene servicio especial, la excepción de esa
fecha se publica como `REPLACE_TIMES` y gana sobre el blackout general.

### 6.3 Semana o período de exámenes

Un examen no implica automáticamente `NO_SERVICE`. Se deben distinguir los
efectos:

```text
EXAM_PERIOD + NO_SERVICE       → no hay salida
EXAM_PERIOD + REPLACE_TIMES    → solo horas especiales
EXAM_PERIOD + ADD_TIMES        → horario regular más refuerzos autorizados
```

Para un intervalo de exámenes, se generan excepciones diarias únicamente para
las fechas que difieren del horario regular. Si el período de exámenes conserva
exactamente el horario regular, no se crean excepciones redundantes.

### 6.4 Eventos y suspensiones

Los eventos institucionales, clima, mantenimiento y otras incidencias
operativas no se convierten en razones obligatorias de `ServiceException` en el
MVP. Si alteran una salida ya materializada, pertenecen posteriormente al
estado o a la incidencia de `ScheduledDeparture` y no deben reescribir la regla
histórica del calendario.

Si un evento académico aprobado cambia el horario de una fecha, se expresa con
`EXAM_PERIOD` solo cuando corresponda a ese concepto; de lo contrario requiere
una nueva razón aprobada antes de ampliar el enum.

## 7. Precedencia y algoritmo de resolución

### 7.1 Orden de evaluación

Para una solicitud `(serviceLineId, serviceDate, direction)`:

1. Validar `serviceDate` como fecha ISO `YYYY-MM-DD`.
2. Obtener el calendario `PUBLISHED`, activo y vigente de la línea.
3. Resolver el día de semana desde la fecha civil, no desde UTC del servidor.
4. Buscar la excepción publicada de la fecha:
   - primero la específica de `direction`;
   - luego la global (`direction = NULL`).
5. Si existe excepción específica y global, gana la específica; no se mezclan
   efectos silenciosamente.
6. Aplicar su efecto:
   - `NO_SERVICE`: devolver oferta vacía con motivo;
   - `REPLACE_TIMES`: usar solo patrones de excepción;
   - `ADD_TIMES`: unir horas regulares y excepcionales, deduplicando por hora.
7. Si no existe excepción aplicable, buscar patrones regulares publicados de
   la dirección cuyo `SchedulePatternDay` incluya el día.
8. Ordenar por hora y devolver el origen de la regla para trazabilidad.

### 7.2 Precedencia formal

```text
direction-specific exception
        > global exception
        > regular pattern
        > no service
```

El último `no service` no es un default arbitrario: significa que no existe un
calendario/patrón publicado aplicable o que una excepción publicada lo indicó.
La API futura debe distinguir ambos motivos para no confundir “no configurado”
con “feriado”.

### 7.3 Conflictos que deben rechazarse

- dos calendarios publicados que cubren la misma fecha de una línea;
- dos excepciones publicadas del mismo alcance para una fecha;
- dos patrones regulares ambiguos para los mismos días, dirección y calendario
  cuando sus horas no tienen una regla de combinación explícita;
- una excepción `REPLACE_TIMES` sin tiempos de reemplazo;
- un patrón de excepción fuera de la excepción que lo contiene;
- un `ScheduleTime` con formato no representable como `TIME`;
- una publicación que deja una línea activa sin programación válida.

## 8. Ejemplos de negocio

### 8.1 Semana regular

```text
Campus Centenario
└── Ruta Norte
    └── Calendario académico 2026-2
        └── Pattern IDA · lunes-viernes
            ├── 06:40
            ├── 08:30
            └── 17:00
```

La salida es programable en cada lunes-viernes dentro de la vigencia. Todavía
no hay bus, conductor ni `ServiceRun` por el mero hecho de existir esta regla.

### 8.2 Retorno distinto

```text
Ruta Norte
├── IDA     · lunes-viernes → 06:40, 08:30, 17:00
└── RETORNO · lunes-jueves → 12:00, 16:30
              viernes      → 11:30, 15:00
```

Se usan patrones y tiempos separados. No se invierten automáticamente las
paradas ni se asume que Ida y Retorno sean simétricos.

### 8.3 Feriado

```text
Calendario regular: lunes-viernes
Excepción 2026-10-09:
  reason = HOLIDAY
  effect = NO_SERVICE
```

Resultado: para esa fecha no se ofrecen 06:40, 08:30 ni 17:00, aunque la fecha
sea viernes.

### 8.4 Exámenes con horario especial

```text
Calendario regular: lunes-viernes → 06:40, 08:30, 17:00
Excepción 2026-11-16:
  reason = EXAM_PERIOD
  effect = REPLACE_TIMES
  IDA → 07:10, 09:00
  RETORNO → 13:00
```

La excepción reemplaza únicamente esa fecha; no modifica el patrón regular ni
las salidas históricas de otros días.

### 8.5 Varios buses

La programación crea una salida lógica por fecha, sentido y hora. Más tarde:

```text
ScheduledDeparture 2026-09-05 / NORTE / IDA / 06:40
├── Assignment A → BUS-001 → JourneyTemplate A → RoutePath Garzota → Run IN_PROGRESS
├── Assignment B → BUS-002 → JourneyTemplate B → RoutePath Samanes → Run NOT_STARTED
└── Assignment C → BUS-003 → JourneyTemplate C → RoutePath Sauces  → Run IN_PROGRESS
```

No se crean tres `ScheduleTime`, tres líneas ni tres salidas idénticas.

## 9. Preparación de ScheduledDeparture

`ScheduledDeparture` se implementará después de cerrar el diseño de calendario
y patrones. En 5B solo se define su contrato conceptual.

### 9.1 Responsabilidad

Es una instancia concreta de oferta para una fecha:

```text
serviceLine = NORTE
direction = IDA
serviceDate = 2026-09-05
scheduledTime = 06:40
```

No contiene un `RoutePath` único, conductor ni vehículo. Una futura
`ServiceAssignment` podrá seleccionar un `ScheduleJourneyTemplate`, que a su
vez conserva el `RoutePath` y los tiempos planificados por parada.

### 9.2 Identidad e idempotencia

La clave natural recomendada es:

```text
(serviceLineId, direction, serviceDate, scheduledTime)
```

El patrón que produjo la salida y la excepción aplicada se conservan como
proveniencia. Si dos reglas producen la misma hora efectiva, se materializa una
sola fila de salida, pero no se descartan automáticamente sus templates: una
relación futura tipo `ScheduledDepartureTemplate` debe conservar las tablas
aplicables y reportar cualquier conflicto de perfil o de camino.

### 9.3 Ventana de materialización

La materialización futura debe ser explícita y configurable, por ejemplo:

```text
generate(serviceDateFrom, serviceDateUntil)
```

No se debe generar indefinidamente hasta el final del año sin autorización. El
proceso debe:

- consultar el resolver canónico;
- crear solo fechas y horas publicables;
- ser idempotente;
- reportar creadas, existentes, omitidas y ambiguas;
- no borrar una salida que ya tenga assignment, run, incidencia o auditoría;
- reconciliar únicamente salidas futuras en estado editable;
- registrar la versión/origen de la regla que la generó.

### 9.4 Cambios posteriores

Una modificación de horario no reescribe silenciosamente la historia:

```text
regla publicada nueva
  → reconciliar salidas futuras PLANNED
  → conservar salidas operadas/canceladas como histórico
```

El cambio de hora no cambia el `RoutePath` y el cambio de bus no cambia el
calendario.

## 9A. Published Timetable / Scheduled Stop Times

La Fase 5B define cuándo existe una salida. La evidencia de referencia de
Guayaquil demuestra que todavía falta definir cómo se publica el recorrido
planificado de esa salida: camino exacto y hora esperada en cada parada.

La corrección de diseño está documentada de forma independiente en
`docs/PHASE_5B_1_PUBLISHED_TIMETABLE_DOMAIN_CORRECTION.md`. Su decisión
normativa es:

```text
ServiceCalendar
  → SchedulePattern
      → ScheduleTime
          → ScheduleJourneyTemplate[]
              → RoutePath
              → ScheduledStopTime[]
                  → RoutePathStop
```

### 9A.1 Alcance y separación

- `ScheduleTime` responde únicamente: «¿a qué hora parte esta salida
  programada?».
- `ScheduleJourneyTemplate` responde: «¿por qué `RoutePath` y con qué tabla
  planificada de paradas se ofrece esta salida?».
- `ScheduledStopTime` es un tiempo publicado/planificado, nunca un ETA GPS ni
  un tiempo observado.
- `RoutePathStop` conserva la secuencia y la pertenencia de una parada al
  camino; no recibe horarios.
- Una salida puede tener más de una plantilla. Esto permite varios buses o
  varios caminos publicados para la misma hora sin duplicar el
  `ScheduleTime`.
- Una salida que exista en el calendario no implica que exista un bus activo.
  `ScheduledDeparture`, `ServiceAssignment` y `ServiceRun` siguen siendo
  fases posteriores.

### 9A.2 Decisión de almacenamiento temporal

El valor canónico de `ScheduledStopTime` será `offsetMinutes` respecto de la
salida de su `ScheduleTime`, no un segundo reloj absoluto repetido en cada
fila. La hora visible se calcula en la zona del calendario:

```text
plannedStopDateTime = serviceDate + ScheduleTime.departureTime + offsetMinutes
```

La decisión se debe a que el dataset de referencia contiene offsets diferentes
para distintas salidas de la misma línea y camino. Un tiempo absoluto también
sería representable, pero duplicaría la hora de partida y aumentaría el riesgo
de divergencia; además, el offset hace explícito el cruce de medianoche
mediante un valor mayor a 24 horas si el negocio lo necesitara.

La importación futura puede recibir horas absolutas del material de origen,
validarlas y convertirlas a offsets. No se deben redondear ni inferir tiempos
faltantes. Si el origen no permite una conversión inequívoca, queda en
revisión.

### 9A.3 Modelo conceptual adicional

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ScheduleJourneyTemplate {
  id             String   @id @default(uuid()) @db.Uuid
  scheduleTimeId String   @db.Uuid
  routePathId    String   @db.Uuid
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  scheduleTime ScheduleTime             @relation(fields: [scheduleTimeId], references: [id])
  routePath    RoutePath                 @relation(fields: [routePathId], references: [id])
  stopTimes    ScheduledStopTime[]

  @@unique([scheduleTimeId, routePathId])
  @@index([routePathId])
  @@map("schedule_journey_templates")
}

model ScheduledStopTime {
  id                    String   @id @default(uuid()) @db.Uuid
  journeyTemplateId     String   @db.Uuid
  routePathStopId       String   @db.Uuid
  offsetMinutes         Int
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)

  journeyTemplate ScheduleJourneyTemplate @relation(fields: [journeyTemplateId], references: [id])
  routePathStop   RoutePathStop           @relation(fields: [routePathStopId], references: [id])

  @@unique([journeyTemplateId, routePathStopId])
  @@index([journeyTemplateId, offsetMinutes])
  @@map("scheduled_stop_times")
}
```

La implementación deberá reforzar, mediante validación de servicio y las
restricciones SQL que Prisma no exprese, que:

1. el `ScheduleJourneyTemplate` y su `ScheduleTime` pertenecen a la misma
   `ServiceLine` y `Direction` a través de sus padres;
2. el `RoutePath` pertenece a esa misma línea y dirección;
3. cada `RoutePathStop` pertenece al `RoutePath` del template;
4. existe exactamente una fila por `RoutePathStop` del camino publicado;
5. el primer `offsetMinutes` es `0`, todos son no negativos y respetan el
   orden de `RoutePathStop.stopOrder`;
6. no se publican templates incompletos ni se usa una bandera para omitir
   paradas: un ramal diferente es otro `RoutePath`;
7. la tabla no contiene estado de bus, posición, ETA observado ni conductor.

La relación futura con operación será:

```text
ScheduleJourneyTemplate
  → ScheduledDeparture (materializa la fecha y hora)
      → ServiceAssignment
          → ScheduleJourneyTemplate
              → RoutePath
          → ServiceRun
```

`ServiceAssignment` debe apuntar al template cuando la asignación deba
preservar la tabla exacta de paradas. El `RoutePath` se obtiene del template;
mantener ambos IDs en la misma fila solo sería aceptable si una restricción
futura garantiza que nunca divergen.

## 10. Compatibilidad absoluta con los 90 Schedule legacy

### 10.1 Regla de preservación

Durante y después de la implementación futura:

- la tabla `Schedule` no se elimina, renombra ni vacía;
- sus 90 filas conservan sus IDs y payload legacy;
- `/mobile/routes/:id/schedules` mantiene su contrato actual mientras existan
  consumidores;
- `direction` legacy sigue siendo string en la superficie legacy;
- los nuevos enums y tablas no se filtran silenciosamente al DTO antiguo;
- los servicios actuales continúan leyendo legacy hasta que exista dual read
  verificado.

### 10.2 Conversión conceptual

Una vez aprobado el mapping de ruta:

```text
Legacy Route
  → Campus + ServiceLine + RoutePath aprobados

Legacy Schedule
  → SchedulePattern regular
      → SchedulePatternDay
      → ScheduleTime
```

La conversión no puede producir `ScheduledDeparture` únicamente desde una fila
legacy, porque `Schedule` no contiene fechas de vigencia. Se necesita primero
un `ServiceCalendar` con fechas oficiales.

### 10.3 Normalización de dirección

La migración futura debe aceptar solo mappings explícitos, por ejemplo:

```text
"IDA"       → IDA
"RETORNO"   → RETORNO
```

Valores como `Norte`, `Centro`, `Vuelta` o variantes desconocidas se marcan
`needs_review`. No se convierten por proximidad, nombre de ruta ni posición en
la lista.

### 10.4 Agrupación segura de horarios

Se puede agrupar filas legacy en un patrón solo si coinciden, con evidencia
aprobada, en:

```text
serviceLine + calendar + direction + conjunto de días + conjunto de horas
```

Si dos filas tienen horas diferentes, se mantienen como patrones separados o
se detiene el backfill para revisión. La optimización de menos filas nunca
debe perder la trazabilidad del `legacyScheduleId`.

Se recomienda que la futura capa de compatibilidad conserve un registro
explícito por fila origen —tabla de binding o artefacto de mapping versionado—
con estado `UNMAPPED`, `PROPOSED`, `APPROVED` o `REJECTED`. Ese registro no se
crea en esta fase.

### 10.5 Lectura dual

La secuencia segura será:

1. legacy sigue siendo la lectura pública;
2. resolver canónico corre en shadow read con datos aprobados;
3. se comparan fechas, días, dirección y horas;
4. las diferencias se reportan sin cambiar al estudiante;
5. una cohorte controlada puede usar lectura nueva;
6. el mapper conserva la forma legacy si el endpoint aún es legacy.

Si un registro no tiene mapping aprobado, el resolver canónico no inventa una
respuesta. La lectura legacy continúa siendo la fuente para ese registro.

## 11. Estrategia de backfill — diseño, no ejecución

### 11.1 Prerrequisitos

No se autoriza backfill hasta contar con:

1. mapping aprobado de las siete rutas legacy a `Campus`, `ServiceLine` y
   `RoutePath`;
2. nombres y códigos oficiales de las líneas;
3. catálogo de paradas validado;
4. normalización aprobada de `IDA` y `RETORNO`;
5. fecha inicial y final de cada calendario;
6. lista oficial de feriados, vacaciones y exámenes;
7. decisión sobre excepciones globales o por dirección;
8. confirmación de que las horas legacy están en hora local de Guayaquil;
9. política para horarios inválidos, duplicados o ambiguos;
10. ventana inicial de materialización de departures.

### 11.2 Dry run obligatorio

Antes de escribir datos, el proceso futuro debe producir un reporte con:

```text
legacy schedules leídos
routes sin mapping
direcciones normalizadas
horas inválidas
calendarios propuestos
patterns propuestos
pattern days propuestos
schedule times propuestos
excepciones propuestas
filas ambiguas
filas omitidas
```

El dry run no debe crear calendarios, patterns ni salidas.

### 11.3 Orden de expansión

```text
1. tablas/enums nuevas aditivas
2. calendarios oficiales
3. patrones y días de semana
4. tiempos explícitos
5. excepciones aprobadas
6. scheduled departures por ventana
7. bindings legacy y reporte
8. shadow read
```

Un fallo de mapping debe detener el lote afectado, no asignar una línea por
intuición y continuar.

### 11.4 Idempotencia y rollback

El backfill futuro debe:

- usar claves naturales y constraints únicas;
- poder repetirse sin duplicar horarios ni salidas;
- ejecutarse por línea/calendario en transacciones acotadas;
- no modificar ni borrar las filas legacy;
- conservar el reporte y actor de cada ejecución;
- permitir rollback de las filas nuevas antes de activar dual read, sin
  restaurar sobre tablas legacy;
- separar datos `DEMO` de datos `OFFICIAL`.

## 12. Admin Web futuro para 5B

No se crea `apps/web` en esta fase. El diseño funcional mínimo que el futuro
Admin Web deberá soportar es:

### Calendarios

- listar calendarios por campus y línea;
- crear borrador con fechas y zona visibles;
- validar solapamientos;
- publicar, archivar y consultar historial;
- previsualizar fechas efectivas antes de publicar.

### Patrones y tiempos

- seleccionar `IDA` o `RETORNO`;
- seleccionar uno o más días de semana;
- capturar lista explícita de horas `HH:mm`;
- editar llegada aproximada opcional;
- duplicar un patrón para crear una variación controlada;
- publicar con validación de duplicados y cobertura.

### Excepciones

- cargar una fecha o un período;
- elegir razón: feriado, vacaciones, exámenes u otra;
- elegir efecto: sin servicio, reemplazar o agregar horas;
- seleccionar ambos sentidos o uno solo;
- previsualizar el resultado efectivo;
- auditar actor, motivo y cambio.

### Fuera de alcance

- asignar bus o conductor;
- iniciar un `ServiceRun`;
- GPS, ETA o websocket;
- login Driver;
- construir el Student Mobile nuevo;
- borrar el modelo legacy.

## 13. Contrato conceptual de lectura futura

La API final se definirá en una fase posterior. Conceptualmente, un lector de
programación debe poder devolver:

```json
{
  "serviceLineCode": "NORTE",
  "serviceDate": "2026-09-05",
  "timezone": "America/Guayaquil",
  "direction": "IDA",
  "scheduleSource": "REGULAR",
  "exception": null,
  "times": [
    { "departureTime": "06:40", "approximateArrivalTime": "07:25" },
    { "departureTime": "08:30", "approximateArrivalTime": "09:15" },
    { "departureTime": "17:00", "approximateArrivalTime": "17:45" }
  ]
}
```

Para un feriado:

```json
{
  "serviceDate": "2026-10-09",
  "timezone": "America/Guayaquil",
  "direction": "IDA",
  "scheduleSource": "EXCEPTION",
  "exception": { "reason": "HOLIDAY", "effect": "NO_SERVICE" },
  "times": []
}
```

Este contrato no expone `RoutePath`, vehículo, conductor ni estado
`IN_PROGRESS`. Es programación, no operación.

## 14. Invariantes y pruebas requeridas para implementación

### Unitarias

- cálculo de día de semana desde fecha civil;
- vigencia inclusiva de calendario;
- zona `America/Guayaquil`;
- regular M-F;
- lunes-jueves y viernes con horarios diferentes;
- IDA y RETORNO independientes;
- excepción global frente a excepción por dirección;
- `NO_SERVICE`, `REPLACE_TIMES` y `ADD_TIMES`;
- vacaciones generadas por intervalo sin duplicados;
- exámenes con horario especial;
- rechazo de excepción sin tiempos de reemplazo;
- rechazo de patrón regular sin días o tiempos;
- orden y deduplicación de horas.

### Integración PostgreSQL

- `validFrom <= validUntil`;
- no solapamiento de calendarios publicados por línea;
- unicidad de días por patrón;
- unicidad de hora por patrón;
- unicidad de excepción por fecha y alcance;
- patrón de excepción ligado al mismo calendario;
- `TIME` no acepta valores inválidos;
- publicación atómica de calendario, patrón y auditoría.

### Compatibilidad

- las 90 filas legacy permanecen con los mismos IDs y valores;
- un `Schedule` sin mapping no produce datos canónicos;
- un mapping ambiguo produce `needs_review`;
- la ausencia de un `Schedule` no crea un feriado;
- el endpoint legacy no cambia de shape;
- el nuevo resolver no etiqueta asignaciones como buses en recorrido.

### Preparación futura de departures

- materialización repetida no duplica `(línea, dirección, fecha, hora)`;
- excepción reemplaza o agrega según su efecto;
- cambio futuro no muta una salida operada;
- una salida sin assignment sigue siendo una salida válida;
- una salida puede recibir múltiples assignments después.

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Feriado asumido por ausencia de filas | Solo excepciones oficiales explícitas |
| Calendarios publicados solapados | Validación de publicación y constraint controlada |
| Viernes con horario distinto perdido | `SchedulePatternDay` y patrones separados |
| Excepción global afecta línea equivocada | Calendario ligado a `ServiceLine` |
| `direction` específica y global se mezclan | Precedencia determinista y rechazo de ambigüedad |
| Hora local convertida incorrectamente | `TIME` + fecha civil + `America/Guayaquil` |
| Cambio de horario reescribe histórico | Reconciliar solo departures futuras editables |
| Legacy mapeado por intuición | Binding aprobado y estados de revisión |
| Nuevo horario confundido con bus activo | `ScheduledDeparture` separado de `ServiceRun` |
| Sobrearquitectura de frecuencia | MVP solo `EXPLICIT_TIMES` |

## 16. Gaps y decisiones que siguen bloqueando implementación

El diseño está cerrado conceptualmente, pero estos puntos requieren aprobación
antes de tocar Prisma:

1. fechas oficiales de vigencia para cada `ServiceLine`;
2. calendario académico institucional que rige UPS GO;
3. feriados exactos y si alguno tiene servicio especial;
4. intervalos oficiales de vacaciones;
5. fechas y reglas de la semana/período de exámenes;
6. si una excepción puede ser global para la línea o específica por sentido;
7. quién puede publicar, cancelar y corregir una excepción;
8. ventana de materialización inicial de `ScheduledDeparture`;
9. política de cambios de horarios ya publicados pero aún futuros;
10. mapping aprobado de los 90 `Schedule` y sus siete rutas legacy;
11. decisión sobre qué datos de llegada aproximada siguen siendo confiables;
12. política de exposición al estudiante cuando no hay calendario configurado.

Ninguno de estos gaps justifica alterar el modelo legacy de forma preventiva.

## 17. Plan de implementación posterior

Cuando los bloqueadores estén aprobados, la implementación debe mantenerse
aditiva:

### 5B-1 — Schema expand

- agregar enums y modelos de calendario, patrón, días, tiempos y excepciones;
- agregar constraints e índices revisados;
- verificar tipos físicos `DATE`, `TIME` y `TIMESTAMPTZ` en SQL;
- no crear todavía `ScheduledDeparture` si se mantiene la separación 5B/5C.

### 5B-2 — Domain/application

- resolver calendario efectivo;
- publicar y archivar con autorización;
- aplicar excepciones y auditoría;
- validar concurrencia y solapamientos;
- mantener legacy sin dual write accidental.

### 5B-3 — Data rehearsal

- dry run sobre copia aislada o fixtures sintéticos;
- validar los 90 horarios sin escribir producción;
- comparar resultado canónico con legacy;
- obtener aprobación del reporte.

### 5C — ScheduledDeparture y operación

- materializar por ventana;
- enlazar assignments y múltiples buses;
- separar `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` y estados de salida;
- seleccionar `RoutePath` en assignment;
- conservar snapshots y auditoría.

## 18. GO / NO-GO

### GO para diseño

**GO.** La representación propuesta cubre calendario regular, días de semana,
vigencia, `America/Guayaquil`, horas explícitas, feriados, vacaciones,
exámenes, excepciones por dirección y prioridad sobre el calendario regular.

También deja preparada la materialización futura de `ScheduledDeparture` sin
confundir programación con operación y sin poner `RoutePath` en el horario.

### NO-GO para implementación inmediata

**NO-GO.** Todavía no se deben modificar Prisma, crear migraciones, ejecutar
backfill, cambiar contratos, construir `apps/web` ni migrar Mobile.

Los bloqueadores exactos son las doce decisiones de la sección 16, en especial:

- calendario oficial y fechas de vigencia;
- feriados, vacaciones y exámenes aprobados;
- scope de excepciones;
- mapping de las 90 filas legacy;
- ventana y política de materialización.

### Condición de salida hacia implementación

La siguiente fase puede recibir autorización solo cuando exista un paquete
aprobado que contenga:

```text
GO negocio de calendario
GO mapping legacy
GO modelo SQL aditivo
GO estrategia de rehearsal
NO-GO backfill hasta completar dry run y aprobación
```

## 19. Estado final

```text
FASE 5B DESIGN:                 CLOSED FOR REVIEW
CALENDAR MODEL:                DEFINED
WEEKDAY PATTERNS:              DEFINED
EXPLICIT TIMES:                DEFINED
EXCEPTIONS/PRECEDENCE:         DEFINED
AMERICA/GUAYAQUIL:             DEFINED
SCHEDULED DEPARTURE PREP:      DEFINED, NOT IMPLEMENTED
LEGACY 90 SCHEDULES:           PRESERVED, NOT BACKFILLED
PRISMA / MIGRATION:            NOT TOUCHED
API / MOBILE / WEB:            NOT TOUCHED
BACKFILL:                      NOT EXECUTED
PHASE 5B IMPLEMENTATION:       NO-GO PENDING BUSINESS APPROVAL
```
