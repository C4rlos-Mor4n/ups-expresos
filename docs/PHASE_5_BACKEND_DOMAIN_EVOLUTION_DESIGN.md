# UPS GO — Backend Domain Evolution Design

**Fase:** 5 — Backend Domain Evolution Design
**Fecha:** 2026-08-28
**Modo:** diseño técnico, planificación y arquitectura; no implementación
**Estado de autorización:** `GO FASE 5 DESIGN` / `NO-GO FASE 5 IMPLEMENTATION`

> **DESIGN ONLY — NOT IMPLEMENTED**

Este documento diseña la evolución del backend de UPS GO desde el modelo actual hacia el dominio aprobado conceptualmente en Fase 4 y Fase 4.1. Los nombres, modelos, enums, constraints y endpoints de este documento son propuestas para una futura implementación; no modifican el schema, los servicios, los controladores ni los contratos actuales.

## 1. Veredicto

### Veredicto técnico

La arquitectura recomendada es una evolución **equilibrada y aditiva**:

```text
Modelo legacy actual
Route + Schedule + RouteAssignment + Trip
                 │
                 │ adaptadores y mapping aprobado
                 ▼
Dominio canónico nuevo
ServiceLine
  → RouteVariant
      → RouteVariantStop → Stop
      → SchedulePattern → ServiceCalendar / ServiceException
          → ScheduledDeparture
              → ServiceAssignment
                  → ServiceRun → Vehicle + Driver
```

El modelo legacy se mantiene durante la transición. No se recomienda una migración destructiva ni un reemplazo directo de `Route` por `ServiceLine`.

### Veredictos de autorización

```text
GO SCHEMA FOUNDATION:  YES, solo como diseño y después de aprobación de datos
GO API FOUNDATION:     YES, solo como diseño de contratos y adaptadores
GO MIGRATION:          NO
GO BACKFILL:           NO
GO PRISMA IMPLEMENT:   NO
GO MOBILE CHANGES:     NO
GO ADMIN WEB:          NO
DRIVER AUTH / GPS:     DEFERRED
```

Fase 5 puede producir el diseño técnico completo. La implementación requiere que UPS apruebe el mapping de rutas, Intercampus, ramales, paradas, horarios y calendario.

## 2. Estado actual

### 2.1 Hechos del repositorio

La evidencia principal es `apps/api/prisma/schema.prisma:129-356`, los módulos NestJS actuales y la documentación de contrato.

| Área | Estado actual | Consecuencia |
|---|---|---|
| Rutas | `Route` con nombre y `direction` libre | No existe agrupación Norte/Sur/La Joya |
| Paradas | `Stop` compartida y `RouteStop` ordenada | La convergencia existe, pero es específica de `Route` |
| Horarios | `Schedule` por día, dirección y string HH:mm | No hay vigencia, excepción, patrón ni salida materializada |
| Flota | `Vehicle` con placa, código, capacidad y estado | Falta disponibilidad temporal por salida |
| Conductores | `Driver` con perfil y asignaciones permanentes opcionales | No es fuente suficiente para rotación diaria |
| Planificación | `RouteAssignment` por ruta y fecha | No identifica una hora/salida y bloquea múltiples asignaciones de ruta por día |
| Operación | `Trip` ligado a assignment | No identifica salida programada ni progreso de ruta |
| Mobile | Una ruta plana y un `currentOperation` | No representa línea, variante ni múltiples buses |
| Admin | CRUD de catálogos, asignaciones y driver operations | Falta tablero de operación, calendario, incidencias y consulta de auditoría |
| Documentación | El resumen declara 46 endpoints | Omite los módulos de asignaciones y `driver/*` presentes en código |

### 2.2 Datos locales auditados

Las consultas locales de solo lectura encontraron:

```text
7 routes
14 stops
33 route_stops
90 schedules
5 vehicles
5 drivers
4 route_assignments
1 trip
6 notices
```

Los siete registros actuales son pares de origen/destino; no existe registro canónico con nombre `Ruta Norte`, `Ruta Sur` o `Ruta La Joya`.

Los 90 horarios demo están distribuidos de lunes a viernes. El catálogo tiene 13 de 14 paradas usadas por más de una ruta, lo que confirma la necesidad de relaciones compartidas.

El seed clasifica las asignaciones como demo y usa notas de Norte/Sur/La Joya que contradicen algunos `legacyNames`. Esas notas no pueden usarse como mapping automático.

## 3. Principios

1. PostgreSQL sigue siendo la fuente de verdad.
2. Mantener un monolito modular NestJS; no introducir microservicios, Kafka, event bus distribuido ni CQRS sin una necesidad demostrada.
3. Separar catálogo, programación, asignación y operación real.
4. Un servicio publicado no implica que exista un bus circulando.
5. Una salida programada puede tener cero, una o muchas operaciones de bus.
6. Una parada física no se duplica por cada línea.
7. No convertir recomendaciones `BUSINESS_APPROVAL_REQUIRED` en datos oficiales.
8. No cambiar contratos existentes silenciosamente.
9. No eliminar físicamente datos con historial.
10. Las operaciones críticas deben ser transaccionales y resistentes a concurrencia.
11. Los tiempos de programación son locales de Guayaquil; los timestamps de eventos son instantes reales en UTC.
12. Driver Auth y GPS son extensiones posteriores, no prerrequisitos del dominio base.

## 4. Modelo legacy

### 4.1 Clasificación de modelos actuales

| Modelo | Uso actual | Problema | KEEP | ADAPT | DEPRECATE | REPLACE |
|---|---|---|---:|---:|---:|---:|
| `AllowedEmailDomain` | Dominios permitidos para auth | No pertenece al transporte | Sí | No | No | No |
| `User` | Cuenta, rol, actor de auditoría | Roles de negocio todavía simples | Sí | Sí, permisos futuros | No | No |
| `AuthVerificationCode` | OTP | Ninguno para esta evolución | Sí | No | No | No |
| `Session` | Refresh sessions | Ninguno para esta evolución | Sí | No | No | No |
| `Route` | Recorrido legacy expuesto a Mobile/Admin | Mezcla línea, sentido y recorrido | Sí, como façade | Sí | Escritura nueva futura | `ServiceLine` + `RouteVariant` |
| `Stop` | Lugar físico | Seed no oficial; falta validación UPS | Sí | Validar catálogo | No | No |
| `RouteStop` | Parada ordenada por `Route` | No soporta variante/versionado | Sí, para legacy | Mapper | Escritura nueva futura | `RouteVariantStop` |
| `Schedule` | Horario semanal por route | No soporta patrón, calendario, vigencia o salida | Sí, para legacy | Mapper | Escritura nueva futura | `SchedulePattern` + `ScheduleTime` |
| `Vehicle` | Flota | Estado no es disponibilidad temporal | Sí | Reglas de disponibilidad | No | No |
| `Driver` | Perfil de conductor | `assignedRoute/Vehicle` permanente | Sí | Separar operación | No | No |
| `Notice` | Comunicación publicada | Sin scope de dominio | Sí | Extender aditivamente | No | No |
| `AuditLog` | Trazas internas de mutaciones | No hay consulta Admin | Sí | Convenciones y endpoint futuro | No | No |
| `TripFeedback` | Feedback por route/driver | No identifica salida real | Sí | Relación opcional a run | No | No |
| `RouteAssignment` | Bus/conductor por ruta y fecha | No identifica salida; conflicto por route/día | Sí, histórico/compatibilidad | Mapper | Camino de escritura futuro | `ServiceAssignment` |
| `Trip` | Viaje manual asociado a assignment | No identifica scheduled departure | Sí, histórico/compatibilidad | Mapper | Camino de escritura futuro | `ServiceRun` |

### 4.2 Regla de transición

Mientras exista Mobile legacy:

- `Route` conserva sus IDs y su forma de respuesta.
- `Schedule` conserva su lectura para consumidores actuales.
- `RouteAssignment` y `Trip` no se borran ni se reinterpretan retroactivamente sin un mapping aprobado.
- El dominio nuevo puede apuntar a los registros legacy mediante relaciones de compatibilidad.
- Una fila legacy sin mapping confirmado permanece legacy; no se le asigna una línea por proximidad geográfica o nombre.

## 5. Modelo objetivo

### 5.1 Diagrama completo

```text
ServiceLine
    │
    ├── RouteVariant
    │       │
    │       ├── RouteVariantStop ── Stop
    │       │
    │       └── SchedulePattern
    │               │
    │               ├── ScheduleTime
    │               └── ServiceCalendar
    │                       └── ServiceException
    │
    └── ScheduledDeparture
            │
            ├── ServiceAssignment
            │       ├── Driver
            │       └── Vehicle
            │
            └── ServiceRun
                    ├── Driver snapshot/reference
                    ├── Vehicle snapshot/reference
                    └── OperationalIncident reference
```

### 5.2 Semántica

```text
ServiceLine       = promesa visible: Norte, Sur, La Joya
RouteVariant      = recorrido concreto, sentido y posible ramal
SchedulePattern   = regla reusable de programación
ScheduledDeparture= salida concreta para una fecha y hora
ServiceAssignment = reserva de recursos para una salida
ServiceRun        = unidad concreta que ejecuta una salida
```

La cardinalidad crítica es:

```text
1 ScheduledDeparture → 0..N ServiceRun
```

Una salida sin bus iniciado sigue siendo válida como servicio publicado. Un bus asignado no es automáticamente una operación `IN_PROGRESS`.

## 6. ServiceLine

### 6.1 Responsabilidad

`ServiceLine` representa las tres entradas que el estudiante reconoce:

```text
NORTE
SUR
LA_JOYA
```

No es sinónimo de una ruta física individual ni de un bus.

### 6.2 Campos propuestos

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceLine {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)

  variants RouteVariant[]

  @@map("service_lines")
}
```

### 6.3 Decisiones

- `code` es la identidad estable y única; no se usa el nombre visible como FK.
- No se agrega `slug` en el MVP: `code` cumple la función estable y evita duplicar identidad.
- `isActive=false` archiva lógicamente; no se permite DELETE físico si la línea tiene historial.
- No se insertan todavía los tres registros.
- La creación de `NORTE`, `SUR` y `LA_JOYA` debe depender del mapping aprobado por UPS.

## 7. RouteVariant

### 7.1 Responsabilidad

`RouteVariant` representa una opción concreta de recorrido dentro de una línea. Una línea puede tener Ida y Retorno, y cada sentido puede tener uno o más ramales.

### 7.2 Campos propuestos

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model RouteVariant {
  id                         String          @id @default(uuid()) @db.Uuid
  serviceLineId              String          @db.Uuid
  code                       String
  name                       String
  direction                  ServiceDirection
  branchCode                 String?
  originName                 String?
  destinationName            String?
  estimatedDurationMinutes   Int?
  isActive                   Boolean         @default(true)
  createdAt                  DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt                  DateTime        @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine          @relation(fields: [serviceLineId], references: [id])
  stops       RouteVariantStop[]
  patterns    SchedulePattern[]
  departures  ScheduledDeparture[]

  @@unique([serviceLineId, code])
  @@index([serviceLineId, direction, isActive])
  @@map("route_variants")
}
```

### 7.3 Reglas

- `branchCode` es nullable; no se inventa un ramal donde operación no lo haya definido.
- Cambiar horario, vehículo o conductor no crea una variante.
- Cambiar sustancialmente origen, destino, secuencia o conjunto de paradas sí puede crear una variante.
- `code` es estable dentro de la línea y no se renombra por cambios de marketing.
- `estimatedDurationMinutes` es opcional hasta que operación entregue una duración confiable.

## 8. Stops

### 8.1 Stop actual

`Stop` puede conservarse como catálogo físico compartido. Las 14 filas actuales tienen coordenadas, pero el seed advierte que no son paradas oficiales de transporte público. La validación oficial es un requisito de backfill.

### 8.2 RouteVariantStop

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model RouteVariantStop {
  id                         String   @id @default(uuid()) @db.Uuid
  routeVariantId             String   @db.Uuid
  stopId                     String   @db.Uuid
  stopOrder                  Int
  estimatedMinutesFromStart  Int?
  notes                      String?
  isActive                   Boolean  @default(true)

  routeVariant RouteVariant @relation(fields: [routeVariantId], references: [id])
  stop         Stop         @relation(fields: [stopId], references: [id])

  @@unique([routeVariantId, stopId])
  @@unique([routeVariantId, stopOrder])
  @@index([routeVariantId, stopOrder])
  @@index([stopId])
  @@map("route_variant_stops")
}
```

### 8.3 Vigencia de paradas

No se recomienda agregar vigencia temporal a cada membresía en el primer MVP si la edición futura se hace creando una nueva variante o una versión de itinerario. La primera implementación debe proteger una variante publicada contra edición destructiva; si operación exige cambiar la misma variante con histórico, entonces se agrega versionado en una decisión posterior.

La relación `Stop` → múltiples `RouteVariantStop` resuelve la convergencia sin duplicar puntos físicos.

## 9. SchedulePattern

### 9.1 Decisión

El MVP confirmado funcionalmente es `EXPLICIT_TIMES`. La frecuencia se deja como capacidad futura, sin agregar campos de frecuencia que no se consumirán.

### 9.2 Alternativas

| Alternativa | Evaluación |
|---|---|
| Horas directamente en pattern | Simple, pero mezcla regla con múltiples valores y dificulta extensiones |
| `SchedulePattern` + `ScheduleTime` | Leve relación adicional, mejor integridad y edición; recomendada |
| Frecuencia completa desde el inicio | Sobrearquitectura para el catálogo actual |

### 9.3 Campos propuestos

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum SchedulePatternType {
  EXPLICIT_TIMES
  FREQUENCY
}

enum SchedulePatternStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model SchedulePattern {
  id                 String                @id @default(uuid()) @db.Uuid
  routeVariantId     String                @db.Uuid
  serviceCalendarId  String                @db.Uuid
  type               SchedulePatternType   @default(EXPLICIT_TIMES)
  status             SchedulePatternStatus @default(DRAFT)
  name               String?
  isActive           Boolean               @default(true)
  exceptionId        String?               @unique @db.Uuid
  createdAt          DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime              @updatedAt @db.Timestamptz(3)

  routeVariant    RouteVariant       @relation(fields: [routeVariantId], references: [id])
  serviceCalendar ServiceCalendar     @relation(fields: [serviceCalendarId], references: [id])
  times           ScheduleTime[]
  departures      ScheduledDeparture[]
  exception       ServiceException?   @relation("ExceptionReplacement", fields: [exceptionId], references: [id])

  @@index([routeVariantId, status, isActive])
  @@index([serviceCalendarId])
  @@map("schedule_patterns")
}

model ScheduleTime {
  id                   String   @id @default(uuid()) @db.Uuid
  schedulePatternId    String   @db.Uuid
  departureTime        DateTime @db.Time(0)
  approximateArrivalTime DateTime? @db.Time(0)
  isActive             Boolean  @default(true)

  pattern SchedulePattern @relation(fields: [schedulePatternId], references: [id])

  @@unique([schedulePatternId, departureTime])
  @@index([schedulePatternId, departureTime])
  @@map("schedule_times")
}
```

### 9.4 Regla de frecuencia futura

`FREQUENCY` puede diseñarse después con una entidad o campos específicos, por ejemplo ventana inicial, ventana final e intervalo. No se implementa en esta primera evolución hasta que UPS confirme que existe esa modalidad real.

## 10. ServiceCalendar

### 10.1 Representación elegida

Se eligen siete booleanos por claridad, validación directa y mantenimiento sencillo con Prisma/PostgreSQL. No se recomienda bitmask, string o una tabla de días para el MVP.

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceCalendar {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  validFrom   DateTime @db.Date
  validUntil  DateTime @db.Date
  timezone    String   @default("America/Guayaquil")
  monday      Boolean  @default(false)
  tuesday     Boolean  @default(false)
  wednesday   Boolean  @default(false)
  thursday    Boolean  @default(false)
  friday      Boolean  @default(false)
  saturday    Boolean  @default(false)
  sunday      Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)

  patterns   SchedulePattern[]
  exceptions ServiceException[]

  @@index([validFrom, validUntil, isActive])
  @@map("service_calendars")
}
```

### 10.2 AcademicPeriod

No se crea `AcademicPeriod` en el MVP. `ServiceCalendar` con vigencia y excepciones resuelve clases, vacaciones, feriados y eventos simples. Se podrá añadir un concepto académico si después se necesitan permisos, reportes o reglas que no sean solo de prestación del servicio.

## 11. ServiceException

### 11.1 Modelo

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceExceptionType {
  NO_SERVICE
  SPECIAL_SCHEDULE
}

model ServiceException {
  id                    String               @id @default(uuid()) @db.Uuid
  serviceCalendarId     String               @db.Uuid
  serviceDate           DateTime             @db.Date
  type                  ServiceExceptionType
  reason                String
  createdById           String?              @db.Uuid
  createdAt              DateTime             @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime             @updatedAt @db.Timestamptz(3)

  calendar           ServiceCalendar  @relation(fields: [serviceCalendarId], references: [id])
  replacementPattern SchedulePattern? @relation("ExceptionReplacement")

  @@unique([serviceCalendarId, serviceDate])
  @@index([serviceDate, type])
  @@map("service_exceptions")
}
```

### 11.2 `SPECIAL_SCHEDULE`

Para evitar JSON o un subsistema de excepciones excesivo, `SPECIAL_SCHEDULE` usa un `SchedulePattern` de reemplazo con horas explícitas y vínculo uno a uno con la excepción. `NO_SERVICE` no necesita patrón de reemplazo.

Reglas:

- una excepción gana sobre el calendario regular;
- no puede haber dos excepciones para el mismo calendario y fecha;
- cambiar una excepción futura no reescribe una operación ya iniciada;
- actor, fecha y razón quedan en `AuditLog`.

## 12. ScheduledDeparture

### 12.1 Responsabilidad

`ScheduledDeparture` es la salida concreta:

```text
2026-09-05 / Ruta Norte / IDA / 06:40
```

No contiene por sí misma conductor ni bus en recorrido.

### 12.2 Estados

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ScheduledDepartureStatus {
  PLANNED
  PUBLISHED
  CANCELLED
  NO_SERVICE
}
```

`PLANNED` permite materializar salidas desde un patrón aún no publicado o prepararlas en Admin. `PUBLISHED` es la única condición para mostrarlas como servicio público. `CANCELLED` y `NO_SERVICE` explican por qué no existe servicio.

### 12.3 Campos

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ScheduledDeparture {
  id                 String                    @id @default(uuid()) @db.Uuid
  routeVariantId     String                    @db.Uuid
  schedulePatternId  String?                   @db.Uuid
  serviceDate        DateTime                  @db.Date
  scheduledTime      DateTime                  @db.Time(0)
  status             ScheduledDepartureStatus  @default(PLANNED)
  cancellationReason String?
  createdAt          DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime                  @updatedAt @db.Timestamptz(3)

  routeVariant RouteVariant       @relation(fields: [routeVariantId], references: [id])
  pattern      SchedulePattern?   @relation(fields: [schedulePatternId], references: [id])
  assignments  ServiceAssignment[]
  runs         ServiceRun[]

  @@unique([routeVariantId, serviceDate, scheduledTime])
  @@index([serviceDate, status])
  @@index([routeVariantId, serviceDate, scheduledTime])
  @@map("scheduled_departures")
}
```

La constraint evita duplicar la misma salida por dos patrones. No impide múltiples `ServiceRun` para esa salida.

## 13. Assignment

### 13.1 Diferencia

```text
ServiceAssignment = recursos reservados para cubrir una salida
ServiceRun        = unidad que efectivamente ejecuta esa salida
```

Una salida publicada puede no tener assignment. Una assignment puede existir sin que el bus haya iniciado.

### 13.2 Modelo

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceAssignmentStatus {
  ASSIGNED
  REPLACED
  RELEASED
}

model ServiceAssignment {
  id                    String                    @id @default(uuid()) @db.Uuid
  scheduledDepartureId  String                    @db.Uuid
  driverId              String                    @db.Uuid
  vehicleId             String                    @db.Uuid
  status                ServiceAssignmentStatus  @default(ASSIGNED)
  assignedAt            DateTime                  @default(now()) @db.Timestamptz(3)
  releasedAt            DateTime?
  replacedById          String?                   @db.Uuid
  notes                 String?
  createdAt             DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime                  @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture  @relation(fields: [scheduledDepartureId], references: [id])
  driver             Driver               @relation(fields: [driverId], references: [id])
  vehicle            Vehicle              @relation(fields: [vehicleId], references: [id])
  replacedBy         ServiceAssignment?  @relation("AssignmentReplacement", fields: [replacedById], references: [id])
  replaces           ServiceAssignment[] @relation("AssignmentReplacement")
  runs               ServiceRun[]

  @@index([scheduledDepartureId, status])
  @@index([driverId, status])
  @@index([vehicleId, status])
  @@map("service_assignments")
}
```

No se crea una fila `UNASSIGNED`: la ausencia de assignment representa ese estado. `REPLACED` y `RELEASED` conservan la historia sin borrar la fila.

## 14. ServiceRun

### 14.1 ¿Nace antes del inicio?

Se compararon dos diseños:

| Diseño | Ventaja | Problema |
|---|---|---|
| Run solo al iniciar | Menos filas; no necesita `NOT_STARTED` | No permite representar no-show, operación planificada o estado de una unidad asignada |
| Run al asignar | Permite `NOT_STARTED`, no-show, historial y reemplazos | Crea una fila antes del movimiento físico |

### Decisión

Crear `ServiceRun` al confirmar una asignación de recursos. Una salida sin recursos sigue teniendo cero runs. Así, `NOT_STARTED` es útil y no se confunde con `PUBLISHED`.

### 14.2 Estados

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceRunStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  SUSPENDED
  CANCELLED
  NO_SHOW
}
```

### 14.3 Modelo y snapshot

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceRun {
  id                    String          @id @default(uuid()) @db.Uuid
  scheduledDepartureId  String          @db.Uuid
  assignmentId          String?         @db.Uuid
  driverId              String          @db.Uuid
  vehicleId             String          @db.Uuid
  driverNameSnapshot    String
  vehicleCodeSnapshot   String
  vehiclePlateSnapshot  String
  status                ServiceRunStatus @default(NOT_STARTED)
  startedAt             DateTime?
  endedAt               DateTime?
  startNotes            String?
  endNotes              String?
  createdAt             DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime        @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture  @relation(fields: [scheduledDepartureId], references: [id])
  assignment         ServiceAssignment?  @relation(fields: [assignmentId], references: [id])
  driver             Driver              @relation(fields: [driverId], references: [id])
  vehicle            Vehicle             @relation(fields: [vehicleId], references: [id])

  @@index([scheduledDepartureId, status])
  @@index([driverId, status])
  @@index([vehicleId, status])
  @@index([startedAt])
  @@map("service_runs")
}
```

### 14.4 Snapshot vs FK

Se conservan ambos:

- FKs `driverId` y `vehicleId` para integridad y consultas.
- snapshots de nombre, código y placa para que un cambio posterior de catálogo no reescriba la historia visible del run.

Una sustitución futura crea una nueva assignment/run o registra la transición aprobada; no muta silenciosamente el snapshot de una operación ya iniciada.

## 15. Incident

### 15.1 Modelo recomendado

Una incidencia es un hecho operativo. No debe confundirse con un aviso.

Para evitar cinco FKs opcionales difíciles de validar en la misma fila, se recomienda un target tipado separado:

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum OperationalIncidentType {
  DELAY
  VEHICLE_BREAKDOWN
  ROUTE_DEVIATION
  STOP_CLOSED
  SERVICE_INTERRUPTION
  OTHER
}

enum OperationalIncidentStatus {
  OPEN
  RESOLVED
  CANCELLED
}

enum IncidentTargetType {
  NETWORK
  SERVICE_LINE
  ROUTE_VARIANT
  STOP
  SCHEDULED_DEPARTURE
  SERVICE_RUN
}

model OperationalIncident {
  id          String                    @id @default(uuid()) @db.Uuid
  type        OperationalIncidentType
  status      OperationalIncidentStatus @default(OPEN)
  description String
  reportedAt  DateTime                  @default(now()) @db.Timestamptz(3)
  resolvedAt  DateTime?
  reportedBy  String?                   @db.Uuid
  resolvedBy  String?                   @db.Uuid
  createdAt   DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime                  @updatedAt @db.Timestamptz(3)

  targets OperationalIncidentTarget[]

  @@index([status, reportedAt])
  @@map("operational_incidents")
}

model OperationalIncidentTarget {
  id         String              @id @default(uuid()) @db.Uuid
  incidentId String              @db.Uuid
  targetType IncidentTargetType
  targetId   String              @db.Uuid

  incident OperationalIncident @relation(fields: [incidentId], references: [id])

  @@unique([incidentId, targetType, targetId])
  @@index([targetType, targetId])
  @@map("operational_incident_targets")
}
```

La aplicación debe validar que `targetId` pertenece al tipo indicado. Si posteriormente la integridad referencial directa resulta prioritaria, se pueden crear tablas link tipadas por entidad; no se debe mezclar ambas estrategias sin necesidad.

## 16. Notice

### 16.1 Compatibilidad

`Notice` actual se conserva con sus campos y respuesta Mobile. El scope se extiende aditivamente y no se cambia el payload legacy durante la primera etapa.

### 16.2 Scope futuro

Se recomienda un alcance mínimo de:

```text
NETWORK
SERVICE_LINE
ROUTE_VARIANT
STOP
```

Una salida específica puede asociarse mediante una incidencia o añadirse después cuando `ScheduledDeparture` esté operativo. Un aviso no sustituye al estado real de la salida.

Si se adopta el mismo patrón de target tipado, el nuevo scope puede vivir en `NoticeTarget` sin hacer nullable una colección de FKs en `Notice`.

## 17. Feedback

`TripFeedback` actual debe conservar `routeId` y `driverId` para no romper Mobile ni el histórico.

### Evolución aditiva recomendada

Agregar en una etapa posterior un `serviceRunId` nullable:

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
serviceRunId String? @db.Uuid
serviceRun   ServiceRun? @relation(fields: [serviceRunId], references: [id])
```

Reglas:

- feedback legacy sigue identificándose por `routeId`/`driverId`;
- feedback nuevo puede asociarse al run real;
- no se inventa `serviceRunId` durante backfill si no hay vínculo inequívoco;
- la ruta legacy se conserva como campo de compatibilidad;
- feedback de una salida cancelada requeriría una decisión de producto separada.

## 18. Audit

Se reutiliza `AuditLog`; no se crea un segundo sistema.

### Convención futura

Toda mutación relevante debe registrar:

```text
actorId
action
entity
entityId
createdAt
metadata segura
```

Acciones mínimas:

```text
PUBLISH
CANCEL
SUSPEND
ASSIGN
REPLACE
RELEASE
START
FINISH
ARCHIVE
RESOLVE
```

No se guardan tokens, secretos ni datos innecesarios en `metadata`. Admin Web necesitará un endpoint de lectura paginada y filtrable; hoy el módulo solo exporta el servicio.

## 19. Time model

### 19.1 Tipos

| Dato | Representación objetivo |
|---|---|
| Fecha de servicio | PostgreSQL `DATE`; sin medianoche artificial |
| Hora publicada | PostgreSQL `TIME`; hora local del calendario |
| Zona | `America/Guayaquil` en `ServiceCalendar` |
| Eventos `createdAt`, `startedAt`, `endedAt` | instante UTC; preferiblemente `TIMESTAMPTZ(3)` |
| API date | `YYYY-MM-DD` |
| API time | `HH:mm` |
| API date-time | ISO 8601 con offset/UTC |

### 19.2 Regla de cálculo

Para decidir si una salida ya pasó:

1. tomar `serviceDate` y `scheduledTime` como hora local del calendario;
2. resolverlos con `America/Guayaquil`;
3. comparar con el instante actual;
4. guardar `startedAt` y `endedAt` como timestamps reales.

No almacenar una salida de 06:40 únicamente como un DateTime UTC sin conservar la fecha y la hora conceptual local.

La migración futura debe revisar los tipos físicos actuales antes de declarar cumplimiento: Prisma `DateTime` no debe asumirse equivalente a `TIMESTAMPTZ` sin verificar el SQL generado.

## 20. Constraints

### 20.1 Integridad de catálogo

```text
ServiceLine.code UNIQUE
RouteVariant(serviceLineId, code) UNIQUE
RouteVariantStop(routeVariantId, stopId) UNIQUE
RouteVariantStop(routeVariantId, stopOrder) UNIQUE
```

### 20.2 Integridad de programación

```text
ServiceCalendar.validFrom <= validUntil
ServiceException(serviceCalendarId, serviceDate) UNIQUE
ScheduleTime(schedulePatternId, departureTime) UNIQUE
ScheduledDeparture(routeVariantId, serviceDate, scheduledTime) UNIQUE
```

### 20.3 Integridad de recursos

No se debe usar una unique simple por `scheduledDepartureId`: una salida admite varios buses.

Se recomienda:

- índice único parcial para evitar dos assignments activas del mismo vehículo en la misma salida;
- índice único parcial para evitar dos assignments activas del mismo conductor en la misma salida;
- transacción serializable para conflictos entre salidas distintas;
- verificación de ventana operacional antes de asignar o iniciar.

Prisma no expresa todas las constraints parciales o temporales del dominio; si son necesarias, se documentarán en una migración SQL controlada, nunca mediante `db push`.

### 20.4 Historial

- no DELETE físico para líneas, variantes, paradas usadas, vehículos, conductores, departures con historial, assignments ni runs;
- catálogos usan `isActive` para archive simple;
- salidas/runs usan estados y motivos;
- modificaciones administrativas dejan `AuditLog`.

## 21. Concurrency

### 21.1 Riesgos

La implementación actual hace validaciones de conflicto y luego escribe. El diseño futuro debe cubrir:

- dos conductores iniciando el mismo run;
- mismo vehículo asignado a dos salidas solapadas;
- mismo conductor asignado a dos salidas solapadas;
- dos administradores reemplazando una assignment;
- cancelación concurrente con inicio;
- vehículo pasando a mantenimiento mientras se intenta iniciar.

### 21.2 Estrategia

Para asignar, reemplazar, cancelar e iniciar:

1. abrir transacción;
2. bloquear la salida/assignment objetivo y los recursos relevantes;
3. volver a validar estados y disponibilidad dentro de la transacción;
4. comprobar ventanas de solapamiento;
5. escribir assignment/run y `AuditLog` atómicamente;
6. usar aislamiento `Serializable` donde exista carrera entre recursos;
7. reintentar errores de serialización de forma limitada y observable.

No se recomienda agregar un bus de eventos distribuido. Una columna `version`/optimistic concurrency puede evaluarse para ediciones de catálogos, pero no sustituye la transacción de operación.

## 22. Student API

### 22.1 Contrato mínimo futuro

La complejidad interna no debe llegar completa al estudiante. Se recomienda esta superficie mínima, separada de los endpoints legacy:

```text
GET /mobile/home?serviceDate=YYYY-MM-DD
GET /mobile/service-lines
GET /mobile/service-lines/:id
GET /mobile/route-variants/:id/departures?serviceDate=YYYY-MM-DD
GET /mobile/departures/:id/runs
GET /mobile/stops/:id
GET /mobile/notices
```

No todos deben implementarse a la vez. Prioridad:

1. `/mobile/home` para la pregunta “¿qué puedo tomar ahora?”;
2. lista/detalle de líneas;
3. próximas salidas por variante;
4. runs reales de una salida;
5. detalle de parada solo si no queda cubierto por la respuesta de variante.

### 22.2 Respuestas conceptuales

#### Home

```json
{
  "serviceDate": "2026-09-05",
  "timezone": "America/Guayaquil",
  "lastUpdatedAt": "2026-09-05T10:00:00.000Z",
  "criticalNotice": null,
  "lines": [
    {
      "id": "uuid",
      "code": "NORTE",
      "name": "Ruta Norte",
      "nextDeparture": {
        "id": "uuid",
        "direction": "IDA",
        "scheduledTime": "06:40",
        "status": "PUBLISHED",
        "activeRunCount": 0
      }
    }
  ]
}
```

#### Departure runs

```json
{
  "departureId": "uuid",
  "status": "PUBLISHED",
  "runs": [
    {
      "id": "uuid",
      "status": "IN_PROGRESS",
      "startedAt": "2026-09-05T11:40:00.000Z",
      "vehicle": { "code": "BUS-001", "plate": "PPN-1234" }
    }
  ]
}
```

Los campos de conductor/placa deben estar sujetos a la decisión de privacidad de UPS. Antes de `IN_PROGRESS`, no deben presentarse como bus activo.

### 22.3 API agregada `/mobile/home`

Se recomienda porque reduce requests para la pantalla principal y permite una semántica consistente de “próxima salida” por línea. El coste es un endpoint compuesto que debe tener límites claros y buena caché. No se debe convertir en un endpoint que devuelva todo el sistema.

## 23. Compatibility

### 23.1 Opción elegida

Se elige **mantener endpoints existentes y mapear el dominio nuevo**, mientras sea razonable. No se fuerza una migración breaking ni se renombra `/mobile/routes`.

### 23.2 Endpoints Mobile a preservar

```text
GET /mobile/routes
GET /mobile/routes/:id
GET /mobile/routes/:id/stops
GET /mobile/routes/:id/schedules
GET /mobile/notices
```

También se preservan inicialmente auth y feedback:

```text
POST /auth/request-code
POST /auth/verify-code
POST /auth/refresh
POST /auth/logout
GET  /auth/me
POST /trip-feedback
GET  /trip-feedback
GET  /trip-feedback/:id
```

### 23.3 `currentOperation`

El mapper futuro será conceptualmente:

```text
ServiceLine / RouteVariant
    + ScheduledDeparture
    + ServiceAssignment
    + ServiceRun
            ↓
legacy MobileRouteResponse.currentOperation
```

Regla de compatibilidad:

- `IN_PROGRESS` solo proviene de `ServiceRun` iniciado;
- una assignment futura no se presenta como `IN_PROGRESS`;
- si un consumidor legacy aún necesita ver `SCHEDULED`, se puede conservar el estado `SCHEDULED` en el shape actual, pero debe representar “programado”, no “en recorrido”;
- conductor/vehículo de una assignment `SCHEDULED` no deben etiquetarse como activos;
- `currentOperation` sigue siendo nullable y singular en el contrato legacy;
- el contrato nuevo expone la colección de runs de una salida.

La diferencia de semántica debe documentarse antes del rollout porque conservar la forma JSON no elimina todos los cambios de comportamiento.

## 24. Admin API

### 24.1 Módulos futuros y operaciones

| Módulo | Create | Read | Update | Archive/Deactivate | Operaciones especiales |
|---|---:|---:|---:|---:|---|
| `/admin/service-lines` | Sí | Sí | Sí | Sí | publicar/ordenar, no DELETE físico |
| `/admin/route-variants` | Sí | Sí | Sí | Sí | ordenar paradas, validar sentido/ramal |
| `/admin/stops` | Existente | Existente | Existente | Existente | validar uso y coordenadas |
| `/admin/schedule-patterns` | Sí | Sí | Sí | Sí | publicar patrón, generar ventana |
| `/admin/service-calendars` | Sí | Sí | Sí | Sí | activar calendario |
| `/admin/service-exceptions` | Sí | Sí | Sí | No físico | aplicar excepción futura |
| `/admin/departures` | No manual salvo extraordinaria | Sí | limitada | No físico | publicar/cancelar/suspender |
| `/admin/service-assignments` | Sí | Sí | limitada | por estado | reemplazar/liberar |
| `/admin/vehicles` | Existente | Existente | Existente | Existente | disponibilidad/mantenimiento |
| `/admin/drivers` | Existente | Existente | Existente | Existente | disponibilidad por jornada |
| `/admin/notices` | Existente | Existente | Existente | Existente | scope y publicación |
| `/admin/incidents` | Sí | Sí | Sí | resolver | relacionar targets y generar aviso |
| `/admin/operations` | No | Sí | limitada | No | tablero de hoy, iniciar no desde Admin salvo decisión |
| `/admin/users` | Futuro | Futuro | Futuro | Futuro | gestionar roles existentes |
| `/admin/audit-logs` | No | Futuro | No | No | consulta filtrable |

### 24.2 Operaciones diarias

Contratos conceptuales:

```text
GET   /admin/operations/today
GET   /admin/departures?serviceDate=YYYY-MM-DD
POST  /admin/departures/:id/assignments
PATCH /admin/assignments/:id/replace
PATCH /admin/assignments/:id/release
PATCH /admin/departures/:id/cancel
POST  /admin/departures/:id/incidents
```

No son payloads finales. Deben diseñarse con precondiciones de estado, autorización y auditoría.

## 25. Driver compatibility

Driver Auth permanece diferido. El perfil `Driver` se conserva separado de `User` y no se vuelve obligatorio que cada conductor tenga `userId` para completar el dominio de planificación.

### Endpoints actuales a conservar durante transición

```text
GET  /driver/me/assignments/today
POST /driver/trips/start
POST /driver/trips/:id/finish
GET  /driver/trips/current
```

### Adaptación futura

Cuando llegue la fase Driver:

```text
GET  /driver/me/assignments/today
POST /driver/runs/start
POST /driver/runs/:id/finish
GET  /driver/runs/current
```

Los endpoints legacy pueden llamar casos de uso sobre `ServiceRun` mientras dure la compatibilidad. No se implementa aquí login Driver, GPS, posición, websocket ni ETA.

## 26. Migration strategy

Se recomienda **expand → migrate → switch → contract**.

### Phase A — Expand

- crear modelos nuevos sin eliminar legacy;
- crear índices y constraints nuevas de forma controlada;
- agregar adaptadores de lectura/escritura futura;
- preparar OpenAPI separando schemas nuevos de los existentes.

### Phase B — Migrate

- cargar líneas/variantes solo con mapping aprobado;
- asociar paradas mediante relaciones nuevas;
- crear calendarios/patrones con datos oficiales;
- materializar departures de una ventana acordada;
- preservar IDs legacy y trazabilidad.

### Phase C — Dual Read / Compatibility

- comparar respuestas legacy y canónicas;
- mapear nueva operación a `currentOperation`;
- verificar que una assignment no se convierta en `IN_PROGRESS`;
- ejecutar lectura nueva para usuarios internos con observabilidad.

### Phase D — Switch

- habilitar lectura canónica por feature flag o configuración controlada;
- activar por entorno o cohorte pequeña;
- mantener fallback legacy;
- medir errores, faltantes, latencia y discrepancias.

### Phase E — Contract

Solo después de estabilidad, aprobación y ventana de retiro:

- congelar escrituras legacy;
- deprecar endpoints/modelos legacy;
- conservar histórico y auditoría;
- eliminar físicamente únicamente con una fase posterior aprobada.

No se recomienda una migración gigante que altere siete tablas y cambie contratos en una sola operación.

## 27. Backfill

### 27.1 Prerrequisitos

El backfill requiere:

1. mapping oficial de las siete rutas;
2. decisión sobre Intercampus;
3. catálogo oficial de paradas;
4. ramales aprobados;
5. calendario y horarios oficiales;
6. regla de múltiples buses;
7. política de sustitución y disponibilidad.

### 27.2 Mapping explícito

Se recomienda una fuente de mapping explícita, revisada y versionada, por ejemplo conceptualmente:

```json
{
  "legacyRouteId": "uuid",
  "serviceLineCode": "NORTE",
  "routeVariantCode": "NORTE-IDA-RIO-DAULE",
  "approvedBy": "user-uuid",
  "approvedAt": "2026-09-01T12:00:00.000Z"
}
```

No se crea ese archivo en esta fase. No se debe hardcodear `Río Daule = Norte` ni ninguna otra hipótesis antes de aprobación.

### 27.3 Idempotencia

El backfill futuro debe:

- poder ejecutarse más de una vez sin duplicar líneas, variantes, paradas, patrones o departures;
- usar códigos estables y constraints únicas;
- registrar mapping y resultado;
- no modificar datos legacy;
- marcar `needs_review` o detenerse ante mapping faltante;
- producir reporte de filas creadas, vinculadas, omitidas y ambiguas.

## 28. Favorites migration

Mobile guarda favoritos localmente por `routeId`. La estrategia de menor riesgo es conservar esos IDs durante toda la transición inicial.

### Secuencia recomendada

1. `/mobile/routes` continúa aceptando y devolviendo los IDs legacy.
2. El backend mantiene el mapping legacy → variant después de aprobación.
3. La futura versión Mobile puede almacenar favoritos con `entityType` y `entityId` canónicos.
4. En actualización de la app, se traduce un favorito legacy solo cuando el mapping es confirmado.
5. Si no hay mapping, se conserva el favorito legacy y se evita perderlo.

No hacer una migración local que borre favoritos desconocidos.

## 29. Feedback migration

El histórico de `TripFeedback` conserva `routeId` y `driverId`.

### Transición aditiva

- mantener `routeId` como campo requerido mientras haya consumidores actuales;
- agregar `serviceRunId` nullable para nuevos feedbacks;
- asociar un run solo por evidencia inequívoca;
- no asignar un run a los feedbacks históricos solo por fecha aproximada;
- exponer el mismo response legacy durante la primera etapa;
- usar `serviceRun` para nuevos reportes de puntualidad/calidad cuando exista.

Si después se necesita feedback de una salida no iniciada, se evaluará `scheduledDepartureId`; no se agrega automáticamente ahora.

## 30. Seed

El seed actual debe tratarse como catálogo demo, no como fuente oficial.

### Diseño futuro

- separar fixtures `DEMO` de fixtures `OFFICIAL`;
- no reutilizar `legacyNames` contradictorios como identidad canónica;
- dar a fixtures demo códigos no confundibles con producción oficial;
- exigir mapping explícito para crear relaciones nuevas;
- documentar que las coordenadas actuales son referencias y no paradas oficiales.

No se cambia el seed actual en esta fase.

## 31. Tests

La implementación posterior debe tener pruebas en tres niveles.

### Unit

- cálculo de calendario por zona `America/Guayaquil`;
- prioridad de `ServiceException` sobre calendario regular;
- generación de horas explícitas;
- transición de estados de departure, assignment y run;
- `ScheduledDeparture 1:N ServiceRun`;
- reemplazo de vehículo/conductor;
- no convertir assignment en `IN_PROGRESS`;
- mapper a `currentOperation`;
- compatibilidad de mapping legacy;
- validación de ventana de recurso.

### Integration

- constraints únicas de líneas, variantes, paradas, horas y departures;
- materialización idempotente;
- backfill con mapping aprobado;
- rechazo de mapping ausente/ambiguo;
- vehículo en mantenimiento no puede iniciar;
- dos assignments concurrentes del mismo recurso;
- cancelación concurrente con inicio;
- conservación de feedback legacy.

### E2E

#### Student

- ver Norte, Sur y La Joya;
- consultar Ida/Retorno;
- consultar siguiente salida;
- ver cero, uno y varios buses en una salida;
- distinguir Programado de En recorrido;
- ver cancelación y aviso;
- conservar favoritos y feedback.

#### Admin

- configurar línea/variante/paradas;
- publicar calendario y horarios;
- generar/revisar salidas;
- asignar y reemplazar recursos;
- cancelar y auditar;
- registrar incidencia y aviso.

#### Driver posterior

- consultar asignaciones;
- iniciar un run una sola vez;
- finalizarlo;
- rechazar acceso a otro conductor.

## 32. Rollout

No se agrega una bandera por cada módulo. Se recomienda una sola capacidad de lectura canónica si el rollout gradual es necesario:

```text
USE_SERVICE_DOMAIN_V2
```

Debe aplicarse en el adaptador de lectura y no cambiar contratos legacy por debajo sin observabilidad.

### Secuencia

1. entorno local/CI con datos sintéticos;
2. validación interna Admin;
3. shadow read legacy vs canónico;
4. cohorte pequeña Student;
5. ampliación por entorno o porcentaje;
6. retiro solo con evidencia y autorización.

Si el dominio canónico todavía carece de mapping oficial, el flag debe permanecer apagado para datos reales.

## 33. Options

| Opción | Esfuerzo | Deuda | Riesgo de datos | API/Mobile | Admin Web | Evaluación |
|---|---|---|---|---|---|---|
| Conservadora: extender `Route/Schedule/Assignment/Trip` | Bajo inicial | Alta; siguen mezclados línea/salida/run | Alto al agregar ramales y múltiples buses | Menos cambio inmediato, techo bajo | CRUD rápido, operación débil | No recomendada |
| Equilibrada: dominio nuevo + compatibilidad | Medio/alto | Controlable y explícita | Bajo si se hace aditivo y aprobado | Conserva legacy y permite Student nuevo | Permite tablero y planificación real | Recomendada |
| Agresiva: reemplazo directo | Medio al inicio, alto en fallos | Menor después, pero retiro prematuro | Muy alto; rompe mapping/histórico | Breaking change probable | Riesgo alto de bloqueo operativo | No recomendada |

## 34. Recommendation

Adoptar la opción equilibrada por estas razones:

1. El problema es semántico, no solo de columnas.
2. Los siete registros actuales no tienen mapping oficial confirmado.
3. `RouteAssignment` no contiene hora ni salida y no puede ser la base de múltiples buses.
4. Mobile actual depende de IDs y shapes legacy.
5. Feedback y favoritos necesitan continuidad.
6. Admin Web requiere operación diaria, no solo CRUD.
7. La arquitectura nueva puede probarse sin destruir datos.

La primera implementación futura debe limitarse a:

- `ServiceLine`;
- `RouteVariant`;
- `RouteVariantStop`;
- `ServiceCalendar` y `ServiceException`;
- `SchedulePattern` + `ScheduleTime` explícitos;
- `ScheduledDeparture` materializada por ventana;
- `ServiceAssignment`;
- `ServiceRun` manual;
- adaptador Mobile;
- lectura Admin de operación.

Frecuencia, GPS, Driver Auth, websockets y ETA quedan fuera.

## 35. Implementation subphases

Estas son fases de implementación posteriores, no acciones autorizadas ahora.

### 5A — Schema expand

- aprobar mapping y nombres;
- crear modelos nuevos y constraints;
- revisar tipos físicos de fecha/hora/timestamp;
- mantener legacy sin borrado.

### 5B — Catalog, calendar and patterns

- servicios de líneas, variantes y memberships;
- calendarios y excepciones;
- patrones de horas explícitas;
- auditoría y archive.

### 5C — ScheduledDeparture and ServiceRun

- materialización por ventana configurable;
- estados separados;
- assignments y runs múltiples;
- reglas de vehículo/conductor;
- transacciones y concurrencia.

### 5D — Mobile compatibility

- mapper legacy;
- nuevas lecturas Student;
- `/mobile/home` o endpoint equivalente;
- shadow read y pruebas de shape/semántica.

### 5E — Admin API

- catálogo;
- programación;
- operación de hoy;
- reemplazos/cancelaciones;
- incidencias y avisos scopeados;
- auditoría.

### 5F — Approved backfill

- ejecutar solo con mapping firmado/aprobado;
- backfill idempotente;
- reporte de ambigüedades;
- verificación de conteos e invariantes;
- rollout controlado.

### 5G — Legacy contract and cleanup

- congelar escrituras antiguas;
- deprecar gradualmente;
- retirar solo tras migración, uso estable y autorización separada.

## 36. Blockers

### BLOCKS IMPLEMENTATION

- mapping oficial de las siete rutas;
- decisión sobre Intercampus;
- ramales oficiales;
- nombres/coordenadas autorizadas de paradas;
- horarios oficiales y calendario;
- regla exacta de múltiples buses;
- duración y buffer para conflictos de recursos;
- protocolo de mantenimiento/reemplazo;
- política de visibilidad de conductor y vehículo.

### DOES NOT BLOCK FOUNDATION DESIGN

- Driver Auth;
- GPS;
- frecuencia futura;
- roles administrativos avanzados;
- ETA por ubicación;
- mapa en tiempo real.

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Mapping hipotético se vuelve dato oficial | binding aprobado y estado `PENDING/APPROVED` |
| Cambiar `currentOperation` rompe Mobile | mantener shape, mapper, shadow read y documentación semántica |
| Múltiples patrones duplican salidas | unique por variante/fecha/hora e idempotencia |
| Dos Admin asignan el mismo recurso | transacción, locks y validación dentro de la transacción |
| Vehículo cambia a mantenimiento | bloquear inicio, reemplazar/liberar y auditar |
| Edición altera histórico | estados, snapshots y archive; no mutar runs iniciados |
| Seed demo se confunde con oficial | códigos/fuentes separadas y no backfill automático |
| Modelo nuevo sobrearquitecturado | MVP solo explicit times, sin GPS/frequency completa |

## 37. GO / NO-GO

### GO SCHEMA FOUNDATION

**GO para diseño y revisión técnica.** Los modelos y relaciones son suficientemente claros para preparar una migración expand aditiva, siempre que los nombres y constraints sean revisados antes de codificar.

### GO API FOUNDATION

**GO para diseño de casos de uso, adaptadores y contratos conceptuales.** Se debe conservar la API actual y separar nuevas lecturas/operaciones; no se autoriza cambiar controllers o DTOs todavía.

### GO MIGRATION

**NO-GO.** Faltan mapping oficial, Intercampus, ramales, catálogo de paradas, calendario y reglas operativas esenciales.

### GO BACKFILL

**NO-GO.** No existe autorización de datos oficiales suficiente y las notas demo de Norte/Sur presentan contradicciones.

### Resultado final

```text
GO SCHEMA FOUNDATION:  YES — design only
GO API FOUNDATION:     YES — design only
GO MIGRATION:          NO
GO BACKFILL:           NO
```

El siguiente paso correcto es revisar este diseño y obtener aprobación de los bloqueadores de negocio. Después se podrá autorizar Fase 5A con cambios controlados. Esta fase no ejecutó ni debe ejecutar Prisma, migraciones, backfill, cambios API/Mobile, `apps/web`, commit, push o PR.
