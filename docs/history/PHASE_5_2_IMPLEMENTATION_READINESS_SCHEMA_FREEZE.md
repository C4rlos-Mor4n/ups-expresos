# UPS GO — Phase 5.2 Implementation Readiness

**Estado:** AUDIT COMPLETE / SCHEMA FREEZE PROPOSED

**Baseline auditado:** 87857d69f6e7187d0f3076c9f58e8bdb87a1714d

**Fecha:** 2026-08-28

## 1. Verdict

La respuesta central es SÍ: se pueden crear las tablas 5B vacías de forma
aditiva sin conocer todavía las vigencias oficiales, el mapping legacy, el
catálogo productivo, los perfiles oficiales ni los horarios vigentes.

Ese GO se limita a 5B-A Schema Only. No autoriza cargar datos, publicar reglas,
ejecutar el resolver, materializar departures, hacer backfill ni cambiar
contratos.

~~~text
GO 5B Schema vacío              YES
GO 5B Migration aditiva        YES
GO 5B Domain Service            NO
GO DEV Fixture                 CONDITIONAL YES
GO Official Data                NO
GO Legacy Backfill              NO
GO 5C Schema Design             YES
GO 5C Schema Implementation     NO
GO Materializer                NO
GO Assignment                  NO
GO Run                         NO
GO Student V2                  NO
GO Admin Web                   NO
GO Driver                      NO
GO GPS                         NO
~~~

## 2. Current Architecture

### 2.1 Estado físico actual

El schema real contiene las entidades legacy Route, RouteStop, Schedule,
RouteAssignment, Trip, Vehicle, Driver y AuditLog. También contiene la
foundation 5A: Campus, ServiceLine, RoutePath, RoutePathStop y Stop.

Las migraciones existentes son la inicial, operaciones legacy y foundation de
campus/línea/path. No existe migración de calendario, timetable, departure,
assignment nuevo o run nuevo.

El JSON disponible está en:

~~~text
docs/ups_go_routes_reference_guayaquil.json
~~~

Su estado declarado es REFERENCE_DATASET_NOT_PRODUCTION. No se moverá ni se
convertirá en seed.

### 2.2 Dominio aprobado

~~~text
Campus
↓
ServiceLine
↓
RoutePath
↓
RoutePathStop → Stop

ServiceCalendar
↓
SchedulePattern
↓
SchedulePatternDay
↓
ScheduleTime
↓
ScheduleJourneyTemplate
↓
ScheduledStopTime

ScheduledDeparture
↓
ServiceAssignment
↓
ServiceRun
~~~

No se rediseña esta jerarquía.

### 2.3 Evidencia auditada

~~~text
timezone: America/Guayaquil
campuses: 2
serviceLines: 3
stops: 14
routePaths: 7
services: 15
trips: 54
stopTimes: 357
offsets variables por servicio: 15
orden inválido: 0
cruce de medianoche observado: 0
~~~

La recomputación de colisiones por lineCode + direction + departureTime produce
13 grupos, 26 registros participantes y 13 duplicados adicionales. Los
documentos anteriores hablan de 14 colisiones. La discrepancia se conserva como
gap de fuente y bloquea deduplicación/backfill, no schema vacío.

### 2.4 CI

El workflow actual incluye Node 20, pnpm, Prisma validate/generate/migrate
deploy/status, lint, typecheck, build, tests y OpenAPI. Eso habilita el gate
técnico futuro, pero no sustituye revisar el SQL de una migración concreta.

## 3. Blocker Classification

~~~text
BLOCKS_SCHEMA
BLOCKS_MIGRATION
BLOCKS_API
BLOCKS_DEV_FIXTURE
BLOCKS_PRODUCTION_DATA
BLOCKS_BACKFILL
BLOCKS_SWITCH
DOES_NOT_BLOCK_FOUNDATION
~~~

| ID | Blocker | Schema | Migration | API | Dev Fixture | Prod Data | Backfill | Switch | Resolución |
|---|---|---|---|---|---|---|---|---|---|
| B01 | global exception con direction NULL | NO | NO | NO | NO | NO | NO | NO | índices parciales SQL |
| B02 | overlap de calendars publicados | NO | NO | YES | NO | YES | YES | YES | publication workflow + lock |
| B03 | vigencias oficiales | NO | NO | YES | NO | YES | YES | YES | aprobación institucional |
| B04 | semántica de perfiles | NO | NO | YES si deduplica | NO | YES | YES | YES | decisión de producto |
| B05 | discrepancia 13 versus 14 colisiones | NO | NO | NO con source | NO | YES | YES | YES | reconciliar evidencia |
| B06 | catálogo oficial definitivo | NO | NO | YES producción | NO | YES | YES | YES | catálogo aprobado |
| B07 | mapping de 90 Schedule | NO | NO | NO legacy-only | NO | NO | YES | YES | binding aprobado |
| B08 | inmutabilidad de template | NO | NO | YES escritura | NO | YES | YES | YES | nuevos registros + RESTRICT |
| B09 | NO_SHOW | NO | NO | NO | NO | NO | NO | NO | congelar estado de assignment |
| B10 | horizonte de materialización | NO | NO | YES materializer | NO | YES | YES | YES | configuración futura |
| B11 | cancelación con assignments | NO | NO | YES command | NO | YES | YES | YES | reconciliación no destructiva |
| B12 | constraints cruzados | NO | NO | YES | NO | YES | YES | YES | transaction/application |
| B13 | coordenadas productivas | NO | NO | NO schema | CONDITIONAL | YES | YES | YES | validación manual |

B01 está resuelto a nivel de diseño y debe incluirse correctamente en el SQL
futuro. B02 no debe resolverse con una exclusión ciega antes de cerrar la
semántica de perfiles.

## 4. Calendar Schema Freeze

### ServiceCalendar

Campos definitivos:

~~~text
id UUID NOT NULL PRIMARY KEY
serviceLineId UUID NOT NULL FK ServiceLine
name TEXT NOT NULL
validFrom DATE NOT NULL
validUntil DATE NOT NULL
timezone TEXT NOT NULL DEFAULT America/Guayaquil
status DRAFT | PUBLISHED | ARCHIVED NOT NULL
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
~~~

Reglas:

~~~text
CHECK(validFrom <= validUntil)
INDEX(serviceLineId, validFrom, validUntil, status)
ON DELETE RESTRICT para ServiceLine
~~~

validUntil es el nombre canónico; no usar validTo. DRAFT puede solaparse. La
publicación de un overlap queda bloqueada por workflow hasta cerrar profiles;
no se añade aún una exclusion constraint potencialmente incorrecta.

### SchedulePattern

~~~text
id UUID NOT NULL PRIMARY KEY
serviceCalendarId UUID NOT NULL FK ServiceCalendar RESTRICT
direction Direction NOT NULL
type EXPLICIT_TIMES NOT NULL en MVP
status DRAFT | PUBLISHED | ARCHIVED NOT NULL
name TEXT NULL
exceptionId UUID NULL FK ServiceException RESTRICT
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
~~~

Índices:

~~~text
INDEX(serviceCalendarId, direction, status)
INDEX(exceptionId, direction)
~~~

No contiene RoutePath, Vehicle, Driver, capacidad ni frecuencia.

### SchedulePatternDay

~~~text
id UUID NOT NULL PRIMARY KEY
schedulePatternId UUID NOT NULL FK SchedulePattern RESTRICT
dayOfWeek DayOfWeek NOT NULL
UNIQUE(schedulePatternId, dayOfWeek)
~~~

Enum:

~~~text
MONDAY, TUESDAY, WEDNESDAY, THURSDAY,
FRIDAY, SATURDAY, SUNDAY
~~~

Se mantiene esta tabla porque permite horarios distintos para lunes-jueves,
viernes y sábado sin duplicar líneas ni usar booleans, arrays o bitmasks.

### ScheduleTime

~~~text
id UUID NOT NULL PRIMARY KEY
schedulePatternId UUID NOT NULL FK SchedulePattern RESTRICT
departureTime TIME(0) NOT NULL
approximateArrivalTime TIME(0) NULL
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
UNIQUE(schedulePatternId, departureTime)
~~~

La hora es local y se expone como HH:mm. La fecha solo aparece en
ScheduledDeparture. approximateArrivalTime no es ETA GPS.

### ServiceException

~~~text
id UUID NOT NULL PRIMARY KEY
serviceCalendarId UUID NOT NULL FK ServiceCalendar RESTRICT
serviceDate DATE NOT NULL
direction Direction NULL
reason HOLIDAY | VACATION | EXAM_PERIOD NOT NULL
effect NO_SERVICE | REPLACE_TIMES | ADD_TIMES NOT NULL
status DRAFT | PUBLISHED | CANCELLED NOT NULL
description TEXT NOT NULL
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
~~~

No se agregan WEATHER, STRIKE, EVENT, OTHER ni razones operativas.

## 5. Timetable Schema Freeze

### ScheduleJourneyTemplate

~~~text
id UUID NOT NULL PRIMARY KEY
scheduleTimeId UUID NOT NULL FK ScheduleTime RESTRICT
routePathId UUID NOT NULL FK RoutePath RESTRICT
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
UNIQUE(scheduleTimeId, routePathId)
INDEX(routePathId)
~~~

La application transaction valida que ScheduleTime y RoutePath pertenezcan a la
misma línea y dirección. Una hora puede tener varios templates.

### ScheduledStopTime

~~~text
id UUID NOT NULL PRIMARY KEY
journeyTemplateId UUID NOT NULL FK ScheduleJourneyTemplate RESTRICT
routePathStopId UUID NOT NULL FK RoutePathStop RESTRICT
offsetMinutes INT NOT NULL
createdAt TIMESTAMPTZ NOT NULL
updatedAt TIMESTAMPTZ NOT NULL
UNIQUE(journeyTemplateId, routePathStopId)
CHECK(offsetMinutes >= 0)
INDEX(journeyTemplateId, offsetMinutes)
~~~

Validaciones adicionales:

~~~text
primer stop → offset 0
offsets no decrecen con stopOrder
cada RoutePathStop aparece una vez
ningún stop pertenece a otro path
~~~

No se guarda plannedTime absoluto como segunda fuente de verdad.

### ServiceExceptionTime

No se crea un modelo separado ServiceExceptionTime. La forma congelada es:

~~~text
ServiceException
  → SchedulePattern de excepción
      → ScheduleTime
          → ScheduleJourneyTemplate
              → ScheduledStopTime
~~~

Esto reutiliza constraints y semántica. Crear una tabla adicional requeriría una
decisión de negocio distinta antes del BUILD.

## 6. Exception Constraints

### Unicidad global y direccional

La solución para direction NULL es SQL parcial:

~~~sql
CREATE UNIQUE INDEX service_exceptions_active_global_uq
ON service_exceptions ("serviceCalendarId", "serviceDate")
WHERE "direction" IS NULL
  AND "status" IN ('DRAFT', 'PUBLISHED');

CREATE UNIQUE INDEX service_exceptions_active_direction_uq
ON service_exceptions ("serviceCalendarId", "serviceDate", "direction")
WHERE "direction" IS NOT NULL
  AND "status" IN ('DRAFT', 'PUBLISHED');
~~~

CANCELLED conserva historial y permite una nueva excepción. El SQL debe probar
concurrencia. Prisma no expresa completamente esta cláusula WHERE.

### Pertenencia y precedencia

Una transaction debe asegurar que pattern.exceptionId y
pattern.serviceCalendarId correspondan a la excepción y calendario correctos.

Precedencia:

~~~text
1. excepción PUBLISHED específica de dirección
2. excepción PUBLISHED global
3. pattern regular PUBLISHED del weekday
4. no service
~~~

NO_SERVICE no crea salida normal.

## 7. Calendar Overlap

### Decisión

No incluir una exclusion constraint global en 5B-A:

~~~text
ServiceLine + daterange(validFrom, validUntil)
~~~

DRAFT solapados son editables. PUBLISHED solapados son ambiguos si los perfiles
no están definidos.

### Publicación futura

El workflow debe tomar lock lógico por ServiceLine, buscar intervalos publicados
intersectantes y rechazar o enviar a revisión. La decisión debe auditarse.

Después de cerrar profile semantics puede evaluarse exclusion constraint, trigger
o tabla de publication scope. Esto no bloquea tablas vacías ni una migración
aditiva que no imponga la regla incorrecta.

## 8. Profile Ambiguity

El dataset contiene REGULAR, ADMINISTRATIVOS_ESTUDIANTES y SATURDAY. Son
labels de fuente, no enums oficiales, roles ni permisos.

Caso crítico:

~~~text
URB_LA_JOYA / IDA / 16:50 / lunes-viernes
REGULAR
ADMINISTRATIVOS_ESTUDIANTES
~~~

No se sabe si son ofertas simultáneas, alternativas, públicos distintos o
versiones históricas.

Conclusión:

~~~text
no bloquea schema vacío
no bloquea migration aditiva
no bloquea fixture DEV con metadata
bloquea official data
bloquea deduplicación
bloquea backfill
bloquea switch de API/Student si debe ocultar una variante
~~~

Se puede conservar profileLabel o sourceLabel de forma neutral. No se convierte
en autorización.

## 9. Nominal Collisions

Los documentos previos mencionan 14 colisiones. La recomputación actual entrega:

~~~text
13 grupos
26 registros
13 duplicados adicionales
~~~

La identidad segura sigue siendo sourceScheduleTimeId + serviceDate. La
diferencia de conteo es un gap de evidencia B05. La regla es NO COLLAPSE hasta
reconciliar la fuente.

Una API puede devolver variantes con provenance. No puede escoger una por nombre.
Una futura fusión debe conservar todos los source IDs, templates y decisiones
auditadas. El gap no impide schema o migration vacía.

## 10. Data vs Schema Blockers

| Decisión | Tablas vacías | Migration | DEV | Producción | Backfill |
|---|---|---|---|---|---|
| vigencias | no bloquea | no bloquea | no bloquea | bloquea | bloquea |
| catálogo | no bloquea | no bloquea | no bloquea | bloquea | bloquea |
| perfiles | no bloquea | no bloquea | metadata | bloquea | bloquea |
| colisiones | no bloquea | no bloquea | no bloquea | bloquea dedup | bloquea |
| legacy mapping | no bloquea | no bloquea | no bloquea | no carga | bloquea |
| coordenadas | no bloquea | no bloquea | revisión manual | bloquea | bloquea |
| horizonte | no bloquea | no bloquea | no bloquea | bloquea job | bloquea |
| overlap | no bloquea si no se impone mal | no bloquea | no bloquea | bloquea publish | bloquea |

La ausencia de datos oficiales no impide que existan tablas vacías. Sí impide
afirmar que existe transporte publicado u operativo.

## 11. Template Immutability

Un ScheduleJourneyTemplate usado por una salida publicada no se edita
materialmente:

~~~text
template publicado
  → nuevo template + nueva regla/vigencia
  → anterior conservado/archivado
~~~

FK históricas usan RESTRICT. Cambios de RoutePath, horarios o paradas crean
registros nuevos. AuditLog registra publish, archive y replacement.

No se añade Version table obligatoria al MVP. Esta decisión bloquea endpoints de
edición hasta que la transacción aplique la regla, pero no bloquea tablas vacías.

## 12. 5C Freeze

### ScheduledDeparture

~~~text
sourceScheduleTimeId + serviceDate → UNIQUE
serviceLineId → snapshot/query
direction → snapshot/query
scheduledTime → TIME local snapshot
serviceDate → DATE
status → SCHEDULED | CANCELLED
~~~

No se usa line + direction + date + time como identidad, porque las colisiones
pueden tener fuentes distintas.

### ScheduledDepartureTemplate

Una departure tiene varios templates mediante puente. La asociación valida que
el template pertenezca al sourceScheduleTimeId de la departure.

No existe unique departure + template ni departure + routePath que impida varios
buses o templates válidos.

### ServiceAssignment

Campos:

~~~text
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

El assignment apunta al template y no duplica routePathId. No existe unique
departure + template: varios buses pueden usar el mismo template.

Estados congelados:

~~~text
ASSIGNED
RELEASED
REPLACED
NO_SHOW
~~~

No existe UNASSIGNED ni IN_PROGRESS en assignment.

### ServiceRun

Nace cuando comienza la ejecución real:

~~~text
IN_PROGRESS
COMPLETED
SUSPENDED
ABORTED
~~~

Un assignment produce como máximo un run:

~~~text
UNIQUE(serviceAssignmentId)
~~~

SUSPENDED puede volver a IN_PROGRESS. ABORTED es terminal. Un reemplazo usa
otra assignment y otro run. No se crea NOT_STARTED ni un run ficticio por
NO_SHOW.

### Inconsistencia anterior

El pseudomodelo 5.1 crea ServiceRun NOT_STARTED al confirmar assignment. La
decisión posterior de 5C lo corrige: el run nace en el start real. Para el BUILD,
5C es la autoridad más reciente.

## 13. Migration Boundaries

### 5B-A Schema Only

Agregar únicamente:

~~~text
ServiceCalendar
SchedulePattern
SchedulePatternDay
ScheduleTime
ScheduleJourneyTemplate
ScheduledStopTime
ServiceException
~~~

No agregar ServiceExceptionTime separado.

No incluir:

~~~text
ScheduledDeparture
ScheduledDepartureTemplate
ServiceAssignment
ServiceRun
resolver
materializer
API
Mobile
apps/web
seed
fixture data
backfill
~~~

### Reglas de migración

~~~text
ADDITIVE
VERSIONED
REPRODUCIBLE
WITHOUT DATA LOAD
WITHOUT LEGACY UPDATE
WITHOUT DELETE
~~~

Incluir enums, FK RESTRICT, CHECK de fechas/offsets, unique de pattern/day y
pattern/time, índices mínimos e índices parciales de excepciones.

No incluir exclusion de calendar overlap mientras la semántica de publicación no
esté aprobada. No usar db push. No insertar catálogo.

### Orden

~~~text
5B-A schema
  ↓
5B-B resolver + domain tests
  ↓
5C-A ScheduledDeparture schema
  ↓
5C-B materializer
  ↓
5C-C assignment
  ↓
5C-D run
  ↓
compatibility adapters
~~~

No mezclar 5B y 5C en una migración grande.

## 14. DEV Fixture

El JSON puede ser un fixture DEV controlado, pero no se autoriza su importación
en esta auditoría.

Guardas:

1. exigir REFERENCE_DATASET_NOT_PRODUCTION;
2. permitir solo NODE_ENV development/test;
3. rechazar configuración de producción;
4. usar comando explícito distinto de prisma seed;
5. validar timezone;
6. validar IDs, secuencias y horas;
7. convertir horas absolutas a offsets;
8. conservar sourceImage y profileLabel;
9. detenerse ante requiresManualValidation cuando se promueva ubicación;
10. generar reporte;
11. no escribir producción;
12. no ejecutar backfill.

Ubicación futura sugerida:

~~~text
prisma/fixtures/dev/ups-guayaquil.reference.json
~~~

No mover el archivo actual. DEV Fixture queda CONDITIONAL YES.

## 15. Legacy

Permanecen intactas:

~~~text
Route
RouteStop
Schedule
RouteAssignment
Trip
~~~

Mapping futuro:

~~~text
Legacy Route
  → Campus + ServiceLine + RoutePath aprobado

Legacy Schedule
  → ServiceCalendar + SchedulePattern + ScheduleTime

Legacy RouteAssignment
  → ScheduledDeparture + ServiceAssignment, solo con vínculo inequívoco

Legacy Trip
  → ServiceRun, solo con vínculo inequívoco
~~~

No se crea salida por nombre, fecha aproximada, nota demo o cercanía. Los 90
Schedule conservan IDs y contenido.

La transición es:

~~~text
legacy read
  → shadow read nuevo
  → comparación
  → cohorte
  → switch
  → contract posterior
~~~

No se hace backfill en 5.2.

## 16. CI / Delivery

Toda implementación futura requiere:

~~~text
pnpm install --frozen-lockfile
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate deploy
pnpm prisma migrate status
pnpm lint
pnpm typecheck
pnpm build
pnpm exec jest --runInBand
pnpm test:openapi
~~~

También requiere rehearsal contra DB limpia, revisión del diff SQL, pruebas de
índices parciales, CHECK, FK RESTRICT, contenido legacy sin cambios y ausencia
de seed productivo.

La CI existente demuestra capacidad de gate, no que esta fase se haya ejecutado.

## 17. Options

### Conservadora

Esperar todos los datos y decisiones antes de crear tablas.

Reduce riesgo, pero mezcla bloqueos de datos con estructura y retrasa validar
migración vacía.

### Equilibrada

Crear solo schema 5B aditivo y vacío. Mantener bloqueados resolver, publicación,
fixture ejecutable, datos oficiales, backfill, API, Mobile y operación.

Es reversible, auditable y compatible con legacy. Es la recomendada.

### Agresiva

Crear 5B, 5C, materializer, seed y APIs ahora.

Se rechaza por profile ambiguity, colisiones, rollback y riesgo de fabricar
servicio oficial.

## 18. Recommendation

Autorizar después de este gate solamente:

~~~text
FASE 5B-A — BUILD SCHEMA ONLY
~~~

Condiciones:

1. modificar solo schema y migración autorizados;
2. no tocar API, Mobile, seed ni contratos;
3. no insertar catálogo;
4. incluir índices parciales de excepción;
5. no incluir exclusion de calendar overlap;
6. no crear ServiceExceptionTime;
7. usar validUntil;
8. usar SchedulePatternDay;
9. usar TIME(0), DATE y TIMESTAMPTZ;
10. usar ScheduleJourneyTemplate y ScheduledStopTime;
11. usar RESTRICT histórico;
12. ejecutar CI remoto completo;
13. detenerse ante drift o SQL inesperado;
14. dejar 5C fuera de la migración.

Seguir bloqueado:

~~~text
5B Domain Service
5B official data
5B production publish
5B backfill
5C schema
5C materializer
5C assignment
5C run
Student V2
Admin Web
Driver implementation
GPS
~~~

El GO de schema no significa que existan horarios oficiales ni departures
operativas.

## 19. GO / NO-GO

~~~text
GO 5B SCHEMA:                   YES
GO 5B MIGRATION:                YES — additive schema-only
GO 5B DOMAIN SERVICE:           NO
GO DEV FIXTURE IMPORT:          CONDITIONAL YES — DEV guardrails only
GO OFFICIAL DATA LOAD:          NO
GO LEGACY BACKFILL:             NO

GO 5C SCHEMA DESIGN:            YES
GO 5C SCHEMA IMPLEMENTATION:    NO
GO MATERIALIZER IMPLEMENTATION: NO
GO ASSIGNMENT IMPLEMENTATION:   NO
GO RUN IMPLEMENTATION:          NO

GO STUDENT V2:                  NO
GO ADMIN WEB:                   NO
GO DRIVER IMPLEMENTATION:       NO
GO GPS:                         NO
~~~

**Veredicto final:** se puede volver a BUILD con Fase 5B-A Schema Only, una
migración aditiva y SQL revisado. La carga oficial, backfill, publicación y
switch siguen congelados hasta resolver los blockers de datos y operación.
