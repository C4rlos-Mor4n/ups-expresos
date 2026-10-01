# UPS GO — Campus + RoutePath Domain Correction

Fase 5.1 — corrección formal del diseño de dominio
Fecha: 2026-08-28
Modo: design / architecture correction; no implementación
Estado: diseño autorizado; cambios de schema, API, Mobile y datos no autorizados

> DESIGN ONLY — NOT IMPLEMENTED

Este documento corrige formalmente PHASE_5_BACKEND_DOMAIN_EVOLUTION_DESIGN.md. La corrección nace de una regla de negocio confirmada: una línea de servicio no representa necesariamente un único camino físico.

No se modifica el documento original ni ningún archivo de apps/api, apps/mobile, Prisma, OpenAPI o base de datos.

## 1. Resumen ejecutivo

La jerarquía correcta es:

~~~text
Campus Centenario
└── Ruta Norte
    └── IDA
        └── Salida 06:40
            ├── BUS-001 → Vía Garzota
            ├── BUS-002 → Vía Samanes
            └── BUS-003 → Vía Sauces
~~~

Ruta Norte es la línea que entiende el estudiante. Vía Garzota, Vía Samanes y Vía Sauces son caminos físicos administrados.

El modelo corregido es:

~~~text
Campus
  └── ServiceLine
        ├── RoutePath[]
        │     └── RoutePathStop[] → Stop
        ├── SchedulePattern[]
        │     └── ScheduledDeparture
        │           └── ServiceAssignment[]
        │                 ├── Vehicle
        │                 ├── Driver
        │                 └── RoutePath
        │                       └── ServiceRun
        └── Direction = IDA | RETORNO
~~~

La cardinalidad crítica es:

~~~text
1 ScheduledDeparture → 0..N ServiceAssignment / ServiceRun
~~~

La salida no tiene un único path. El path pertenece a cada assignment/run.

## 2. Motivo de la corrección

El diseño de Fase 5 representaba RouteVariant como una combinación fuerte de línea, dirección y camino. Eso podía obligar a crear variantes o salidas duplicadas cuando varios buses de la misma salida usan caminos distintos.

La separación corregida es:

~~~text
Campus → ServiceLine → Direction → ScheduledDeparture
                                      ├── Assignment A → RoutePath A
                                      ├── Assignment B → RoutePath B
                                      └── Assignment C → RoutePath C
~~~

Esto evita:

- duplicar Ruta Norte por cada camino;
- duplicar una salida por cada bus;
- colocar un solo path en ScheduledDeparture;
- confundir un desvío temporal con un nuevo recorrido oficial.

## 3. Reglas aprobadas

Para este diseño se consideran CONFIRMED:

1. UPS GO soporta múltiples campus.
2. Una línea pertenece operacionalmente a un campus.
3. La identidad de una línea depende de campus y código.
4. Dos Ruta Norte de campus distintos son entidades distintas.
5. Cada línea puede operar en IDA y RETORNO.
6. Ida y Retorno pueden tener horarios, paradas y caminos diferentes.
7. Una salida puede tener cero, uno o varios buses.
8. Cada bus puede tener path, conductor, vehículo, estado e inicio propios.
9. ASSIGNED no significa IN_PROGRESS.
10. Cada assignment selecciona un RoutePath administrado.
11. El conductor no crea un path libremente.
12. Un path se reutiliza en varias fechas, salidas y buses.
13. Un path IDA no puede asignarse a una salida RETORNO.
14. Un path diferente por bus no crea otra línea ni otra salida.
15. Un desvío se registra como incidencia contra el ServiceRun.
16. Driver Auth y GPS continúan diferidos.

## 4. Campus

Campus es el primer nivel de Student y el propietario operacional de una línea regular.

Campos mínimos:

~~~text
id
code
name
address?
latitude?
longitude?
isActive
createdAt
updatedAt
~~~

Decisiones:

- code es único y estable.
- name es visible; no se usa como FK.
- address y coordenadas son opcionales para el MVP.
- isActive=false archiva sin borrar historia.
- No se insertan campus oficiales en esta fase.
- El campus predeterminado del estudiante es una preferencia mutable, no una restricción de acceso.

Para Student se recomienda una preferencia opcional:

~~~text
User.defaultCampusId nullable → Campus.id
~~~

No se infiere el campus por email, nombre o primera ruta.

## 5. ServiceLine

ServiceLine representa el servicio principal visible:

~~~text
Ruta Norte
Ruta Sur
Ruta Este
Ruta La Joya
~~~

No representa una lista fija de paradas ni un único camino.

### Identidad

~~~text
campusId + code
~~~

Ejemplos:

~~~text
Campus Centenario + NORTE
Campus María Auxiliadora + NORTE
~~~

Son dos líneas distintas.

### Tipo e Intercampus

Se recomienda un único modelo con tipo:

~~~text
CAMPUS_ROUTE
INTERCAMPUS
~~~

Campos adicionales:

~~~text
destinationCampusId nullable
~~~

Reglas:

- CAMPUS_ROUTE exige destinationCampusId null en el MVP.
- INTERCAMPUS exige destinationCampusId no nulo y distinto del campus propietario.
- campusId representa campus propietario/origen para la navegación.
- Los extremos de Ida/Retorno pueden detallarse en RoutePath.
- No se crea una entidad paralela InterCampusService.

### Pseudomodelo

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceLineType {
  CAMPUS_ROUTE
  INTERCAMPUS
}

model ServiceLine {
  id                  String          @id @default(uuid()) @db.Uuid
  campusId            String          @db.Uuid
  code                String
  name                String
  description         String?
  type                ServiceLineType @default(CAMPUS_ROUTE)
  destinationCampusId String?         @db.Uuid
  isActive             Boolean         @default(true)
  createdAt            DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime        @updatedAt @db.Timestamptz(3)

  campus            Campus               @relation("CampusServiceLines", fields: [campusId], references: [id])
  destinationCampus Campus?              @relation("CampusDestinationLines", fields: [destinationCampusId], references: [id])
  paths             RoutePath[]
  patterns          SchedulePattern[]
  departures        ScheduledDeparture[]

  @@unique([campusId, code])
  @@index([campusId, isActive])
  @@map("service_lines")
}
~~~

No se insertan Norte, Sur o La Joya todavía.

## 6. Direction

Se mantiene un único enum en español:

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum Direction {
  IDA
  RETORNO
}
~~~

Razón: el dominio y la UI actuales ya usan Ida/Retorno. No se duplican como OUTBOUND/INBOUND.

Direction vive en:

- RoutePath;
- SchedulePattern;
- ScheduledDeparture.

No se crea LineDirection.

Validación futura:

~~~text
assignment.routePath.serviceLineId = departure.serviceLineId
assignment.routePath.direction      = departure.direction
~~~

## 7. RoutePath

RoutePath responde:

> ¿Por qué camino físico planificado va este bus?

Ejemplos:

~~~text
Ruta Norte — Vía Garzota
Ruta Norte — Vía Samanes
Ruta Norte — Vía Sauces
~~~

Campos:

~~~text
id
serviceLineId
code
displayName
direction
originName?
destinationName?
description?
estimatedDurationMinutes?
isActive
createdAt
updatedAt
~~~

displayName es la etiqueta humana para Student. No se muestran IDs técnicos.

### Pseudomodelo

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
model RoutePath {
  id                       String    @id @default(uuid()) @db.Uuid
  serviceLineId            String    @db.Uuid
  code                     String
  displayName              String
  direction                Direction
  originName               String?
  destinationName          String?
  description              String?
  estimatedDurationMinutes Int?
  isActive                 Boolean   @default(true)
  createdAt                DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime  @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine         @relation(fields: [serviceLineId], references: [id])
  stops       RoutePathStop[]
  patterns    SchedulePattern[]
  assignments ServiceAssignment[]
  runs        ServiceRun[]

  @@unique([serviceLineId, code])
  @@index([serviceLineId, direction, isActive])
  @@map("route_paths")
}
~~~

Reglas:

- path IDA solo sirve para salidas IDA.
- path RETORNO solo sirve para salidas RETORNO.
- un mismo path se reutiliza en muchas salidas.
- varios buses pueden usar el mismo path al mismo tiempo.
- cambiar bus, conductor u horario no crea un path.
- una modificación material crea un path nuevo y archiva el anterior.

## 8. RoutePathStop

Relación:

~~~text
RoutePath → RoutePathStop → Stop
~~~

La misma parada física puede estar en muchos paths, líneas y campus. No se duplica Stop.

Campos:

~~~text
id
routePathId
stopId
stopOrder
estimatedMinutesFromStart?
notes?
isActive
~~~

### Pseudomodelo

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
model RoutePathStop {
  id                         String   @id @default(uuid()) @db.Uuid
  routePathId                String   @db.Uuid
  stopId                    String   @db.Uuid
  stopOrder                 Int
  estimatedMinutesFromStart Int?
  notes                      String?
  isActive                  Boolean  @default(true)

  routePath RoutePath @relation(fields: [routePathId], references: [id])
  stop      Stop      @relation(fields: [stopId], references: [id])

  @@unique([routePathId, stopId])
  @@unique([routePathId, stopOrder])
  @@index([routePathId, stopOrder])
  @@index([stopId])
  @@map("route_path_stops")
}
~~~

No se introduce ETA en tiempo real.

## 9. ScheduledDeparture

ScheduledDeparture define:

~~~text
Campus por su línea
ServiceLine
Direction
serviceDate
scheduledTime
~~~

Ejemplo:

~~~text
Campus Centenario / Ruta Norte / IDA / 2026-08-28 / 06:40
~~~

No define un path único, vehículo ni conductor.

Estados recomendados:

~~~text
PLANNED
PUBLISHED
CANCELLED
NO_SERVICE
~~~

Pseudomodelo:

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ScheduledDepartureStatus {
  PLANNED
  PUBLISHED
  CANCELLED
  NO_SERVICE
}

model ScheduledDeparture {
  id                 String                   @id @default(uuid()) @db.Uuid
  serviceLineId      String                   @db.Uuid
  schedulePatternId  String?                  @db.Uuid
  direction          Direction
  serviceDate        DateTime                 @db.Date
  scheduledTime      DateTime                 @db.Time(0)
  status             ScheduledDepartureStatus @default(PLANNED)
  cancellationReason String?
  createdAt          DateTime                 @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime                 @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine           @relation(fields: [serviceLineId], references: [id])
  pattern     SchedulePattern?      @relation(fields: [schedulePatternId], references: [id])
  assignments ServiceAssignment[]
  runs        ServiceRun[]

  @@unique([serviceLineId, direction, serviceDate, scheduledTime])
  @@index([serviceDate, status])
  @@index([serviceLineId, direction, serviceDate, scheduledTime])
  @@map("scheduled_departures")
}
~~~

No routePathId en ScheduledDeparture.

## 10. Multiple Buses

Regla:

~~~text
1 ScheduledDeparture
  ├── Assignment A → BUS-001 → RoutePath Garzota
  ├── Assignment B → BUS-002 → RoutePath Samanes
  └── Assignment C → BUS-003 → RoutePath Sauces
~~~

Cada bus puede tener estado y timestamps propios:

~~~text
BUS-001 → IN_PROGRESS 06:43 → COMPLETED 07:31
BUS-002 → NOT_STARTED
BUS-003 → IN_PROGRESS 06:45 → COMPLETED 07:36
~~~

No se debe:

- crear tres horarios idénticos;
- crear tres líneas;
- poner un único path en la salida;
- usar capacidad agregada como sustituto de buses;
- bloquear el mismo RoutePath para dos buses.

Sí se debe impedir que un mismo vehículo o conductor ejecute servicios incompatibles en el tiempo.

## 11. ServiceAssignment

Una assignment responde:

> Para esta salida, este conductor y este vehículo tienen asignado este camino.

Campos conceptuales:

~~~text
scheduledDepartureId
vehicleId
driverId
routePathId
status
assignedAt
releasedAt?
replacedById?
notes?
~~~

Estados:

~~~text
ASSIGNED
REPLACED
RELEASED
~~~

No se crea una fila UNASSIGNED; la ausencia de assignment representa ese estado.

Pseudomodelo:

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceAssignmentStatus {
  ASSIGNED
  REPLACED
  RELEASED
}

model ServiceAssignment {
  id                   String                   @id @default(uuid()) @db.Uuid
  scheduledDepartureId String                   @db.Uuid
  vehicleId            String                   @db.Uuid
  driverId             String                   @db.Uuid
  routePathId          String                   @db.Uuid
  status               ServiceAssignmentStatus @default(ASSIGNED)
  assignedAt           DateTime                 @default(now()) @db.Timestamptz(3)
  releasedAt           DateTime?
  replacedById         String?                  @db.Uuid
  notes                String?
  createdAt            DateTime                 @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime                 @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture @relation(fields: [scheduledDepartureId], references: [id])
  vehicle            Vehicle            @relation(fields: [vehicleId], references: [id])
  driver             Driver             @relation(fields: [driverId], references: [id])
  routePath          RoutePath          @relation(fields: [routePathId], references: [id])

  @@index([scheduledDepartureId, status])
  @@index([vehicleId, status])
  @@index([driverId, status])
  @@index([routePathId, status])
  @@map("service_assignments")
}
~~~

Validaciones:

1. path activo;
2. misma línea;
3. misma dirección;
4. campus compatible;
5. vehículo disponible;
6. conductor disponible;
7. salida no cancelada;
8. sin solapamiento de recurso.

## 12. ServiceRun

ServiceRun es la ejecución real de una unidad concreta y referencia salida, assignment, path, vehículo y conductor.

Se recomienda crearlo al confirmar una assignment, en NOT_STARTED. Una salida publicada sin assignment conserva cero runs.

Estados:

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ServiceRunStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  SUSPENDED
  CANCELLED
  NO_SHOW
}
~~~

Pseudomodelo:

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ServiceRun {
  id                    String           @id @default(uuid()) @db.Uuid
  scheduledDepartureId  String           @db.Uuid
  assignmentId          String?          @unique @db.Uuid
  routePathId           String           @db.Uuid
  driverId              String           @db.Uuid
  vehicleId             String           @db.Uuid
  routePathCodeSnapshot String
  routePathNameSnapshot String
  driverNameSnapshot    String
  vehicleCodeSnapshot   String
  vehiclePlateSnapshot  String
  status                ServiceRunStatus @default(NOT_STARTED)
  startedAt             DateTime?
  endedAt               DateTime?
  startNotes            String?
  endNotes              String?
  createdAt             DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime         @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture @relation(fields: [scheduledDepartureId], references: [id])
  assignment         ServiceAssignment? @relation(fields: [assignmentId], references: [id])
  routePath          RoutePath           @relation(fields: [routePathId], references: [id])
  driver             Driver              @relation(fields: [driverId], references: [id])
  vehicle             Vehicle            @relation(fields: [vehicleId], references: [id])

  @@index([scheduledDepartureId, status])
  @@index([routePathId, status])
  @@index([driverId, status])
  @@index([vehicleId, status])
  @@map("service_runs")
}
~~~

Los FKs permiten integridad y los snapshots evitan que cambios posteriores reescriban la historia.

Flujo:

~~~text
ScheduledDeparture
       ↓
ServiceAssignment
       ↓
Driver Start
       ↓
ServiceRun IN_PROGRESS
       ↓
Driver Finish
       ↓
ServiceRun COMPLETED
~~~

## 13. Incidents / Deviations

Una desviación se asocia principalmente a ServiceRun:

~~~text
BUS-001
plannedPath = Vía Garzota
        ↓
ROUTE_DEVIATION
~~~

No se crea automáticamente otro RoutePath. El path planificado permanece histórico. GPS podrá añadir actualPath en una fase futura.

Tipos MVP:

~~~text
DELAY
VEHICLE_BREAKDOWN
ROUTE_DEVIATION
STOP_CLOSED
SERVICE_INTERRUPTION
OTHER
~~~

Estados:

~~~text
OPEN
RESOLVED
CANCELLED
~~~

Para evitar múltiples FKs opcionales en la incidencia, se recomienda una relación de target tipado:

~~~text
OperationalIncident
OperationalIncidentTarget
  targetType = SERVICE_LINE | ROUTE_PATH | STOP |
               SCHEDULED_DEPARTURE | SERVICE_RUN
  targetId
~~~

La aplicación valida targetId según targetType. No se implementa ahora.

## 14. Intercampus

Se recomienda modelarlo en ServiceLine, no crear una entidad paralela:

~~~text
ServiceLine.type = INTERCAMPUS
campusId = campus propietario/origen
destinationCampusId = campus destino
~~~

Esto mantiene el flujo Campus → Línea y reutiliza horarios, salidas, assignments y runs.

El registro actual Intercampus Centenario → María Auxiliadora tiene path y horarios demo, pero no mapping oficial. Debe permanecer UNKNOWN hasta aprobación de UPS.

No se duplica automáticamente en ambos campus. La navegación inicial usa campus propietario/origen y muestra destino.

## 15. Student UX

### Jerarquía

~~~text
Campus
  ↓
ServiceLine
  ↓
Direction
  ↓
ScheduledDeparture
  ↓
Buses de esa salida
  ↓
RoutePath humano
  ↓
Paradas del path
~~~

### Home

~~~text
Campus Centenario ▼

Próximos servicios

Ruta Norte       06:40   3 buses
Ruta Sur         06:40   2 buses
Ruta Este        08:30   1 bus
~~~

No se muestran siete Route legacy.

### Detalle

~~~text
Campus Centenario
Ruta Norte · Ida
06:40

BUS-001 — Vía Garzota — En recorrido
BUS-002 — Vía Samanes — Programado
BUS-003 — Vía Sauces — En recorrido
~~~

Cada bus muestra las paradas de su RoutePath.

### Estados

| Estado | Texto Student |
|---|---|
| PUBLISHED sin run iniciado | Programado |
| ASSIGNED | Unidad asignada, nunca En recorrido |
| IN_PROGRESS | En recorrido |
| COMPLETED | Finalizado |
| CANCELLED | Cancelado |
| SUSPENDED | Servicio interrumpido |
| Sin información reciente | Información operativa no actualizada |

La línea Ruta Norte de otro campus no se mezcla en la lista del campus seleccionado.

## 16. Admin UX

La jerarquía futura es:

~~~text
Dashboard
Campus
Rutas / líneas
Recorridos / paths
Paradas
Horarios
Salidas
Operación
Vehículos
Conductores
Avisos
Incidencias
Usuarios
Auditoría
~~~

### Campus

Crear, editar, activar/desactivar y consultar. No DELETE físico con historial.

### Líneas

Dentro de cada campus:

~~~text
Campus Centenario
├── Ruta Norte
├── Ruta Sur
└── Ruta Este
~~~

### Paths

~~~text
Ruta Norte
├── IDA
│   ├── Vía Garzota
│   ├── Vía Samanes
│   └── Vía Sauces
└── RETORNO
    └── Vía Terminal
~~~

Admin configura paradas y orden por path. Una modificación material crea un path nuevo.

### Salidas

~~~text
Ruta Norte / IDA / 06:40
  ├── BUS-001 + Driver A + Vía Garzota
  ├── BUS-002 + Driver B + Vía Samanes
  └── BUS-003 + Driver C + Vía Sauces
~~~

Este flujo debe ser central en Admin Web.

## 17. Student API

Superficie conceptual mínima:

~~~text
GET /mobile/campuses
GET /mobile/campuses/:id/service-lines
GET /mobile/service-lines/:id
GET /mobile/service-lines/:id/departures?direction=&serviceDate=
GET /mobile/departures/:id/runs
GET /mobile/runs/:id/path
GET /mobile/notices
~~~

Home agregado recomendado:

~~~text
GET /mobile/home?campusId=UUID&serviceDate=YYYY-MM-DD
~~~

Si campusId se omite, se usa la preferencia del estudiante. Si se envía, se valida que el campus esté activo.

Respuesta conceptual:

~~~json
{
  "campus": { "id": "uuid", "code": "CENTENARIO", "name": "Campus Centenario" },
  "serviceDate": "2026-08-28",
  "timezone": "America/Guayaquil",
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
        "runCount": 3,
        "inProgressRunCount": 2
      }
    }
  ]
}
~~~

No se implementan endpoints en esta fase.

## 18. Admin API

Módulos conceptuales:

~~~text
/admin/campuses
/admin/service-lines
/admin/route-paths
/admin/stops
/admin/schedule-patterns
/admin/service-calendars
/admin/service-exceptions
/admin/departures
/admin/assignments
/admin/operations
/admin/vehicles
/admin/drivers
/admin/notices
/admin/incidents
/admin/users
/admin/audit-logs
~~~

Operación:

~~~text
GET   /admin/operations/today
GET   /admin/departures?campusId=&serviceDate=
POST  /admin/departures/:id/assignments
PATCH /admin/assignments/:id/replace
PATCH /admin/assignments/:id/release
PATCH /admin/departures/:id/cancel
POST  /admin/departures/:id/incidents
~~~

Cada assignment debe recibir routePathId. Estos son diseños conceptuales.

## 19. Time Model

Se mantiene:

| Dato | Representación |
|---|---|
| serviceDate | PostgreSQL DATE |
| scheduledTime | PostgreSQL TIME local |
| timezone | America/Guayaquil |
| startedAt | timestamp UTC |
| endedAt | timestamp UTC |
| createdAt/updatedAt | timestamp UTC |
| API date | YYYY-MM-DD |
| API time | HH:mm |
| API date-time | ISO 8601 |

La salida combina fecha y hora local del calendario. No se almacena solo como UTC.

## 20. Constraints

### Catálogo

~~~text
Campus.code UNIQUE
ServiceLine(campusId, code) UNIQUE
RoutePath(serviceLineId, code) UNIQUE
RoutePathStop(routePathId, stopId) UNIQUE
RoutePathStop(routePathId, stopOrder) UNIQUE
~~~

### Intercampus

~~~text
CAMPUS_ROUTE → destinationCampusId IS NULL
INTERCAMPUS  → destinationCampusId IS NOT NULL
destinationCampusId != campusId
~~~

### Dirección y path

~~~text
RoutePath.serviceLineId = Departure.serviceLineId
RoutePath.direction     = Departure.direction
RoutePath.isActive      = true al asignar
~~~

### Salidas

~~~text
ScheduledDeparture(serviceLineId, direction, serviceDate, scheduledTime) UNIQUE
~~~

Esta unique no impide varios assignments/runs.

### Recursos

- Unique parcial para assignment activa del mismo vehículo en una salida.
- Unique parcial para assignment activa del mismo conductor en una salida.
- Transacción para solapamientos entre salidas.
- RoutePath no es exclusivo.
- Si Prisma no expresa CHECK parcial/temporal, se documenta en SQL de migración controlada posterior.

## 21. Historical Snapshot

Se elige para MVP:

1. RoutePath publicado no se edita destructivamente si tiene histórico.
2. Un cambio material crea otro path y archiva el anterior.
3. ServiceRun conserva routePathId y snapshots de código/nombre.
4. ServiceRun conserva IDs y snapshots de vehículo/conductor.
5. Un run iniciado no cambia por una edición de assignment.

No se copia la lista completa de paradas en cada run porque el path anterior queda archivado e inmutable.

RoutePathVersion se deja como evolución futura, no como requisito de esta corrección.

## 22. Legacy Compatibility

### Mapping

~~~text
Legacy Route
  → approved Campus + ServiceLine + RoutePath

Legacy Schedule
  → approved ServiceCalendar + SchedulePattern + ScheduleTime

Legacy RouteAssignment
  → exact time/path required → ScheduledDeparture + ServiceAssignment

Legacy Trip
  → exact departure/path required → ServiceRun
~~~

No se asumen equivalencias.

### Route

El mapping debe incluir:

~~~text
legacyRouteId
campusId
serviceLineId
routePathId
approvedBy
approvedAt
~~~

Mapear únicamente a ServiceLine perdería el camino físico.

### Assignment y Trip

Los registros actuales no tienen hora ni path. Se conservan en legacy hasta contar con vínculo inequívoco. No se crea una salida por proximidad ni se elige path por nota demo.

## 23. Favorites

Mobile actual guarda routeId legacy.

Estrategia:

1. mantener routeId durante la transición;
2. conservar mapping aprobado a campus, línea y path;
3. futura app guarda campusId + serviceLineId;
4. pathId solo si el estudiante marca un camino concreto;
5. mapping pendiente no invalida ni borra favoritos;
6. cambiar campus no elimina favoritos del otro campus.

La clave futura no puede ser solo Ruta Norte.

## 24. Feedback

El feedback actual conserva routeId y driverId opcional.

Evolución aditiva:

- agregar serviceRunId nullable;
- feedback nuevo puede calificar bus, conductor y path;
- no inventar run/path en históricos;
- routeId se conserva mientras haya consumidores legacy;
- feedback sobre salida sin run requiere decisión posterior.

## 25. Migration

Se mantiene:

~~~text
EXPAND
  ↓
BACKFILL APROBADO
  ↓
DUAL READ
  ↓
SWITCH
  ↓
CONTRACT
~~~

### Expand

Agregar de forma aditiva Campus, ServiceLine, RoutePath, RoutePathStop, calendarios, patterns, departures, assignments y runs.

### Backfill

Solo con mapping aprobado:

~~~text
legacyRouteId → campusId → serviceLineId → routePathId
~~~

Debe ser idempotente, auditable y detenerse ante mapping incompleto.

### Dual read

El mapper traduce el dominio nuevo a Legacy MobileRouteResponse. currentOperation singular se conserva para legacy, mientras el endpoint nuevo entrega la colección de buses.

IN_PROGRESS solo proviene de ServiceRun iniciado.

### Switch y Contract

Se activa por entorno/cohorte después de comparar respuestas. El retiro de legacy es una fase posterior.

## 26. Corrections to Phase 5

### Vigente

- monolito modular NestJS;
- PostgreSQL como fuente de verdad;
- horarios explícitos para MVP;
- calendario con excepciones;
- Direction IDA/RETORNO;
- salida separada de operación;
- múltiples buses;
- snapshots históricos;
- compatibilidad Mobile;
- feedback y favoritos preservados;
- Driver Auth/GPS diferidos;
- expand → backfill → dual read → switch → contract.

### Cambia

| Tema | Diseño anterior | Corrección |
|---|---|---|
| Contexto | ServiceLine | Campus → ServiceLine |
| Identidad | code global | campusId + code |
| Camino | RouteVariant | RoutePath |
| Paradas | RouteVariantStop | RoutePathStop |
| Programación | ligada a RouteVariant | ServiceLine + Direction; path opcional solo si negocio publica por path |
| Salida | podía tener variante/camino implícito | no tiene path único |
| Assignment | salida + bus + conductor | salida + bus + conductor + RoutePath |
| Intercampus | pendiente | ServiceLine INTERCAMPUS |
| Student | línea primero | campus primero |
| Favoritos | línea/variante | campus + línea; path opcional |

### RouteVariant

Se elimina del target conceptual. No existe una tabla implementada que deba migrarse.

Su semántica se divide:

- línea, dirección y programación → ServiceLine, Direction y SchedulePattern;
- camino y paradas → RoutePath y RoutePathStop.

## 27. Pseudo Prisma

Todo este bloque es diseño y no se copia a schema.prisma.

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED

enum Direction {
  IDA
  RETORNO
}

enum ServiceLineType {
  CAMPUS_ROUTE
  INTERCAMPUS
}

enum SchedulePatternType {
  EXPLICIT_TIMES
  FREQUENCY
}

enum SchedulePatternStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ServiceExceptionType {
  NO_SERVICE
  SPECIAL_SCHEDULE
}

enum ScheduledDepartureStatus {
  PLANNED
  PUBLISHED
  CANCELLED
  NO_SERVICE
}

enum ServiceAssignmentStatus {
  ASSIGNED
  REPLACED
  RELEASED
}

enum ServiceRunStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  SUSPENDED
  CANCELLED
  NO_SHOW
}

model Campus {
  id        String   @id @default(uuid()) @db.Uuid
  code      String   @unique
  name      String
  address   String?
  latitude  Decimal? @db.Decimal(10, 7)
  longitude Decimal? @db.Decimal(10, 7)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  serviceLines        ServiceLine[] @relation("CampusServiceLines")
  destinationLines    ServiceLine[] @relation("CampusDestinationLines")
  studentsWithDefault User[]       @relation("StudentDefaultCampus")

  @@map("campuses")
}

model ServiceLine {
  id                  String          @id @default(uuid()) @db.Uuid
  campusId            String          @db.Uuid
  code                String
  name                String
  description         String?
  type                ServiceLineType @default(CAMPUS_ROUTE)
  destinationCampusId String?         @db.Uuid
  isActive            Boolean         @default(true)
  createdAt            DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime        @updatedAt @db.Timestamptz(3)

  campus            Campus               @relation("CampusServiceLines", fields: [campusId], references: [id])
  destinationCampus Campus?              @relation("CampusDestinationLines", fields: [destinationCampusId], references: [id])
  paths             RoutePath[]
  patterns          SchedulePattern[]
  departures        ScheduledDeparture[]

  @@unique([campusId, code])
  @@index([campusId, isActive])
  @@map("service_lines")
}

model RoutePath {
  id                       String    @id @default(uuid()) @db.Uuid
  serviceLineId            String    @db.Uuid
  code                     String
  displayName              String
  direction                Direction
  originName               String?
  destinationName          String?
  description              String?
  estimatedDurationMinutes Int?
  isActive                 Boolean   @default(true)
  createdAt                DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime  @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine         @relation(fields: [serviceLineId], references: [id])
  stops       RoutePathStop[]
  patterns    SchedulePattern[]
  assignments ServiceAssignment[]
  runs        ServiceRun[]

  @@unique([serviceLineId, code])
  @@index([serviceLineId, direction, isActive])
  @@map("route_paths")
}

model RoutePathStop {
  id                         String   @id @default(uuid()) @db.Uuid
  routePathId               String   @db.Uuid
  stopId                    String   @db.Uuid
  stopOrder                 Int
  estimatedMinutesFromStart Int?
  notes                      String?
  isActive                  Boolean  @default(true)

  routePath RoutePath @relation(fields: [routePathId], references: [id])
  stop      Stop      @relation(fields: [stopId], references: [id])

  @@unique([routePathId, stopId])
  @@unique([routePathId, stopOrder])
  @@index([routePathId, stopOrder])
  @@index([stopId])
  @@map("route_path_stops")
}

model ServiceCalendar {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  validFrom  DateTime @db.Date
  validUntil DateTime @db.Date
  timezone   String   @default("America/Guayaquil")
  monday     Boolean  @default(false)
  tuesday    Boolean  @default(false)
  wednesday  Boolean  @default(false)
  thursday   Boolean  @default(false)
  friday     Boolean  @default(false)
  saturday   Boolean  @default(false)
  sunday     Boolean  @default(false)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @db.Timestamptz(3)

  patterns   SchedulePattern[]
  exceptions ServiceException[]

  @@index([validFrom, validUntil, isActive])
  @@map("service_calendars")
}

model ServiceException {
  id                String               @id @default(uuid()) @db.Uuid
  serviceCalendarId String               @db.Uuid
  serviceDate       DateTime             @db.Date
  type              ServiceExceptionType
  reason            String
  createdById       String?              @db.Uuid
  createdAt         DateTime             @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime             @updatedAt @db.Timestamptz(3)

  calendar ServiceCalendar @relation(fields: [serviceCalendarId], references: [id])

  @@unique([serviceCalendarId, serviceDate])
  @@index([serviceDate, type])
  @@map("service_exceptions")
}

model SchedulePattern {
  id                String                @id @default(uuid()) @db.Uuid
  serviceLineId     String                @db.Uuid
  serviceCalendarId String                @db.Uuid
  direction         Direction
  type              SchedulePatternType   @default(EXPLICIT_TIMES)
  status            SchedulePatternStatus @default(DRAFT)
  routePathId       String?               @db.Uuid
  name              String?
  isActive          Boolean               @default(true)
  createdAt         DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime              @updatedAt @db.Timestamptz(3)

  serviceLine     ServiceLine         @relation(fields: [serviceLineId], references: [id])
  serviceCalendar ServiceCalendar     @relation(fields: [serviceCalendarId], references: [id])
  routePath       RoutePath?           @relation(fields: [routePathId], references: [id])
  times           ScheduleTime[]
  departures      ScheduledDeparture[]

  @@index([serviceLineId, direction, status, isActive])
  @@index([serviceCalendarId])
  @@index([routePathId])
  @@map("schedule_patterns")
}

model ScheduleTime {
  id                     String   @id @default(uuid()) @db.Uuid
  schedulePatternId      String   @db.Uuid
  departureTime          DateTime @db.Time(0)
  approximateArrivalTime DateTime? @db.Time(0)
  isActive               Boolean  @default(true)

  pattern SchedulePattern @relation(fields: [schedulePatternId], references: [id])

  @@unique([schedulePatternId, departureTime])
  @@index([schedulePatternId, departureTime])
  @@map("schedule_times")
}

model ScheduledDeparture {
  id                 String                   @id @default(uuid()) @db.Uuid
  serviceLineId      String                   @db.Uuid
  schedulePatternId  String?                  @db.Uuid
  direction          Direction
  serviceDate        DateTime                 @db.Date
  scheduledTime      DateTime                 @db.Time(0)
  status             ScheduledDepartureStatus @default(PLANNED)
  cancellationReason String?
  createdAt          DateTime                 @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime                 @updatedAt @db.Timestamptz(3)

  serviceLine ServiceLine           @relation(fields: [serviceLineId], references: [id])
  pattern     SchedulePattern?      @relation(fields: [schedulePatternId], references: [id])
  assignments ServiceAssignment[]
  runs        ServiceRun[]

  @@unique([serviceLineId, direction, serviceDate, scheduledTime])
  @@index([serviceDate, status])
  @@index([serviceLineId, direction, serviceDate, scheduledTime])
  @@map("scheduled_departures")
}

model ServiceAssignment {
  id                   String                   @id @default(uuid()) @db.Uuid
  scheduledDepartureId String                   @db.Uuid
  vehicleId            String                   @db.Uuid
  driverId             String                   @db.Uuid
  routePathId          String                   @db.Uuid
  status               ServiceAssignmentStatus @default(ASSIGNED)
  assignedAt           DateTime                 @default(now()) @db.Timestamptz(3)
  releasedAt           DateTime?
  replacedById         String?                  @db.Uuid
  notes                String?
  createdAt            DateTime                 @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime                 @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture @relation(fields: [scheduledDepartureId], references: [id])
  vehicle            Vehicle            @relation(fields: [vehicleId], references: [id])
  driver             Driver             @relation(fields: [driverId], references: [id])
  routePath          RoutePath          @relation(fields: [routePathId], references: [id])

  @@index([scheduledDepartureId, status])
  @@index([vehicleId, status])
  @@index([driverId, status])
  @@index([routePathId, status])
  @@map("service_assignments")
}

model ServiceRun {
  id                    String           @id @default(uuid()) @db.Uuid
  scheduledDepartureId  String           @db.Uuid
  assignmentId          String?          @unique @db.Uuid
  routePathId           String           @db.Uuid
  driverId              String           @db.Uuid
  vehicleId             String           @db.Uuid
  routePathCodeSnapshot String
  routePathNameSnapshot String
  driverNameSnapshot    String
  vehicleCodeSnapshot   String
  vehiclePlateSnapshot  String
  status                ServiceRunStatus @default(NOT_STARTED)
  startedAt             DateTime?
  endedAt               DateTime?
  startNotes            String?
  endNotes              String?
  createdAt             DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime         @updatedAt @db.Timestamptz(3)

  scheduledDeparture ScheduledDeparture @relation(fields: [scheduledDepartureId], references: [id])
  assignment         ServiceAssignment? @relation(fields: [assignmentId], references: [id])
  routePath          RoutePath           @relation(fields: [routePathId], references: [id])
  driver             Driver              @relation(fields: [driverId], references: [id])
  vehicle             Vehicle            @relation(fields: [vehicleId], references: [id])

  @@index([scheduledDepartureId, status])
  @@index([routePathId, status])
  @@index([driverId, status])
  @@index([vehicleId, status])
  @@map("service_runs")
}
~~~

El pseudocódigo no se ejecuta con Prisma y no modifica el schema real.

## 28. Implementation Subphases

### 5A — Schema Foundation

Agregar de forma aditiva Campus, ServiceLine, RoutePath y RoutePathStop después de aprobar códigos e identidad.

### 5B — Calendars + SchedulePattern

Agregar calendarios, excepciones y horarios explícitos. No frecuencia completa.

### 5C — ScheduledDeparture + Assignment + ServiceRun

Agregar salidas, assignments con path, runs, estados, reemplazos y validación de recursos.

### 5D — Compatibility Layer

Mantener endpoints legacy, mapper, Home nuevo, favoritos, feedback y shadow read.

### 5E — Admin API

Campus, líneas, paths, calendarios, horarios, salidas, assignments, operación, avisos e incidencias.

### 5F — Approved Backfill

Ejecutar solo con mapping campus + línea + path aprobado, idempotente y auditable.

### 6 — Student UX Restructuring

Campus → Línea → Ida/Retorno → Salida → Buses → Path → Paradas.

### 7 — Admin Web

Construir la herramienta administrativa sobre la misma separación.

### 8 — Driver

Driver Auth e inicio autorizado sobre ServiceRun.

### 9 — GPS / realtime

Muestras de ubicación, actualPath, ETA y tiempo real.

## 29. Blockers

### No bloquea el diseño

- Driver Auth.
- GPS.
- Frecuencia futura.
- Incidencias avanzadas.
- Roles avanzados.
- Catálogo final de buses si no hay backfill.

### Debe aprobarse antes de implementar schema foundation

- códigos de campus;
- significado de ServiceLine.type;
- comportamiento de Intercampus;
- códigos/displayName de paths;
- necesidad de defaultCampusId en la primera migración.

### Bloquea backfill

- mapping legacy → campus;
- mapping legacy → ServiceLine;
- mapping legacy → RoutePath;
- nombres y coordenadas oficiales de paradas;
- horarios y calendario oficiales.

## 30. GO / NO-GO

### GO DOMAIN MODEL

GO. Campus + ServiceLine + RoutePath representa el escenario confirmado sin duplicar líneas ni salidas.

### GO SCHEMA FOUNDATION DESIGN

GO. El diseño de modelos, relaciones, constraints, tiempos y compatibilidad está suficientemente definido.

### GO SCHEMA FOUNDATION IMPLEMENTATION

NO-GO ahora. La autorización vigente es únicamente diseño.

Como recomendación futura, la base Campus + ServiceLine + RoutePath + RoutePathStop puede agregarse aditivamente sin backfill inmediato, después de aprobar identidad y códigos.

### GO MIGRATION

NO-GO. Falta mapping oficial.

### GO BACKFILL

NO-GO. Falta mapping aprobado legacy → campus → línea → path.

### Estado final

~~~text
GO DOMAIN MODEL:                    YES
GO SCHEMA FOUNDATION DESIGN:        YES
GO SCHEMA FOUNDATION IMPLEMENTATION: NO — not authorized now
GO MIGRATION:                       NO
GO BACKFILL:                        NO
~~~

RouteVariant queda REMOVE del target conceptual y RoutePath queda como camino físico administrable por assignment.

No se realizaron cambios de código, Prisma, OpenAPI, Mobile, base de datos, apps/web, commit, push ni PR.
