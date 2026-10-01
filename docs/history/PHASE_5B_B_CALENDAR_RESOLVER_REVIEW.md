# UPS GO — Phase 5B-B Calendar Resolver Review

Tipo: auditoría independiente de diseño
Fecha: 2026-08-28
Baseline auditado: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`
Documento auditado: `docs/PHASE_5B_B_CALENDAR_RESOLVER_DESIGN.md`

## 1. Verdict

**GO para el contrato y el diseño del resolver. GO condicionado para iniciar
5B-B BUILD en una ejecución posterior y separada.**

La auditoría encontró cuatro inconsistencias documentales relevantes y las
corrigió únicamente en el blueprint autorizado. Después de las correcciones,
la resolución queda alineada con el schema Prisma real de `main`, con 5B-A,
5B.1 y la separación operacional de 5C.

Este review no implementa. No se modificaron runtime NestJS, Prisma,
migraciones, API, DTOs, OpenAPI, Mobile, `apps/web`, seed ni base de datos.

La decisión de BUILD significa que el siguiente paso autorizable puede ser un
resolver interno read-only con tests, no que se autorice un endpoint, un
materializador o una migración adicional en este turno.

## 2. Scope

Se revisaron:

- `docs/PHASE_5B_B_CALENDAR_RESOLVER_DESIGN.md`;
- `docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_DESIGN.md`;
- `docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_REVIEW.md`;
- `docs/PHASE_5B_1_PUBLISHED_TIMETABLE_DOMAIN_CORRECTION.md`;
- `docs/PHASE_5_2_IMPLEMENTATION_READINESS_SCHEMA_FREEZE.md`;
- `docs/PHASE_5B_A_CALENDAR_SCHEMA_IMPLEMENTATION_REPORT.md`;
- `docs/PHASE_5B_A_CALENDAR_SCHEMA_REVIEW.md`;
- `docs/PHASE_5C_OPERATIONAL_DOMAIN_DESIGN.md`;
- `apps/api/prisma/schema.prisma`;
- la migración de la fundación 5B-A;
- la arquitectura runtime actual y el workflow CI.

La auditoría fue de diseño. No se cargaron datos ni se ejecutaron operaciones
que puedan cambiar el estado del sistema.

## 3. Resolver Contract

El input mínimo queda congelado como:

```ts
{
  serviceLineId: string;
  direction: Direction; // IDA | RETORNO
  serviceDate: LocalDate; // YYYY-MM-DD
}
```

No hace falta añadir `userId`, `vehicleId`, `driverId`, `routePathId`,
timezone del cliente ni perfil. El resolver obtiene internamente el agregado
de calendario, excepción, patrón, hora, plantilla, ruta y paradas.

La responsabilidad es responder qué servicio programado debería existir. No
responde qué bus salió, qué conductor lo ejecuta, qué posición tiene ni si está
en recorrido.

El output conceptual conserva:

```text
serviceLineId
serviceCalendarId
direction
serviceDate
timezone
serviceAvailable
resolution
timetableCompleteness
exception metadata, si aplica
departures[]
```

Cada departure conserva `patternId`, `scheduleTimeId`, hora local, fuente,
`sourceExceptionId` cuando corresponda y todos sus journeys. Esto es contrato
interno de diseño, no un DTO público.

## 4. Calendar Selection

La selección aprobada es:

```text
ServiceLine
  → status = PUBLISHED
  → validFrom <= serviceDate
  → serviceDate <= validUntil
  → timezone = America/Guayaquil
```

La auditoría confirmó que el schema real usa `validUntil` obligatorio:

```prisma
validFrom  DateTime @db.Date
validUntil DateTime @db.Date
```

No se debe modelar `validUntil` como nullable ni usar `validTo`.

Sólo `PUBLISHED` participa. `DRAFT` y `ARCHIVED` se excluyen.

La consulta futura debe usar `findMany` con un límite de dos candidatos, o una
estrategia equivalente que distinga 0, 1 y más de 1. No se permite `findFirst`
para ocultar una ambigüedad.

Resultado:

```text
0 → NO_PUBLISHED_CALENDAR
1 → continuar
>1 → AMBIGUOUS_CALENDAR
```

No se elige por ID, fecha de creación, nombre ni orden accidental.

## 5. No Calendar vs No Service

La separación es correcta y queda aprobada:

| Situación | Resultado |
|---|---|
| Línea sin calendario `PUBLISHED` vigente | `NO_PUBLISHED_CALENDAR` |
| Calendarios publicados vigentes múltiples | `AMBIGUOUS_CALENDAR` |
| Calendario válido, sin patrón para weekday/dirección | `NO_SERVICE` |
| Excepción efectiva `NO_SERVICE` | resultado válido sin departures |
| Calendario/patrón/relación inválida | error tipado de configuración |

La ausencia de configuración no se disfraza de domingo sin servicio. Esto es
importante para no publicar un vacío como si fuera una decisión académica.

## 6. Pattern Selection

Un patrón regular aplicable debe:

- pertenecer al calendario seleccionado;
- tener la dirección solicitada;
- estar `PUBLISHED`;
- ser `EXPLICIT_TIMES`;
- tener `exceptionId IS NULL`;
- contener el `Weekday` calculado;
- tener horas explícitas válidas.

Los patrones de excepción no participan en esta búsqueda. Su fecha de
aplicación viene de `ServiceException.serviceDate`, no de
`SchedulePatternDay`.

Si hay varios patrones regulares publicados aplicables a la misma combinación
de calendario, dirección y weekday, el resultado es `AMBIGUOUS_PATTERN`.

Esta decisión está justificada porque los labels de fuente/perfil observados
no tienen semántica oficial aprobada. Podrían ser ofertas alternativas,
perfiles de público o versiones históricas. Combinar ahora produciría buses o
salidas fantasma. La composición de perfiles queda para una decisión de
negocio posterior.

Si no hay patrón regular aplicable y no hay excepción efectiva, el resultado
es `NO_SERVICE`.

## 7. Weekday

Se usará un mapeo ISO explícito:

```text
Monday    → MONDAY
Tuesday   → TUESDAY
Wednesday → WEDNESDAY
Thursday  → THURSDAY
Friday    → FRIDAY
Saturday  → SATURDAY
Sunday    → SUNDAY
```

El cálculo parte del `LocalDate` en `America/Guayaquil`. No se usa
`Date#getDay()` sin adaptación, no se persiste `Sunday = 0` y no se deja que el
timezone del host cambie el día.

No se añade una dependencia nueva sólo para convertir siete días.

## 8. Exception Resolution

La excepción se busca después de seleccionar el calendario y sólo dentro de
él:

```text
serviceCalendarId = selectedCalendar.id
serviceDate       = input.serviceDate
status            = PUBLISHED
direction         = requested direction OR NULL
```

`DRAFT` y `CANCELLED` se ignoran. La relación de `ServiceException` con
`ServiceCalendar` es la frontera de selección.

El schema real no tiene `ServiceExceptionTime`. La representación válida es:

```text
ServiceException
  → SchedulePattern(exceptionId)
      → ScheduleTime
          → ScheduleJourneyTemplate
              → ScheduledStopTime
```

Para los efectos con horas, los patrones se filtran además por:

```text
exceptionId = selectedException.id
serviceCalendarId = selectedCalendar.id
status = PUBLISHED
direction = requested direction
```

La auditoría detectó que las dos FKs físicas (`exceptionId` y
`serviceCalendarId`) no forman una FK compuesta; el resolver debe validar esa
pertenencia cruzada. Un patrón de excepción con excepción de otro calendario
es `INVALID_EXCEPTION_CONFIGURATION`.

Los patrones de excepción no deben tener `SchedulePatternDay`. Si tienen filas
de días, se rechazan como configuración inválida; no se intenta rescatar el
horario usando el weekday.

## 9. Exception Precedence

La precedencia definitiva es:

```text
exception PUBLISHED for requested direction
        > exception PUBLISHED with direction = NULL
        > regular PUBLISHED pattern for weekday
        > NO_SERVICE
```

La excepción específica reemplaza exclusivamente a la global para ese
sentido. Ejemplo:

```text
GLOBAL: NO_SERVICE
IDA:    ADD_TIMES 10:00

IDA     → regular + 10:00 según ADD_TIMES
RETORNO → NO_SERVICE
```

No se combinan una excepción específica y una global. La prioridad no depende
de `createdAt`, `updatedAt`, nombre, UUID ni posición de consulta.

Los índices parciales de 5B-A evitan más de una excepción activa por alcance,
pero el resolver mantiene la validación de cardinalidad y falla cerrado ante
datos imposibles.

## 10. NO_SERVICE

`NO_SERVICE` es un resultado de dominio válido:

```ts
{
  serviceAvailable: false,
  departures: [],
}
```

No se consultan horas regulares ni journeys después de identificar una
excepción efectiva `NO_SERVICE`. Se conserva la identidad del calendario,
fecha, dirección y excepción para trazabilidad.

Un domingo sin patrón puede dar `NO_SERVICE`; un calendario inexistente no.

## 11. REPLACE_TIMES

`REPLACE_TIMES` usa sólo las horas del patrón de excepción efectivo:

```text
regular times: ignored
exception times: used
```

La ausencia de un patrón publicado válido, horas válidas o timetable válido
para el sentido afectado es error de configuración. No se hace fallback al
patrón regular.

Si hay más de un patrón de excepción publicado para la misma excepción y
dirección, se devuelve `AMBIGUOUS_PATTERN`; no se combinan automáticamente.

## 12. ADD_TIMES

`ADD_TIMES` conserva las horas regulares y agrega las horas excepcionales:

```text
regular + exception
```

Las entradas se ordenan cronológicamente, pero no se deduplican sólo por
`departureTime`. La identidad es superior a la hora visible. Dos fuentes con
16:50 pueden representar perfiles, paths o templates distintos.

La fuente se marca como `REGULAR` o `EXCEPTION_ADD`; una sustitución se marca
como `EXCEPTION_REPLACE`. Si la excepción afecta el sentido y no tiene fuente
excepcional válida para él, la configuración es inválida, no “cero horas” por
silencio.

Los documentos anteriores contienen una recomendación histórica de deduplicar
por hora, pero la corrección 5B.1 y el diseño operacional 5C priorizan
`sourceScheduleTimeId`. Para este review se adopta la regla posterior y más
segura: no colapsar nominal collisions.

## 13. Source Identity

La trazabilidad mínima interna queda congelada como:

```text
serviceCalendarId
patternId
scheduleTimeId
sourceExceptionId?
journeyTemplateId
routePathId
```

Cada departure conserva `scheduleTimeId`, incluso con horas visibles iguales.
Esto prepara la relación futura:

```text
sourceScheduleTimeId + serviceDate → ScheduledDeparture
```

La hora visible no es identidad. Tampoco se sintetizan IDs desde strings de
hora ni se usan IDs de otro calendario.

## 14. Nominal Collisions

Los documentos de contexto registran una discrepancia entre 14 colisiones
históricas y 13 grupos en la recomputación actual. Ese gap de evidencia no se
resuelve en el resolver ni autoriza backfill.

La regla estable es:

```text
identity > visible time
```

Por ello:

- no se deduplica por `departureTime`;
- no se elige un perfil por nombre;
- no se elige un path por proximidad;
- no se crea una fuente sintética;
- cualquier fusión futura deberá ser auditable y conservar todos los source
  IDs.

## 15. Journey Templates

Un `ScheduleTime` puede tener cero, uno o varios
`ScheduleJourneyTemplate`. El resolver devuelve todos los journeys válidos y
no selecciona uno “principal”.

Para cada template se valida:

```text
scheduleTime.pattern.serviceCalendarId == selectedCalendar.id
scheduleTime.pattern.exceptionId == selectedException.id, si aplica
journeyTemplate.routePath.serviceLineId == selectedCalendar.serviceLineId
journeyTemplate.routePath.direction == pattern.direction
```

Una hora sin templates no es `NO_SERVICE`. Se marca como `PARTIAL` mediante
metadata interna; no se inventa una ruta ni una parada. Esa salida parcial no
debe considerarse publicable/materializable como completa sin una política
posterior.

Si un template concreto tiene una relación inválida, se invalida ese template
y se conserva la posibilidad de devolver otros templates válidos. Si la
política de publicación exige completitud total, la publicación debe bloquear
antes del resolver.

## 16. Stop Timetable

La cadena validada es:

```text
ScheduleJourneyTemplate
  → ScheduledStopTime
      → RoutePathStop
          → RoutePath
```

Cada `RoutePathStop` del path publicado debe aparecer exactamente una vez en
el template completo. Un `RoutePathStop` de otro path es
`INVALID_TIMETABLE_RELATION`.

Los offsets se interpretan así:

```text
plannedStopLocalDateTime = departureLocalDateTime + offsetMinutes
```

Invariantes de dominio:

- el primer stop por `stopOrder` tiene offset `0`;
- todos los offsets son enteros no negativos;
- los offsets no decrecen por `stopOrder`;
- offsets iguales para paradas distintas son válidos;
- las paradas se ordenan por `stopOrder`, no por offset;
- no se guarda una hora absoluta duplicada como fuente de verdad.

El schema ya aporta `CHECK(offsetMinutes >= 0)`. El primer offset y el orden no
decreciente son validaciones de dominio/publicación.

Un timetable incompleto invalida sólo ese journey template, con error o
metadata `PARTIAL` según el límite de consumo. No se devuelven datos corruptos
como si fueran completos ni se invalidan automáticamente otras departures
independientes.

## 17. Midnight

La aritmética debe conservar el día local resultante:

```text
departure = 23:50
offset     = 30
stop       = 00:20 del día siguiente
dayOffset  = 1
```

El `serviceDate` de la salida no cambia. Sólo la parada tiene desplazamiento de
día. Se recomienda devolver `dayOffset` en el resolver; una fecha-hora local
equivalente también es válida si no pierde esa información.

No se limita artificialmente el modelo a 24 horas. Offsets mayores a 1440 no
rompen la aritmética, aunque una futura regla de calidad podrá rechazar
valores absurdos en publicación. No se introduce ese límite en esta fase.

## 18. Temporal Semantics

`ScheduleTime.departureTime` y `approximateArrivalTime` son `TIME(0)` locales.
`approximateArrivalTime` es metadata general, no fuente de verdad para cada
parada ni ETA observado.

Cuando hay stop times válidos, el fin planificado se deriva de:

```text
departureTime + max(offsetMinutes)
```

Si no hay stop times, la llegada aproximada puede conservarse como metadata
informativa, pero no sustituye un timetable ni habilita recursos operativos.

La fecha civil se combina con hora y offset sólo en una función explícita bajo
`America/Guayaquil`; no se convierte la hora conceptual a UTC para resolver
weekday o mostrar salidas.

## 19. Errors

El conjunto mínimo queda aprobado:

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

`NO_SERVICE` no es excepción: es estado válido.

Las funciones puras deben usar una unión discriminada (`ok/value` o
`ok/error`) para no depender de NestJS. El servicio interno puede traducir
errores tipados al estilo de excepciones del framework en un límite posterior.
Los errores de Prisma/PostgreSQL deben conservarse como errores de
infraestructura; no se traducen a `NO_SERVICE`.

Los logs sólo registran fallos de configuración relevantes, por ejemplo
`calendar_resolution_ambiguous`, con IDs de diagnóstico y sin información
sensible. No se logea cada resolución exitosa.

## 20. Determinism

Con el mismo estado publicado y el mismo input, el output debe ser idéntico en
sentido semántico.

Orden total recomendado:

```text
departures: departureTime ASC, scheduleTimeId ASC, sourceRank
journeys:   journeyTemplateId ASC
stops:      stopOrder ASC
```

`sourceRank` sólo desempata y nunca elimina ni cambia la precedencia.

Se prohíben `findFirst` para cardinalidades ambiguas, dependencia del orden de
Prisma, hora actual, locale del host, timezone del proceso o caché para tomar
decisiones de negocio.

## 21. Repository

La opción aprobada es equilibrada:

```text
CalendarRepository
        ↓
CalendarResolverService
        ↓
pure domain functions
```

El repositorio arma el aggregate con Prisma y preserva cardinalidad e IDs; no
decide precedencia ni corrige silenciosamente datos.

La estrategia recomendada es de dos etapas:

1. `findMany` de calendarios candidatos con `take: 2` para distinguir 0/1/>1;
2. carga agregada del único calendario, con `select/include` acotados para
   excepciones, patrones, tiempos, templates, paths y stops.

Esto evita N+1 y evita una consulta única que oculte la ambigüedad inicial.
Una lectura transaccional pequeña es admisible si mantiene las mismas
propiedades. No se requiere Redis, caché ni precomputación.

## 22. Tests

### Unitarios puros

El BUILD debe cubrir al menos:

1. weekday de lunes a domingo;
2. rango inclusivo `validFrom`/`validUntil`;
3. fecha fuera de rango;
4. cero, uno y múltiples calendarios;
5. timezone no soportado;
6. patrón regular normal, sábado y sin patrón;
7. patrón regular ambiguo;
8. excepción global y específica;
9. específica gana a global;
10. `NO_SERVICE` sin consultar horas regulares;
11. `REPLACE_TIMES` sin fuga regular;
12. `ADD_TIMES` con fuentes e identidad preservadas;
13. excepciones DRAFT/CANCELLED ignoradas;
14. patrón de excepción de otro calendario;
15. múltiples patrones de excepción;
16. colisión nominal preservada;
17. cero y múltiples journeys;
18. ruta, dirección o stop inválidos;
19. template incompleto;
20. primer offset distinto de cero;
21. offset decreciente;
22. offsets iguales aceptados;
23. orden por `stopOrder`;
24. cruce de medianoche;
25. sorting determinista.

### Integración

Los tests de repositorio deben usar PostgreSQL de prueba para verificar
relaciones completas y estados publicados, sin convertir todos los tests en
dependientes de DB. Deben demostrar que el resolver es read-only y que los
conteos antes y después permanecen iguales cuando ese gate se implemente.

### Regresión

Los 90 `Schedule` legacy siguen siendo la fuente de Mobile. Un dominio nuevo
vacío no activa fallback ni cambia endpoints existentes.

## 23. Legacy Isolation

Queda prohibido:

```ts
if (newCalendarMissing) {
  return resolveFromLegacySchedule();
}
```

El flujo permanece separado:

```text
Mobile actual       → Schedule legacy
Resolver futuro     → ServiceCalendar y timetable 5B-A
```

No se consulta legacy para completar el agregado nuevo. No se renombra ni
reescribe `Schedule`. La transición futura será shadow read, comparación,
cohorte y switch explícito, nunca fallback silencioso.

## 24. Performance

El volumen actual no justifica Redis, caché ni materialización anticipada.

Los índices existentes cubren las búsquedas principales:

```text
ServiceCalendar(serviceLineId, validFrom, validUntil, status)
SchedulePattern(serviceCalendarId, direction, status)
SchedulePattern(exceptionId, direction)
ServiceException(serviceCalendarId, serviceDate, status, direction)
```

La consulta agregada debe evitar N+1 y no traer columnas innecesarias. El
resolver debe permanecer read-only y no escribir un departure durante la
resolución.

## 25. Findings

### F5BB-01 — Nullable `validUntil` incompatible con schema real

**Severidad:** HIGH
**Estado:** RESUELTO EN BLUEPRINT
**Evidencia:** `ServiceCalendar.validUntil DateTime @db.Date` es obligatorio en
`apps/api/prisma/schema.prisma`; el blueprint usaba `validUntil IS NULL`.
**Impacto:** una implementación podría construir un filtro imposible o tratar
un calendario como abierto.
**Corrección:** se dejó el rango inclusivo obligatorio con
`serviceDate <= validUntil`.

### F5BB-02 — Relación cruzada de patrón de excepción no garantizada por FK

**Severidad:** HIGH
**Estado:** RESUELTO COMO VALIDACIÓN DE DOMINIO
**Evidencia:** el schema tiene FKs independientes para `exceptionId` y
`serviceCalendarId`, no una FK compuesta.
**Impacto:** un patrón podría apuntar a una excepción de otro calendario.
**Corrección:** se exige filtrar por ambos IDs y devolver
`INVALID_EXCEPTION_CONFIGURATION` si divergen.

### F5BB-03 — Cardinalidad de patrones de excepción no protegida físicamente

**Severidad:** HIGH
**Estado:** RESUELTO COMO REGLA DEL RESOLVER
**Evidencia:** no existe unique sobre `(exceptionId, direction)` para patrones
publicados.
**Impacto:** `REPLACE_TIMES` o `ADD_TIMES` podría ser no determinista.
**Corrección:** cero o más de un patrón válido para el sentido se tratan como
configuración inválida según corresponda; más de uno produce
`AMBIGUOUS_PATTERN`; no se combinan.

### F5BB-04 — Offset y salida necesitaban contrato más preciso

**Severidad:** MEDIUM
**Estado:** RESUELTO EN BLUEPRINT
**Evidencia:** el schema sólo impone `offsetMinutes >= 0`; 5B.1 además exige
primer offset cero y offsets no decrecientes.
**Impacto:** una implementación podía aceptar un timetable físicamente
imposible o perder el orden de paradas.
**Corrección:** se congelaron primer offset `0`, no decrecimiento, igualdad
permitida y orden por `stopOrder`.

### F5BB-05 — Trazabilidad y completitud insuficientes en output inicial

**Severidad:** MEDIUM
**Estado:** RESUELTO EN BLUEPRINT
**Evidencia:** el tipo conceptual inicial no exponía `patternId` ni una señal
clara de `PARTIAL`.
**Impacto:** materializador o consumidor futuro podría perder provenance o
tratar un journey incompleto como completo.
**Corrección:** se añadieron `patternId`, fuente precisa y
`timetableCompleteness` como metadata interna.

### F5BB-06 — Conteo histórico de colisiones discrepante

**Severidad:** INFO
**Estado:** ABIERTO, NO BLOQUEA EL RESOLVER
**Evidencia:** documentos registran 13 grupos recomputados y 14 mencionados
históricamente.
**Impacto:** impide deduplicar o hacer backfill seguro.
**Recomendación:** mantener identity > visible time, no hacer backfill y
reconciliar la fuente en una fase de datos separada.

### F5BB-07 — Semántica de perfiles aún no aprobada

**Severidad:** HIGH PARA DATOS/PUBLICACIÓN
**Estado:** ABIERTO, NO BLOQUEA EL ALGORITMO AISLADO
**Evidencia:** labels como `REGULAR` y `ADMINISTRATIVOS_ESTUDIANTES` no son
perfiles oficiales del schema.
**Impacto:** no se puede decidir una fusión comercial de salidas nominales.
**Recomendación:** resolver por source identity sin combinar y bloquear
catálogo/backfill/publicación hasta una decisión de negocio.

## 26. Corrections Applied

Sólo se modificó el documento permitido:

`docs/PHASE_5B_B_CALENDAR_RESOLVER_DESIGN.md`

Correcciones aplicadas:

1. eliminación del supuesto nullable de `validUntil`;
2. timezone soportado validado explícitamente;
3. patrones de excepción sin `SchedulePatternDay`;
4. filtro exacto por excepción, calendario, estado y dirección;
5. validación cruzada `exceptionId`/`serviceCalendarId`;
6. cardinalidad determinista de patrones de excepción;
7. `patternId`, fuente precisa y metadata de completitud;
8. primer offset cero, offsets no decrecientes e igualdad permitida;
9. estrategia de dos queries con `take: 2` y prohibición de `findFirst`;
10. separación de errores de dominio e infraestructura.

No se corrigieron documentos históricos ni se tocó código porque el alcance
lo prohibía.

## 27. GO / NO-GO

```text
GO RESOLVER CONTRACT:       YES
GO CALENDAR SELECTION:      YES
GO PATTERN SELECTION:       YES
GO EXCEPTION RESOLUTION:    YES
GO SOURCE IDENTITY:         YES
GO JOURNEY RESOLUTION:      YES
GO STOP TIMETABLE:          YES
GO ERROR MODEL:             YES
GO TEST STRATEGY:           YES

GO 5B-B BUILD:              YES, en ejecución posterior separada
GO PUBLIC API:              NO
GO MOBILE SWITCH:           NO
GO MATERIALIZER:            NO
GO DEV FIXTURE:             NO
GO BACKFILL:                NO
GO 5C:                      NO
```

La implementación futura queda limitada a repository read-only, resolver
interno, funciones puras, errores tipados y tests unitarios/integración. No
incluye controller, Swagger, Mobile, ScheduledDeparture, materializer, seed,
fixture oficial ni backfill.

## Delivery Gate — Independent Design Review

| Check | Estado | Evidencia |
|---|---|---|
| lint | N/A | No se modificó código |
| typecheck | N/A | No se modificó código |
| build | N/A | BUILD explícitamente fuera de este review |
| tests | N/A | No se implementó runtime nuevo |
| Migraciones revisadas | PASS | Schema/migración 5B-A inspeccionados; no modificados |
| OpenAPI/Swagger actualizado | N/A | No hay endpoint nuevo autorizado |
| `.env.example` actualizado | N/A | No cambió configuración |
| Documentación mínima actualizada | PASS | Blueprint corregido y review creado |
| QA manual del flujo afectado | N/A | No existe flujo runtime nuevo |
| Scope protegido | PASS | Sólo blueprint permitido y este reporte creados/modificados |
| `git diff --check` global | ⚠️ HISTÓRICO | Detecta trailing whitespace en cambios previos de Mobile; los dos documentos de review pasan su check local |

**Estado: REVIEW COMPLETE — DESIGN GO / NO IMPLEMENTATION**

No se hizo commit, push ni PR. El worktree histórico se preservó sin limpieza.
