# UPS GO — Phase 5C Operational Domain Design

**Estado:** DESIGN ONLY / NO-GO IMPLEMENTATION

**Baseline certificado:** 87857d69f6e7187d0f3076c9f58e8bdb87a1714d

**Fecha:** 2026-08-28

## 1. Executive Verdict

La Fase 5C queda cerrada como diseño conceptual, no como autorización de
implementación.

El dominio conserva tres niveles separados:

~~~text
PROGRAMACIÓN
ServiceCalendar → SchedulePattern → ScheduleTime
                → ScheduleJourneyTemplate → ScheduledStopTime

PLANIFICACIÓN OPERATIVA
ScheduledDeparture → ServiceAssignment

EJECUCIÓN REAL
ServiceRun
~~~

Decisiones principales:

- ScheduledDeparture se identifica por sourceScheduleTimeId + serviceDate.
- También conserva serviceLineId, direction y scheduledTime como snapshots para
  consulta e histórico.
- Una salida puede conservar 1..N ScheduleJourneyTemplate mediante una relación
  puente.
- ServiceAssignment apunta al template, no solamente al RoutePath.
- Puede haber 0..N assignments por salida y varios buses con el mismo template.
- ServiceRun nace cuando el bus comienza realmente.
- Los conflictos de vehículo/conductor usan la ventana del timetable y una
  transacción con locks apropiados.
- El dominio nuevo convive inicialmente con RouteAssignment y Trip.

El schema, las migraciones, los contratos, API, Mobile, seed, base de datos y
apps/web permanecen sin tocar.

## 2. Scope

Esta fase diseña ScheduledDeparture, materialización, reconciliación,
ServiceAssignment, reemplazos, conflictos, ServiceRun, snapshots, concurrencia,
UX, APIs conceptuales y compatibilidad legacy.

No implementa:

- apps/api, apps/mobile ni apps/web;
- schema.prisma ni migraciones;
- OpenAPI o endpoints existentes;
- seed, fixture ejecutable o backfill;
- Driver Auth;
- GPS, telemetría, ETA o geofencing.

Los documentos de Fase 5B y 5B.1 son autoridad para recurrencia, excepciones,
ScheduleJourneyTemplate y ScheduledStopTime. El JSON de Guayaquil sigue siendo
evidencia/fixture no productivo.

## 3. Source Domain

Una salida operacional nace de una regla publicada:

~~~text
ServiceCalendar vigente y PUBLISHED
  → SchedulePattern aplicable a serviceDate
      → ScheduleTime
          → ScheduleJourneyTemplate[]
              → RoutePath
              → ScheduledStopTime[]
~~~

El timetable permite calcular:

~~~text
plannedStart = serviceDate + ScheduleTime.departureTime
plannedEnd   = plannedStart + max(ScheduledStopTime.offsetMinutes)
~~~

El cálculo usa America/Guayaquil; serviceDate es fecha civil y no se obtiene de
medianoche UTC. Los eventos reales usan TIMESTAMPTZ.

El origen no es un Route, RouteAssignment o Trip legacy elegido por proximidad.
Ese mapping requiere aprobación explícita.

La referencia de Guayaquil aporta 3 líneas, 14 paradas, 7 paths, 15 servicios,
54 viajes y 357 stop times. Sus secuencias auditadas son válidas, pero los
offsets varían por salida; por eso el timetable no puede reducirse a una hora
por línea.

## 4. ScheduledDeparture

ScheduledDeparture representa una salida lógica concreta para una fecha:

~~~text
Ruta Norte / IDA / 2026-09-01 / 06:40
~~~

No representa vehículo, conductor, bus asignado, camino único, viaje iniciado,
posición ni ETA.

Su estado mínimo SCHEDULED significa que fue materializada desde una
programación publicada y es elegible para consulta/planificación. CANCELLED
retira la oferta de esa fecha sin borrar la fila.

La salida conserva templates aplicables mediante un puente. No se coloca un
routePathId único en la salida.

## 5. Departure Identity

### 5.1 Identidad recomendada

~~~text
UNIQUE(sourceScheduleTimeId, serviceDate)
~~~

sourceScheduleTimeId identifica el pattern/calendar/exception concreto y
serviceDate la fecha local de servicio.

No se recomienda como identidad:

~~~text
serviceLineId + direction + serviceDate + scheduledTime
~~~

Eso describe una hora visible, pero no necesariamente una única fuente.

### 5.2 Snapshots

Se conservan explícitamente:

~~~text
serviceLineId
direction
scheduledTime
~~~

La duplicación es acotada y deliberada: acelera queries diarias, preserva el
valor publicado y permite reporting si cambia la regla fuente. campusId se
deriva de ServiceLine y no se duplica en este MVP.

### 5.3 Source traceability

La FK principal es sourceScheduleTimeId, desde la que se deriva:

~~~text
ScheduleTime → SchedulePattern → ServiceCalendar → ServiceLine
~~~

No se duplican sourcePatternId ni sourceCalendarId. La FK debe ser RESTRICT;
una regla usada por histórico no se borra ni se edita destructivamente.

## 6. Nominal Time Collisions

El dataset de referencia contiene 14 colisiones de:

~~~text
lineCode + direction + departureTime
~~~

Caso crítico:

~~~text
URB_LA_JOYA / IDA / 16:50 / lunes-viernes
  REGULAR
  ADMINISTRATIVOS_ESTUDIANTES
~~~

La misma hora no demuestra que sea la misma oferta. Por eso cada
sourceScheduleTimeId + serviceDate genera su propia salida hasta que negocio
apruebe una fusión. No se elige un perfil, path o tabla por nombre.

Si en el futuro se confirma que varias fuentes son una sola oferta pública, se
podrá crear una agrupación auditable que conserve todos los source IDs y
resuelva qué template se muestra. No se hace en este MVP.

## 7. Materialization

| Opción | Beneficio | Riesgo |
|---|---|---|
| Runtime only | sin filas futuras | dificulta auditoría y assignments |
| período completo | vista administrativa simple | ruido y reconciliaciones extensas |
| ventana controlada | equilibrio operativo y de costo | requiere job explícito |

Se recomienda ventana controlada:

~~~text
materializeDepartures(fromDate, toDate, serviceLineId?)
~~~

materializationHorizonDays queda como configuración futura; no se fija ahora un
valor oficial de 14 o 30 días.

El proceso debe validar fecha/zona, resolver calendario y excepciones, excluir
NO_SERVICE, exigir templates completos, crear por source/date de forma
idempotente, asociar templates, reportar resultados y auditar actor/rango. No
debe escribir fuera del rango, borrar filas ni fusionar colisiones.

La materialización es servicio interno o acción Admin protegida con rango
explícito, no un CRUD público genérico.

## 8. Reconciliation

Solo se reconcilia futuro editable. No se reescriben salidas pasadas,
assignments históricos ni runs iniciados/terminados.

### NO_SERVICE

~~~text
si no existe departure → no crearla
si existe futura editable → CANCELLED
si tiene assignment sin run → liberar con auditoría
si tiene run iniciado → elevar conflicto, no cancelar destructivamente
~~~

### REPLACE_TIMES

Para sustituir horarios se cancelan las salidas regulares futuras editables,
se liberan/reemplazan assignments no iniciadas, se materializan las fuentes de
excepción y se audita el diff. Nunca se recicla una fila histórica para otra
salida.

### ADD_TIMES

Se agregan las nuevas fuentes y la unique source/date evita duplicarlas. La
deduplicación entre fuentes nominalmente iguales requiere decisión de negocio.

## 9. ServiceAssignment

ServiceAssignment representa:

~~~text
esta ScheduledDeparture
  + este ScheduleJourneyTemplate
  + este Vehicle y este Driver
~~~

Debe apuntar al template porque este conserva RoutePath y la tabla esperada de
paradas. Apuntar solo a routePathId pierde qué timetable debía ejecutar el bus.

Campos conceptuales:

~~~text
id
scheduledDepartureId
scheduleJourneyTemplateId
vehicleId
driverId
status
assignedAt
releasedAt?
replacesAssignmentId?
notes?
createdAt
updatedAt
~~~

No se agrega routePathId como segunda fuente de verdad; se deriva del template.

## 10. Assignment Lifecycle

### Estados mínimos

~~~text
ASSIGNED
RELEASED
REPLACED
NO_SHOW
~~~

No existe UNASSIGNED: ausencia de fila significa no asignado. No se usa
IN_PROGRESS; operación real pertenece a ServiceRun.

NO_SHOW describe un recurso asignado que no inició, sin crear un run ficticio.
Si el negocio prefiere no distinguirlo, puede ser RELEASED con
releaseReason=NO_SHOW; debe decidirse antes del schema.

### Reemplazo y liberación

~~~text
Assignment A / BUS-001 / ASSIGNED
  → mantenimiento
Assignment A / REPLACED
Assignment B / BUS-002 / ASSIGNED
  → replacesAssignmentId = A
~~~

La assignment anterior no se muta para fingir que siempre tuvo el nuevo bus.
Toda sustitución, cambio de driver o liberación requiere actor, motivo,
timestamp y AuditLog.

## 11. Resource Conflicts

Para cada template:

~~~text
plannedStart = serviceDate + ScheduleTime.departureTime
plannedEnd   = plannedStart + max(offsetMinutes)
~~~

El intervalo se calcula en hora local y se convierte a un instante comparable.
Hasta aprobar un turnaround, el conflicto es solo solapamiento estricto:

~~~text
[startA, endA) overlaps [startB, endB)
~~~

No se inventa buffer. operationalTurnaroundMinutes queda como configuración
futura.

Un Vehicle o Driver no puede tener assignments activas con ventanas
incompatibles. Puede atender varias salidas no solapadas y varios caminos.
Driver.assignedVehicleId legacy no es fuente de disponibilidad diaria.

Vehicle/Driver MAINTENANCE o INACTIVE bloquea asignación/inicio según los
catálogos existentes; no se rediseñan aquí.

## 12. ServiceRun

ServiceRun representa la ejecución real de un bus concreto. Nace al comenzar
realmente, no al materializar ni al asignar; así no se crean runs NOT_STARTED.

Conoce scheduledDepartureId, serviceAssignmentId,
scheduleJourneyTemplateId, camino, driver, vehicle, timestamps y snapshots. No
es una copia completa del timetable, posición GPS ni ETA.

## 13. Run Lifecycle

Estados:

~~~text
IN_PROGRESS
COMPLETED
SUSPENDED
ABORTED
~~~

No se usa NOT_STARTED; antes del inicio existe assignment. No se usa CANCELLED
para un run que nunca nació.

~~~text
IN_PROGRESS → COMPLETED
IN_PROGRESS → SUSPENDED → IN_PROGRESS
IN_PROGRESS → ABORTED
SUSPENDED    → ABORTED
~~~

ABORTED es terminal. Si otro bus continúa el servicio, usa otra assignment y
otro run; no se transforma el run A en el bus B.

El start futuro valida assignment activa, ownership del driver, departure no
cancelada, template perteneciente a la departure, recursos activos, ausencia de
run previo y ausencia de conflictos activos.

## 14. Historical Snapshot

Se combinan FKs y snapshots mínimos:

~~~text
FKs: scheduledDepartureId, serviceAssignmentId,
     scheduleJourneyTemplateId, routePathId, driverId, vehicleId

Snapshots: routePathCodeSnapshot, routePathNameSnapshot,
           driverNameSnapshot, vehiclePlateSnapshot, vehicleCodeSnapshot
~~~

Los IDs preservan trazabilidad y los snapshots reconstruyen valores visibles.
No se copia toda la lista de paradas en JSON.

Templates y paths usados por publicación no se editan destructivamente. Un
cambio material crea una nueva regla/template y archiva el anterior.
Desviaciones temporales no modifican RoutePath; se registran en
OperationalIncident y, posteriormente, GPS podrá almacenar la traza.

Feedback futuro puede añadir serviceRunId nullable y mantener
legacyRouteId/driverId; no se inventan vínculos históricos.

## 15. Timetable Integration

~~~text
ServiceCalendar
↓
SchedulePattern
↓
ScheduleTime
├── ScheduleJourneyTemplate A → RoutePath A + stop times
└── ScheduleJourneyTemplate B → RoutePath B + stop times

ScheduleTime + serviceDate + source
↓
ScheduledDeparture
├── ServiceAssignment A → Vehicle + Driver + Template A → ServiceRun A
└── ServiceAssignment B → Vehicle + Driver + Template B → ServiceRun B
~~~

Invariantes:

~~~text
template.scheduleTimeId == departure.sourceScheduleTimeId
template.routePath.serviceLineId == departure.serviceLineId
template.routePath.direction == departure.direction
~~~

La assignment solo utiliza uno de los templates asociados. Una FK aislada no
es suficiente para aceptar un template de otra línea.

## 16. Student Visibility

| Estado de dominio | Presentación |
|---|---|
| departure SCHEDULED, sin run | Programado |
| assignment sin run | sigue Programado; vehículo opcional |
| run IN_PROGRESS | En recorrido |
| run COMPLETED | no activo |
| departure CANCELLED | Cancelado |
| NO_SERVICE | Sin servicio |

Solo ServiceRun.IN_PROGRESS habilita En recorrido. Una salida puede mostrar
varios buses, caminos y runs sin convertirlos en un único bus ficticio.

El Mobile legacy usa currentOperation singular. Durante transición:

- conserva su shape;
- se construye solo desde ServiceRun.IN_PROGRESS (o Trip.IN_PROGRESS
  mientras la ruta sea legacy);
- si hay varios runs activos, el mapper escoge uno determinísticamente por
  startedAt descendente y tie-breaker estable;
- una API nueva entrega activeRuns[].

## 17. Admin Operations

El agregado diario futuro será:

~~~text
GET /admin/operations/today
~~~

Debe mostrar línea, sentido, hora, source, templates, ventanas, assignments,
runs, conflictos e incidencias en una respuesta agregada.

Comandos conceptuales:

~~~text
GET   /admin/departures?serviceLineId=&serviceDate=&direction=
POST  /admin/departures/:id/assignments
PATCH /admin/assignments/:id/replace
PATCH /admin/assignments/:id/release
PATCH /admin/departures/:id/cancel
~~~

Admin debe poder asignar múltiples buses al mismo template, reemplazar sin
destruir historial, ver NO_SHOW, runs suspendidos y colisiones nominales.
Todos los comandos requieren RBAC y auditoría; no son CRUD ciego.

## 18. Driver Compatibility

Driver Auth queda diferido. Contrato futuro conceptual:

~~~text
POST /driver/runs/start
POST /driver/runs/:id/finish
GET  /driver/runs/current
~~~

El start deriva el driver del contexto autenticado y valida ownership; no confía
solo en un ID enviado por cliente.

Durante transición permanecen intactos:

~~~text
GET  /driver/me/assignments/today
POST /driver/trips/start
POST /driver/trips/:id/finish
GET  /driver/trips/current
~~~

Un adapter futuro puede traducir el dominio nuevo; no se implementa aquí.

## 19. Legacy Compatibility

~~~text
RouteAssignment legacy → ServiceAssignment nuevo, solo con mapping aprobado
Trip legacy            → ServiceRun nuevo, solo con vínculo inequívoco
Schedule legacy        → ScheduleTime y template si existe fuente de stops
Route legacy           → ServiceLine + RoutePath aprobados
~~~

No se eliminan ni renombran RouteAssignment o Trip. Legacy sigue como lectura
pública; el dominio nuevo se valida en shadow read y las diferencias se reportan
antes de cualquier switch.

No se hace backfill en 5C. Favoritos conservan routeId; feedback conserva
legacyRouteId y puede recibir serviceRunId nullable posteriormente.

## 20. Concurrency

Asignar un recurso requiere una transacción que:

1. valide departure, template, ownership y estados;
2. adquiera locks de Vehicle y Driver en orden determinístico;
3. consulte assignments activas y ventanas;
4. rechace solapamientos;
5. cree assignment y auditoría atómicamente.

SERIALIZABLE es la opción conservadora para comandos críticos. Un
P2034/serialization failure se convierte en conflicto reintentable limitado.

Para start concurrente se bloquea la assignment, se verifica ausencia de run, se
crea uno y UNIQUE(serviceAssignmentId) actúa como barrera final.

Una exclusion constraint de rangos solo se considera si las ventanas se
persisten de forma confiable. Para el MVP se recomienda híbrido:

- unique/partial indexes para duplicados obvios;
- transacción y locks para conflictos derivados de relaciones;
- exclusion constraint posterior si el modelo la justifica.

## 21. Constraints

### ScheduledDeparture

~~~text
UNIQUE(sourceScheduleTimeId, serviceDate)
FK sourceScheduleTimeId → ScheduleTime RESTRICT
FK serviceLineId        → ServiceLine RESTRICT
serviceDate             → DATE
scheduledTime           → TIME
status                  → SCHEDULED | CANCELLED
~~~

### Template bridge

~~~text
UNIQUE(scheduledDepartureId, scheduleJourneyTemplateId)
template.scheduleTimeId == departure.sourceScheduleTimeId
template.path.line == departure.serviceLineId
template.path.direction == departure.direction
~~~

No unique sobre departure + routePath que impida múltiples templates o versiones
auditables.

### Assignment

~~~text
FK departure, template, vehicle, driver → RESTRICT
active + same departure + same vehicle → reject
active + same departure + same driver  → reject
~~~

No UNIQUE(departure, template): varios buses pueden usar el mismo template.

### Run

~~~text
UNIQUE(serviceAssignmentId)
FK serviceAssignmentId → ServiceAssignment RESTRICT
status → IN_PROGRESS | COMPLETED | SUSPENDED | ABORTED
~~~

Prisma no debe ocultar partial indexes, checks cruzados o exclusion constraints
SQL. No se usa CASCADE para borrar operación histórica.

## 22. Time Model

| Dato | Representación |
|---|---|
| serviceDate | PostgreSQL DATE |
| scheduledTime | PostgreSQL TIME local |
| offsetMinutes | INT en ScheduledStopTime |
| plannedStart/End | derivado en America/Guayaquil |
| startedAt/endedAt | TIMESTAMPTZ |
| API date/time | YYYY-MM-DD / HH:mm |
| API date-time | ISO 8601 |

No se usa medianoche UTC como identidad. Un offset posterior a medianoche
avanza el instante, pero conserva la fecha de salida.

## 23. APIs

Esta sección es diseño conceptual y no modifica OpenAPI.

### Student

~~~text
GET /mobile/home?campusId=&serviceDate=
GET /mobile/campuses/:id/service-lines
GET /mobile/service-lines/:id/departures?direction=&serviceDate=
GET /mobile/departures/:id
GET /mobile/departures/:id/runs
~~~

### Admin

~~~text
GET   /admin/operations/today
GET   /admin/departures?serviceLineId=&serviceDate=
POST  /admin/departures/:id/assignments
PATCH /admin/assignments/:id/replace
PATCH /admin/assignments/:id/release
PATCH /admin/departures/:id/cancel
~~~

### Driver

~~~text
POST /driver/runs/start
POST /driver/runs/:id/finish
GET  /driver/runs/current
~~~

Todos son contratos conceptuales, no endpoints nuevos.

## 24. Migration Strategy

La opción recomendada es equilibrada y aditiva:

~~~text
EXPAND → fixture DEV + shadow read → mapping aprobado
       → backfill separado → dual read → switch por cohorte → contract
~~~

La futura migración no reinterpretará legacy. El backfill requiere catálogo,
vigencias, tablas por parada, resolución de perfiles, dry run aislado, reporte
de ambiguos y rollback sin DELETE productivo.

RouteAssignment/Trip no se convierten por nombre, nota demo o cercanía.

## 25. Options

| Opción | Descripción | Veredicto |
|---|---|---|
| Conservadora | extender RouteAssignment y Trip | perpetúa mezcla y no resuelve source |
| Equilibrada | dominio nuevo paralelo + adapters | recomendada |
| Agresiva | reemplazo directo de legacy | rechazada por riesgo |

La opción equilibrada conserva contratos, permite rollback y da tiempo a comparar
Student/Admin/Driver antes del switch.

## 26. Implementation Subphases

No son autorización de ejecución.

### 5C-A — ScheduledDeparture

Entidades aditivas, source/date idempotency, snapshots, bridge y auditoría.

### 5C-B — Materializer

Resolver de calendario, ventana, excepciones, reconciliación y dry run.

### 5C-C — ServiceAssignment

Asignar, reemplazar, liberar, NO_SHOW, RBAC y conflictos.

### 5C-D — ServiceRun

Start transaccional, finish, suspensión, aborto, snapshots e incidents hook.

### 5C-E — Compatibility adapters

Driver legacy, currentOperation, Student activeRuns[], feedback y rollout.

GPS, Driver Auth y ETA necesitan decisiones posteriores.

## 27. Blockers

No bloquean diseño: Driver Auth, GPS, realtime, coordenadas definitivas y
apps/web.

Bloquean implementación/backfill:

1. Fase 5B aún no implementada;
2. calendario y fechas oficiales;
3. semántica de perfiles y 14 colisiones;
4. política de una departure con varias fuentes;
5. catálogo oficial de campus, líneas, paths y stops;
6. constraints cruzados template/departure/path;
7. versionado de templates publicados;
8. política de NO_SHOW;
9. horizonte de materialización;
10. cancelación con assignments existentes;
11. mapping de 90 Schedule, RouteAssignment y Trip;
12. contratos versionados y ensayo aislado;
13. autorización separada para fixture, migración y backfill.

## 28. Pseudo Prisma

El bloque es DESIGN ONLY — NOT IMPLEMENTED. No autoriza editar schema.prisma,
generar cliente ni migrar.

~~~prisma
// DESIGN ONLY — NOT IMPLEMENTED
enum ScheduledDepartureStatus {
  SCHEDULED
  CANCELLED
}

enum ServiceAssignmentStatus {
  ASSIGNED
  RELEASED
  REPLACED
  NO_SHOW
}

enum ServiceRunStatus {
  IN_PROGRESS
  COMPLETED
  SUSPENDED
  ABORTED
}

model ScheduledDeparture {
  id                   String                   @id @default(uuid()) @db.Uuid
  sourceScheduleTimeId String                   @db.Uuid
  serviceLineId        String                   @db.Uuid
  direction            Direction
  serviceDate          DateTime                 @db.Date
  scheduledTime        DateTime                 @db.Time(0)
  status               ScheduledDepartureStatus @default(SCHEDULED)
  cancelledAt          DateTime?
  cancellationReason   String?
  createdAt            DateTime                 @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime                 @updatedAt @db.Timestamptz(3)

  sourceScheduleTime ScheduleTime                     @relation(fields: [sourceScheduleTimeId], references: [id])
  serviceLine        ServiceLine                       @relation(fields: [serviceLineId], references: [id])
  templates          ScheduledDepartureTemplate[]
  assignments        ServiceAssignment[]
  runs               ServiceRun[]

  @@unique([sourceScheduleTimeId, serviceDate])
  @@index([serviceLineId, direction, serviceDate, scheduledTime])
  @@map("scheduled_departures")
}

model ScheduledDepartureTemplate {
  id                        String   @id @default(uuid()) @db.Uuid
  scheduledDepartureId     String   @db.Uuid
  scheduleJourneyTemplateId String   @db.Uuid
  createdAt                 DateTime @default(now()) @db.Timestamptz(3)

  departure ScheduledDeparture      @relation(fields: [scheduledDepartureId], references: [id])
  template  ScheduleJourneyTemplate @relation(fields: [scheduleJourneyTemplateId], references: [id])

  @@unique([scheduledDepartureId, scheduleJourneyTemplateId])
  @@index([scheduleJourneyTemplateId])
  @@map("scheduled_departure_templates")
}

model ServiceAssignment {
  id                        String                    @id @default(uuid()) @db.Uuid
  scheduledDepartureId      String                    @db.Uuid
  scheduleJourneyTemplateId String                    @db.Uuid
  vehicleId                 String                    @db.Uuid
  driverId                  String                    @db.Uuid
  status                    ServiceAssignmentStatus   @default(ASSIGNED)
  assignedAt                DateTime                  @default(now()) @db.Timestamptz(3)
  releasedAt                DateTime?
  replacesAssignmentId      String?                   @db.Uuid
  notes                     String?
  createdAt                 DateTime                  @default(now()) @db.Timestamptz(3)
  updatedAt                 DateTime                  @updatedAt @db.Timestamptz(3)

  departure     ScheduledDeparture      @relation(fields: [scheduledDepartureId], references: [id])
  template      ScheduleJourneyTemplate @relation(fields: [scheduleJourneyTemplateId], references: [id])
  vehicle       Vehicle                  @relation(fields: [vehicleId], references: [id])
  driver        Driver                   @relation(fields: [driverId], references: [id])
  replaces      ServiceAssignment?       @relation("AssignmentReplacement", fields: [replacesAssignmentId], references: [id])
  replacements ServiceAssignment[]       @relation("AssignmentReplacement")
  run           ServiceRun?

  @@index([scheduledDepartureId, status])
  @@index([vehicleId, status])
  @@index([driverId, status])
  @@map("service_assignments")
}

model ServiceRun {
  id                        String           @id @default(uuid()) @db.Uuid
  scheduledDepartureId      String           @db.Uuid
  serviceAssignmentId       String           @db.Uuid
  scheduleJourneyTemplateId String           @db.Uuid
  routePathId               String           @db.Uuid
  driverId                  String           @db.Uuid
  vehicleId                 String           @db.Uuid
  routePathCodeSnapshot     String
  routePathNameSnapshot     String
  driverNameSnapshot        String
  vehiclePlateSnapshot      String
  vehicleCodeSnapshot       String
  status                    ServiceRunStatus @default(IN_PROGRESS)
  startedAt                 DateTime         @default(now()) @db.Timestamptz(3)
  endedAt                   DateTime?
  startNotes                String?
  endNotes                  String?
  createdAt                 DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt                 DateTime         @updatedAt @db.Timestamptz(3)

  departure  ScheduledDeparture      @relation(fields: [scheduledDepartureId], references: [id])
  assignment ServiceAssignment       @relation(fields: [serviceAssignmentId], references: [id])
  template   ScheduleJourneyTemplate @relation(fields: [scheduleJourneyTemplateId], references: [id])
  routePath  RoutePath                @relation(fields: [routePathId], references: [id])
  driver     Driver                   @relation(fields: [driverId], references: [id])
  vehicle    Vehicle                  @relation(fields: [vehicleId], references: [id])

  @@unique([serviceAssignmentId])
  @@index([scheduledDepartureId, status])
  @@index([driverId, status])
  @@index([vehicleId, status])
  @@map("service_runs")
}
~~~

Antes de implementar se deben reconciliar las relaciones inversas con el schema
real y decidir constraints compuestos/parciales. Si se permiten varios
segmentos de run por assignment, deben rediseñarse juntos la unique y el
lifecycle.

## 29. GO / NO-GO

~~~text
GO OPERATIONAL DOMAIN:     YES
GO SCHEDULED DEPARTURE:    YES
GO MATERIALIZATION DESIGN: YES
GO ASSIGNMENT MODEL:       YES
GO SERVICE RUN MODEL:      YES

GO SCHEMA IMPLEMENTATION:  NO
GO MIGRATION:              NO
GO LEGACY BACKFILL:        NO

GO DRIVER DESIGN:          YES — conceptual, deferred implementation
GO GPS:                    NO
~~~

**GO para el diseño operacional.** La arquitectura separa programación,
planificación y ejecución; conserva la fuente de cada salida, soporta las 14
colisiones sin pérdida, múltiples templates/buses, reemplazos, conflictos y
runs reales.

**NO-GO para construir.** Fase 5B, perfiles, catálogo, vigencias, constraints,
mapping legacy, fixture y rollout todavía requieren aprobación y ensayo.
No hay autorización para tocar schema, migraciones, API, Mobile, seed, base de
datos o producción.

~~~text
ServiceCalendar
↓
SchedulePattern
↓
ScheduleTime
├── ScheduleJourneyTemplate A → RoutePath A
└── ScheduleJourneyTemplate B → RoutePath B

ScheduleTime + serviceDate + source
↓
ScheduledDeparture
│
├── ServiceAssignment A → Vehicle + Driver + JourneyTemplate A → ServiceRun A
└── ServiceAssignment B → Vehicle + Driver + JourneyTemplate B → ServiceRun B
~~~
