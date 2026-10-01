# FASE 5B-B — Calendar Resolution Engine Design

Estado: DISEÑO LISTO PARA REVISIÓN INDEPENDIENTE
Baseline certificado: `d34f92b87a3e0c0a8724181b0d570a3bbf38d686`
Fecha: 2026-08-28
Zona horaria del proyecto: `America/Guayaquil`

## 1. Verdict

El diseño del motor de resolución de calendario queda definido y es apto para
una auditoría independiente. El resolver será una operación determinista,
fail-closed y sin materializar todavía `ScheduledDeparture`.

Este documento no autoriza implementación. En particular, no se modifican
Prisma, migraciones, módulos NestJS, endpoints, DTOs, OpenAPI, Mobile, datos,
fixtures, seeds ni contratos existentes.

El objetivo de esta fase es fijar qué significa “el horario efectivo de una
línea, dirección y fecha” antes de construir operaciones sobre esa respuesta.

## 2. Scope

Dentro del alcance:

- definir `resolveSchedule({ serviceLineId, direction, serviceDate })`;
- seleccionar un único `ServiceCalendar` publicado aplicable;
- resolver patrón regular y excepciones publicadas;
- producir horas explícitas con identidad de origen;
- resolver plantillas de viaje y sus tiempos de parada;
- fijar reglas para fechas, días de semana, medianoche, colisiones y errores;
- preparar una futura materialización operacional sin crearla ahora;
- mantener aislados los 90 registros `Schedule` legacy.

Fuera del alcance:

- crear `ScheduledDeparture`, `ServiceAssignment` o `ServiceRun`;
- autenticación Driver, GPS, tracking o estado real del bus;
- exponer un endpoint público nuevo;
- cambiar la experiencia Student o activar el catálogo nuevo en Mobile;
- ejecutar backfill, seed, fixture oficial o carga de datos;
- modificar el schema, las migraciones o la base de datos.

## 3. Resolver Responsibility

El resolver responde una pregunta de dominio, no una pregunta de operación en
tiempo real:

> Para una línea de servicio, una dirección y una fecha local, ¿qué salidas
> programadas son válidas según el calendario publicado y sus excepciones?

No afirma que un bus exista, que haya sido asignado, que haya salido ni que
esté en recorrido. Esas afirmaciones pertenecen a fases posteriores.

La función conceptual es:

```ts
resolveSchedule({
  serviceLineId,
  direction,
  serviceDate,
}): ResolvedSchedule | ResolverError
```

Debe ser pura desde el punto de vista de negocio: para el mismo agregado de
entrada y la misma fecha devuelve el mismo resultado, sin depender de “ahora”,
orden accidental de la base de datos, caché o disponibilidad de un operador.

## 4. Input

### 4.1 Identidad

`serviceLineId` identifica la `ServiceLine` solicitada. El resolver debe
validar que exista y, si el dominio exige operación activa, que no esté
inactiva. No debe buscar otra línea parecida ni hacer fallback por nombre.

`direction` es el enum de dominio `IDA` o `RETORNO`. No se aceptan aliases
locales ni valores ambiguos. La dirección de la consulta debe coincidir con la
dirección del patrón y de la `RoutePath` de cada viaje.

### 4.2 Fecha

`serviceDate` es un `LocalDate` ISO con forma `YYYY-MM-DD`, sin hora ni offset.
La fecha se interpreta en `America/Guayaquil`, que es también el timezone
default del calendario nuevo.

El adaptador de entrada debe rechazar fechas inválidas, componentes de hora,
conversiones implícitas del navegador y timestamps UTC que puedan cambiar el
día local. La implementación no debe usar `Date#getDay()` como contrato de
dominio.

## 5. Output

El resultado conceptual es:

```ts
type ResolvedSchedule = {
  serviceLineId: string;
  serviceCalendarId: string;
  direction: "IDA" | "RETORNO";
  serviceDate: string; // YYYY-MM-DD
  timezone: "America/Guayaquil";
  serviceAvailable: boolean;
  resolution: "REGULAR" | "REPLACE_TIMES" | "ADD_TIMES" | "NO_SERVICE";
  timetableCompleteness: "COMPLETE" | "PARTIAL";
  exception?: {
    id: string;
    reason: "HOLIDAY" | "VACATION" | "EXAM_PERIOD";
    effect: "NO_SERVICE" | "REPLACE_TIMES" | "ADD_TIMES";
  };
  departures: ResolvedDeparture[];
};

type ResolvedDeparture = {
  patternId: string;
  scheduleTimeId: string;
  departureTime: string; // HH:mm:ss, local time
  approximateArrivalTime?: string;
  source: "REGULAR" | "EXCEPTION_REPLACE" | "EXCEPTION_ADD";
  sourceExceptionId?: string;
  journeys: ResolvedJourney[];
};
```

Los nombres anteriores son contrato de diseño, no tipos que deban crearse en
esta fase. El resultado puede añadir metadatos internos, pero no debe omitir
`serviceCalendarId`, `scheduleTimeId`, la fecha, la dirección ni la identidad
de la excepción cuando exista.

Un resultado `NO_SERVICE` tiene `serviceAvailable: false` y
`departures: []`. Es una respuesta válida de negocio, distinta de un error de
configuración.

## 6. Calendar Selection

La selección ocurre antes de consultar patrones, horarios o excepciones:

1. filtrar por el `serviceLineId` recibido;
2. exigir `status = PUBLISHED`;
3. exigir `validFrom <= serviceDate`;
4. exigir `serviceDate <= validUntil`;
5. exigir que el rango sea inclusivo en ambos extremos;
6. exigir `timezone = America/Guayaquil` en este MVP;
7. esperar exactamente un calendario.

`DRAFT` y `ARCHIVED` no participan. Un calendario publicado fuera de vigencia
no participa.

Cardinalidad:

- cero calendarios: `NO_PUBLISHED_CALENDAR`;
- más de uno: `AMBIGUOUS_CALENDAR`;
- uno: continúa la resolución dentro de ese calendario.

Ante ambigüedad el resolver falla cerrado. No elige el primero, el más nuevo,
el menor ID, ni combina calendarios. La excepción se consulta únicamente
dentro del calendario seleccionado porque la relación definida en 5B-A es
`ServiceException -> ServiceCalendar`; una excepción de otro calendario no
puede afectar esta resolución.

## 7. Pattern Resolution

Después de seleccionar el calendario, el resolver trabaja con patrones regulares
que:

- pertenecen al `serviceCalendarId` seleccionado;
- tienen la dirección solicitada;
- tienen `status = PUBLISHED`;
- son de tipo `EXPLICIT_TIMES`;
- tienen días y horas explícitos válidos.

El patrón regular se identifica como un patrón publicado aplicable al día de
la semana y no asociado a una excepción (`exceptionId IS NULL`). Un patrón
especial se considera sólo a través de la excepción que lo selecciona. Los
patrones de excepción están ligados a una fecha por `ServiceException` y no
necesitan `SchedulePatternDay`; el resolver no debe exigirles que coincidan
con el weekday.

Si existen varios patrones regulares publicados aplicables para la misma
dirección, no se deben fusionar silenciosamente. El resultado es
`AMBIGUOUS_PATTERN`, salvo que una futura regla de unicidad explícita cambie
este diseño antes de implementación. La selección no depende de nombre, ID u
orden de inserción.

Los patrones publicados que no aplican al día consultado no son error. Si no
hay patrón regular para ese día y tampoco hay una excepción aplicable, el
resultado es `NO_SERVICE`.

## 8. Weekday

El mapeo conceptual es ISO/Gregoriano:

```text
1 Monday
2 Tuesday
3 Wednesday
4 Thursday
5 Friday
6 Saturday
7 Sunday
```

La implementación futura debe usar un mapper probado o una función pura que
calcule este valor desde `LocalDate`. No se persiste ni se comunica el valor
JavaScript `Sunday = 0` como si fuera el enum del dominio.

El weekday se calcula en la fecha local solicitada. No se recalcula desde la
hora de salida ni desde la fecha UTC de un timestamp.

## 9. Exception Resolution

La búsqueda de excepciones se limita al calendario seleccionado, a la fecha
exacta y a excepciones `PUBLISHED`:

- `serviceCalendarId = selectedCalendar.id`;
- `serviceDate = input.serviceDate`;
- `status = PUBLISHED`;
- `direction = requested direction` o `direction IS NULL`.

`DRAFT` y `CANCELLED` se ignoran. Una excepción de otra fecha, línea,
calendario o dirección no participa.

Para una excepción efectiva con `REPLACE_TIMES` o `ADD_TIMES`, sus patrones se
obtienen exclusivamente con:

- `exceptionId = selectedException.id`;
- `serviceCalendarId = selectedCalendar.id`;
- `status = PUBLISHED`;
- `direction = requested direction`.

La relación `exceptionId` no garantiza por sí sola la pertenencia al mismo
calendario en el schema físico. Por eso el resolver debe validarla y devolver
`INVALID_EXCEPTION_CONFIGURATION` si el patrón apunta a una excepción de otro
calendario. Más de un patrón publicado para la excepción y dirección
solicitada es `AMBIGUOUS_PATTERN`; no se combinan por orden, nombre o ID.
Los patrones de excepción no deben tener `SchedulePatternDay`; si aparecen
filas de días en uno publicado, se trata como configuración inválida y no se
usa el weekday para rescatarlo.

Para `REPLACE_TIMES`, la ausencia de un patrón y de horas válidas para el
sentido afectado es configuración inválida, no fallback al horario regular.
Para `ADD_TIMES`, la política del MVP también exige una fuente excepcional
válida para el sentido afectado; no se inventa que la ausencia significa
silenciosamente “agregar cero”.

Si para la misma precedencia existen dos excepciones publicadas aplicables y
sus efectos no pueden resolverse de forma única, el resolver devuelve
`INVALID_EXCEPTION_CONFIGURATION` o un error específico equivalente. No se
elige arbitrariamente una por ID.

Las razones actuales (`HOLIDAY`, `VACATION`, `EXAM_PERIOD`) describen por qué
existe la excepción; la decisión operativa proviene de `effect`. La razón no
debe cambiar la precedencia.

## 10. Precedence

El orden completo es:

```text
1. excepción publicada específica de dirección
2. excepción publicada global (direction = NULL)
3. patrón regular publicado del weekday
4. no service
```

La primera capa con configuración válida gobierna la fecha y dirección. Una
excepción específica gana a una global, incluso si la global fue creada
después. La excepción global gana al calendario regular.

La prioridad no se decide por `createdAt`, `updatedAt`, UUID, nombre o posición
devuelta por Prisma. Si la capa ganadora es inválida, se informa un error de
configuración; no se cae silenciosamente a una capa inferior que podría
publicar un horario incorrecto.

## 11. NO_SERVICE

Cuando la excepción ganadora tiene `effect = NO_SERVICE`:

```text
serviceAvailable = false
resolution = NO_SERVICE
departures = []
```

No se consultan ni se mezclan las horas regulares. No se resuelven plantillas
de viaje ni tiempos de parada. La respuesta conserva la identidad del
calendario, fecha y dirección para que el consumidor pueda distinguir un día
sin servicio de un error técnico.

Un domingo sin patrón, una fecha sin patrón aplicable o una fecha cubierta
por una excepción `NO_SERVICE` son casos de negocio sin salidas. La ausencia
de calendario publicado, la ambigüedad y las relaciones inválidas son errores
de configuración, no `NO_SERVICE`.

## 12. REPLACE_TIMES

Cuando la excepción ganadora tiene `effect = REPLACE_TIMES`:

- se ignoran las horas del patrón regular para esa dirección y fecha;
- se usan únicamente los `ScheduleTime` de los patrones de excepción de esa
  excepción;
- se conserva cada `scheduleTimeId` de la fuente excepcional;
- se resuelven sus plantillas y paradas con las mismas validaciones del flujo
  regular;
- se ordenan las salidas cronológicamente.

Una excepción `REPLACE_TIMES` sin horas publicadas válidas no debe producir un
reemplazo vacío que parezca configuración correcta. Debe devolver un error de
configuración, salvo que la política publicada se cambie explícitamente a un
efecto equivalente a `NO_SERVICE` antes de implementar.

## 13. ADD_TIMES

Cuando la excepción ganadora tiene `effect = ADD_TIMES`:

- se conservan las horas regulares;
- se agregan las horas de los patrones de excepción;
- todas las salidas se ordenan por hora;
- se mantienen su fuente y su identidad.

No se deduplica sólo porque dos salidas tengan la misma hora. Dos
`ScheduleTime` distintos pueden representar viajes o plantillas diferentes y
deben permanecer observables. Si en el futuro se requiere una deduplicación
de negocio, necesitará una regla explícita que incluya como mínimo la
identidad de la fuente, la plantilla y la ruta.

El resultado será `resolution = ADD_TIMES`, aunque sólo una de las dos
fuentes tenga horas, para conservar el hecho de que la fecha fue resuelta por
una excepción aditiva.

## 14. Source Identity

Cada salida debe conservar `scheduleTimeId`. Esta identidad es obligatoria
para la futura relación:

```text
sourceScheduleTimeId + serviceDate -> ScheduledDeparture
```

También se conserva, cuando corresponde, `sourceExceptionId` y el origen
`REGULAR`, `EXCEPTION_REPLACE` o `EXCEPTION_ADD`. La salida conserva además
`patternId` y el resultado conserva `serviceCalendarId`; la hora visible no
es una identidad suficiente.

Esto evita colisiones entre:

- una salida regular y una excepcional a la misma hora;
- dos viajes que parten a la misma hora;
- dos fuentes excepcionales distintas;
- una hora que cambia de calendario o patrón.

El resolver no debe sintetizar IDs basados en el texto de la hora ni exponer
IDs de filas de otro calendario como si fueran válidos en el seleccionado.

## 15. Nominal Collisions

Una colisión nominal ocurre cuando dos `ScheduleTime` tienen el mismo
`departureTime`, aunque sus IDs, patrones, excepciones o plantillas difieran.

La decisión es no colapsarla en la capa de resolución. Se devuelven entradas
separadas y reproducibles. Para una ordenación total, se recomienda:

```text
(departureTime, scheduleTimeId, sourceRank, journeyTemplateId)
```

donde `sourceRank` es un valor fijo y documentado (por ejemplo,
`REGULAR < EXCEPTION`) sólo como desempate. Nunca se usa para eliminar
registros ni para cambiar la precedencia de las excepciones.

Si una única hora tiene varias plantillas de viaje, se conserva una salida
con todas sus plantillas, o una representación equivalente que mantenga la
misma cardinalidad e identidad. No se escoge una plantilla “principal”.

## 16. Journey Templates

Cada `ScheduleTime` puede tener cero, una o varias
`ScheduleJourneyTemplate`. El resolver debe devolver todas las plantillas
válidas asociadas al horario.

Para cada plantilla se valida conceptualmente que:

- `scheduleTime.pattern.serviceCalendarId` sea el calendario seleccionado;
- `scheduleTime.pattern.exceptionId`, si existe, sea la excepción efectiva y
  pertenezca al mismo calendario;
- `journeyTemplate.routePath.serviceLineId` sea la línea del calendario;
- `journeyTemplate.routePath.direction` coincida con el patrón solicitado;
- la plantilla pertenezca al `scheduleTimeId` resuelto;
- cada `ScheduledStopTime.routePathStopId` pertenezca a esa `RoutePath`;
- cada `RoutePathStop` conserve su `stopOrder` válido.

Una plantilla con relación inválida se descarta de forma fail-closed para esa
plantilla y se registra como error de configuración. Las demás plantillas y
salidas válidas no se destruyen automáticamente.

Una hora sin plantillas no significa `NO_SERVICE`: la programación temporal
puede estar publicada antes de completar el detalle del viaje. El resultado
debe poder marcarse internamente como `TIMETABLE_PARTIAL` o emitir una
advertencia estructurada, sin inventar una ruta ni una parada.

Si una fecha sólo puede resolverse con una configuración temporal imposible o
con relaciones indispensables inválidas, la política de publicación debe
permitir devolver un error de configuración en vez de presentar información
parcial como completa.

## 17. Scheduled Stop Times

El orden de paradas se determina por `RoutePathStop.stopOrder`, nunca por
`offsetMinutes`, ID o el orden físico de una consulta.

Cada `ScheduledStopTime` aporta un `offsetMinutes` relativo a la salida del
viaje. El resolver no persiste una hora absoluta por parada. Conceptualmente:

```text
plannedStopLocalDateTime = departureLocalDateTime + offsetMinutes
```

La futura materialización será quien convierta esta relación en sus campos
operacionales si los necesita. Mientras tanto el resultado conserva el
offset, la parada y el orden.

Validaciones mínimas futuras:

- el primer `ScheduledStopTime` por `stopOrder` tiene `offsetMinutes = 0`;
- `offsetMinutes` es entero y no negativo, conforme al CHECK existente;
- los offsets no decrecen según `stopOrder` (`nextOffset >= previousOffset`);
- dos paradas consecutivas pueden compartir el mismo offset;
- no hay dos asignaciones contradictorias para la misma parada y plantilla;
- la parada pertenece a la ruta de la plantilla;
- la secuencia resultante es estrictamente ordenable por `stopOrder`.

Un timetable incompleto se trata como inválido para esa plantilla, no como
permiso para inventar offsets o reordenar paradas.

## 18. Midnight

Las horas son locales y pueden cruzar medianoche. Por ejemplo:

```text
departure = 23:50
offset = 30 minutos
planned stop = día siguiente 00:20
```

El resultado debe conservar el cruce con `dayOffset: 1` o una fecha-hora
local equivalente. Nunca debe envolver simplemente a `00:20` y perder que la
parada ocurrió el día siguiente.

No se cambia el `serviceDate` de la salida por cruzar medianoche. La salida
sigue perteneciendo al servicio de la fecha solicitada; sólo el instante
local de la parada tiene un desplazamiento de día.

Los valores `@db.Time(0)` son horas de reloj sin fecha. La combinación con la
fecha local y los offsets debe realizarse en una función temporal explícita y
probada, no con sumas de strings ni con conversiones UTC implícitas.

## 19. Errors

Errores de entrada o configuración propuestos:

| Código | Significado | Política |
|---|---|---|
| `INVALID_DATE` | Fecha ausente o no ISO válida | Rechazar antes de consultar dominio |
| `SERVICE_LINE_NOT_FOUND` | La línea no existe | Fail closed |
| `SERVICE_LINE_INACTIVE` | La línea no está operativa según dominio | Fail closed |
| `NO_PUBLISHED_CALENDAR` | No hay calendario publicado vigente | Error, no `NO_SERVICE` |
| `AMBIGUOUS_CALENDAR` | Hay más de un calendario publicado vigente | Error, no elegir uno |
| `INVALID_CALENDAR_CONFIGURATION` | Timezone no soportado o relación de calendario inválida | Fail closed |
| `AMBIGUOUS_PATTERN` | Patrones regulares aplicables no únicos | Error |
| `INVALID_EXCEPTION_CONFIGURATION` | Excepciones aplicables incompatibles o incompletas | Error |
| `INVALID_TIMETABLE_RELATION` | Plantilla, ruta o dirección no corresponden | Invalidar esa plantilla o error según severidad |
| `INVALID_STOP_TIMETABLE` | Parada u offset no puede resolverse | Invalidar esa plantilla |

`NO_SERVICE` es estado de negocio, no código de error. Un domingo sin patrón
puede tener `serviceAvailable = false`; una línea sin calendario publicado no
debe disfrazarse como domingo sin servicio.

Los mensajes externos futuros no deben filtrar detalles innecesarios de
implementación, pero los logs internos deben conservar IDs suficientes para
diagnóstico sin registrar secretos.

Para mantener la lógica pura independiente de NestJS, las funciones de dominio
deben devolver una unión discriminada (`ok/value` o `ok/error`) y no lanzar
excepciones HTTP. El servicio interno puede mapear el error tipado a la
convención NestJS vigente si alguna fase posterior expone un límite HTTP. Un
error de Prisma o PostgreSQL debe conservarse como error de infraestructura y
no traducirse arbitrariamente a `NO_SERVICE`.

## 20. Determinism

El resolver debe cumplir estas propiedades:

- misma entrada y mismo agregado publicado producen el mismo output;
- todas las colecciones se ordenan con criterios explícitos;
- no depende de la hora actual, locale del host o timezone del proceso;
- no depende de la primera fila devuelta por Prisma;
- no fusiona entidades por nombre o por hora visible;
- no usa caché para decidir precedencia;
- la ambigüedad siempre produce el mismo error;
- el resultado conserva IDs de origen;
- la función pura de resolución puede probarse sin base de datos.

La consulta del repositorio debe solicitar relaciones necesarias en una carga
agregada y luego normalizar el resultado a un orden canónico antes de invocar
las funciones puras.

## 21. Repository Strategy

La arquitectura recomendada es:

```text
CalendarRepository
        ↓
CalendarResolverService
        ↓
pure resolution functions
```

`CalendarRepository` será responsable de leer el agregado mínimo necesario:
línea, calendario, patrones, días, horas, excepciones, plantillas, rutas,
paradas y offsets. Se recomienda una estrategia de dos etapas: primero un
`findMany` de calendarios candidatos con `take: 2` para distinguir cero, uno y
más de uno; después, sólo para el calendario único, una carga agregada
`include/select` cuidadosamente acotada. Así no se usa `findFirst` para una
cardinalidad que puede ser ambigua y se evita N+1. No se requiere Redis ni
caché para esta fase.

El repositorio no debe decidir precedencia ni corregir datos silenciosamente.
Debe preservar cardinalidad e identidad para que el resolver pueda detectar
ambigüedades y relaciones inválidas.

El servicio de dominio coordina validación, selección y resolución. Las
funciones puras reciben estructuras normalizadas y devuelven resultado o
error tipado. Esta separación permite probar la semántica sin levantar NestJS
ni una base de datos.

La primera implementación, cuando sea autorizada, debe ser interna. No se
propone todavía controller, DTO, cambio de OpenAPI ni modificación del
contrato Mobile.

## 22. Test Strategy

La fase de implementación futura debe incluir como mínimo:

### Unitarios puros

- mapeo ISO de lunes a domingo;
- fecha inclusiva en `validFrom` y `validUntil`;
- calendario fuera de rango;
- cero y múltiples calendarios publicados;
- timezone distinto de `America/Guayaquil` rechazado;
- patrón regular por weekday;
- patrón de excepción sin `SchedulePatternDay` y con fecha de excepción como
  ámbito;
- patrón de excepción de otro calendario rechazado;
- múltiples patrones de excepción para un sentido rechazados;
- excepción específica sobre global;
- global sobre regular;
- `NO_SERVICE` sin consultar horas regulares;
- `REPLACE_TIMES` sin fuga de horas regulares;
- `ADD_TIMES` con orden y fuentes preservadas;
- colisiones nominales sin deduplicación;
- múltiples plantillas en una salida;
- cero plantillas sin convertirlo en `NO_SERVICE`;
- ruta/dirección/stop incompatibles;
- orden por `stopOrder`;
- cruce de medianoche y `dayOffset`;
- primer offset distinto de cero rechazado;
- offsets decrecientes rechazados y offsets iguales aceptados;
- repetición exacta del mismo input produce el mismo JSON semántico.

### Integración de repositorio

- sólo `PUBLISHED` es elegible;
- `DRAFT`, `ARCHIVED` y `CANCELLED` no alteran el resultado;
- excepciones se limitan al calendario seleccionado;
- no hay N+1 observable con el agregado definido;
- los IDs de origen llegan intactos al servicio.

### Regresión

- los 90 `Schedule` legacy continúan siendo la fuente que consume Mobile;
- ningún endpoint existente cambia su contrato;
- un calendario nuevo vacío no cambia la respuesta legacy;
- no se crea ninguna `ScheduledDeparture`.

Los tests no deben limitarse a snapshots: deben afirmar errores, cardinalidad,
precedencia, identidad de origen y valores temporales.

## 23. Legacy Isolation

El resolver nuevo no es fallback de `Schedule` y `Schedule` no es fallback del
resolver. Son dos mundos explícitos:

```text
Mobile actual → Schedule legacy
Resolver futuro → ServiceCalendar y dominio 5B-A
```

Mientras no exista una decisión de compatibilidad y un corte controlado,
Mobile permanece intacto. La presencia de tablas nuevas vacías no debe
ocultar, reemplazar ni reinterpretar los 90 horarios legacy.

La compatibilidad mínima exigida es aditiva: construir el resolver no cambia
lecturas, respuestas, nombres visuales ni contratos existentes.

## 24. Future Materializer

Una fase posterior podrá materializar la respuesta en `ScheduledDeparture`.
Ese proceso deberá consumir el output ya resuelto, no volver a implementar la
precedencia en otro lugar.

La clave conceptual deberá incluir al menos:

```text
serviceDate + serviceLineId + direction + sourceScheduleTimeId
```

y conservar el calendario, la excepción aplicable y la plantilla/ruta que
originaron cada salida. La materialización deberá ser idempotente, pero esa
decisión pertenece a 5C y no se implementa aquí.

La separación es intencional:

```text
5B-B: resolver qué debería ocurrir
5C: materializar y operar salidas programadas
posterior: asignar bus, iniciar run y observar recorrido
```

Un horario programado no equivale a un bus real en recorrido.

## 25. Options

### Opción A — Prisma directo desde controller

Rápida para un prototipo, pero mezcla acceso a datos, precedencia y contrato
HTTP. Dificulta los tests puros, favorece N+1 y aumenta el riesgo de alterar
Mobile. No recomendada.

### Opción B — servicio de dominio, repositorio y funciones puras

Separa lectura, reglas y transporte; detecta ambigüedad; permite probar fechas
y excepciones sin infraestructura; mantiene abierto el futuro materializador.
Es la opción recomendada.

### Opción C — motor genérico de reglas, eventos y caché

Puede ser útil para un dominio mucho mayor, pero ahora añade complejidad,
consistencia distribuida y decisiones no justificadas por el alcance. No
recomendada para 5B-B.

## 26. Implementation Scope

Si la auditoría independiente aprueba este diseño, la implementación de 5B-B
debe limitarse a:

- tipos de dominio internos del resolver;
- `CalendarRepository` y su consulta agregada;
- `CalendarResolverService`;
- funciones puras para selección, precedencia, horas, journeys y tiempos de
  parada;
- tests unitarios y de integración acotados;
- documentación técnica necesaria para mantener el contrato.

La implementación no debe incluir:

- `ScheduledDeparture`, `ServiceAssignment` o `ServiceRun`;
- backfill, seed, fixture oficial o carga de datos;
- endpoint público, DTO, OpenAPI o switch Mobile;
- cambios de schema, migraciones o contratos API;
- Driver Auth, GPS o tracking;
- reemplazo de `Schedule` legacy.

## 27. GO / NO-GO

```text
GO RESOLUTION ALGORITHM: YES
GO CALENDAR SELECTION: YES
GO EXCEPTION PRECEDENCE: YES
GO TIMETABLE RESOLUTION: YES
GO JOURNEY RESOLUTION: YES

GO 5B-B IMPLEMENTATION: PENDING INDEPENDENT REVIEW
GO PUBLIC API: NO
GO MOBILE SWITCH: NO
GO MATERIALIZER: NO
GO BACKFILL: NO
GO DEV FIXTURE: NO
GO 5C: NO
```

Conclusión: el diseño del Calendar Resolution Engine está listo para revisión
independiente. La evolución puede recibir un GO únicamente para implementar
el resolver aislado después de esa revisión; no existe autorización para
construir operaciones reales, exponerlo públicamente ni migrar datos.

## Delivery Gate

| Gate | Estado | Evidencia / alcance |
|---|---|---|
| Reconocimiento de baseline y documentación | PASS | Baseline `d34f92b...`; 5B-A y 5C revisados |
| Diseño de calendario y precedencia | PASS | Secciones 6–13 |
| Identidad, journeys y paradas | PASS | Secciones 14–18 |
| Errores y determinismo | PASS | Secciones 19–20 |
| Estrategia de repositorio y pruebas | PASS | Secciones 21–22 |
| Aislamiento legacy y materializador futuro | PASS | Secciones 23–24 |
| Lint / typecheck / build / tests | N/A | No se modificó código |
| Prisma / migraciones / base de datos | N/A | No se modificó ni ejecutó |
| OpenAPI / Mobile | N/A | No se modificaron contratos ni cliente |
| QA runtime | N/A | No hay runtime nuevo autorizado |
| Implementación 5B-B | NO-GO | Pendiente de review independiente |

Este entregable deja el sistema en estado `DESIGN READY / NO IMPLEMENTATION`.
El worktree histórico se conserva sin limpieza, commit, push ni PR.
