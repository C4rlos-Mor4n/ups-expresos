# UPS GO — Phase 5B Calendar & Schedule Review

**Fecha:** 2026-08-28
**Tipo:** auditoría independiente de diseño
**Baseline auditado:** `87857d69f6e7187d0f3076c9f58e8bdb87a1714d`
**Estado:** `GO DESIGN` / `CONDITIONAL GO IMPLEMENTATION` / `NO-GO MIGRATION`

> **REVIEW ONLY — NO IMPLEMENTATION**

Este review audita `docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_DESIGN.md` contra
la foundation de Fase 5A, los documentos de negocio previos, el schema actual y
el modelo legacy. No modifica API, Mobile, Prisma, migraciones, seed, base de
datos ni `apps/web`.

## 1. Verdict

El diseño corregido representa adecuadamente una programación recurrente de UPS
GO y mantiene separadas estas responsabilidades:

```text
ServiceCalendar → qué fechas pueden tener servicio
SchedulePattern → qué días y sentido aplican
ScheduleTime    → a qué horas explícitas
ServiceException→ qué cambia una fecha concreta
ScheduledDeparture → salida materializada futura
ServiceRun      → operación real futura
```

Veredicto resumido:

```text
GO DOMAIN MODEL:          YES
GO CALENDAR MODEL:        YES
GO EXCEPTION MODEL:       YES, con alcance MVP limitado
GO SCHEMA IMPLEMENTATION: CONDITIONAL — no autorizada todavía
GO MIGRATION:             NO
GO BACKFILL:              NO
GO PHASE 5C DESIGN:       YES, con ScheduledDeparture separado
```

La razón del `CONDITIONAL` es que la forma conceptual está lista, pero aún
faltan decisiones oficiales sobre fechas, mapping legacy, publicación y
políticas de excepción. Además, dos invariantes relevantes —solapamiento de
calendarios y unicidad con excepción global— necesitarán SQL PostgreSQL
controlado o validaciones transaccionales explícitas.

## 2. Scope

### Incluido

- `ServiceCalendar` y su vigencia;
- relación `ServiceLine → ServiceCalendar`;
- `Direction` en `SchedulePattern`;
- `SchedulePattern` recurrente;
- `SchedulePatternDay`;
- `ScheduleTime` como hora local explícita;
- feriados, vacaciones y exámenes;
- efectos `NO_SERVICE`, `REPLACE_TIMES` y `ADD_TIMES`;
- precedencia entre excepción específica, global y regla regular;
- preparación de `ScheduledDeparture`;
- compatibilidad con los 90 `Schedule` legacy;
- backfill como dry run futuro;
- alcance funcional del Admin Web.

### Excluido

- cualquier cambio de `schema.prisma`;
- cualquier migración o `prisma migrate`;
- `INSERT`, `UPDATE`, `DELETE` o backfill;
- nuevos endpoints o cambios de contrato;
- Mobile, Driver Auth, GPS, ETA y websockets;
- asignaciones, runs e incidencias operativas;
- calendario nacional automático o APIs externas;
- frecuencia/headway en el MVP.

## 3. Domain Model

### 3.1 Resultado de la comparación

La jerarquía corregida es compatible con la decisión de Fase 5.1:

```text
Campus
  └── ServiceLine
        ├── RoutePath[]
        └── ServiceCalendar[]
              └── SchedulePattern[]
                    ├── SchedulePatternDay[]
                    └── ScheduleTime[]
```

El calendario no tiene `RoutePath`. El path físico se reserva para la futura
asignación de cada bus. Esto permite que una misma salida de Ruta Norte tenga
varios buses por paths distintos sin duplicar el horario.

### 3.2 Dirección

`Direction` debe permanecer en `SchedulePattern`:

```text
ServiceLine
├── Pattern IDA     → ScheduleTime[]
└── Pattern RETORNO → ScheduleTime[]
```

No debe vivir en `ServiceCalendar`, porque un calendario de línea puede cubrir
ambos sentidos con listas de horas diferentes. No se necesita una entidad
`DirectionSchedule` adicional.

### 3.3 Calendar no es departure

El diseño mantiene correctamente la diferencia:

```text
calendario + patrón + tiempo = regla
fecha + hora efectiva         = ScheduledDeparture futura
assignment + inicio           = ServiceRun futuro
```

Una regla publicada no implica assignment ni recorrido.

## 4. ServiceCalendar

### 4.1 Granularidad

`ServiceCalendar → ServiceLine` es la granularidad correcta para el MVP.

Permite que Ruta Norte, Ruta Sur y Ruta La Joya tengan fechas de vigencia y
excepciones independientes, y evita herencia implícita desde un calendario
institucional no visible.

Para un feriado que afecte muchas líneas, el futuro caso de uso administrativo
puede aplicar excepciones a varios calendarios en una operación controlada. No
se necesita introducir ahora una entidad de calendario global.

### 4.2 `name`

`name` aporta valor operativo como etiqueta editable:

```text
Calendario académico 2026-2
Horario especial de exámenes noviembre 2026
```

No es identidad, no debe ser `UNIQUE` y no debe usarse como FK. La identidad
relacional es el ID; la vigencia y la línea determinan la aplicabilidad.

### 4.3 Vigencia

La regla correcta es inclusiva:

```text
validFrom <= serviceDate <= validUntil
```

El diseño usa `validUntil` como nombre canónico. No debe mezclarse con
`validTo` entre schema, DTO y documentación.

Debe existir validación de aplicación y, en la implementación, un `CHECK` SQL
equivalente a `validFrom <= validUntil`.

### 4.4 Estado

La revisión confirma que `DRAFT`, `PUBLISHED` y `ARCHIVED` están justificados:

- `DRAFT` permite editar y previsualizar;
- `PUBLISHED` es elegible para resolución pública;
- `ARCHIVED` conserva historia sin exposición futura.

Se corrigió una duplicidad del blueprint: no se usa simultáneamente un
`isActive` para el mismo ciclo editorial. En `ServiceException`,
`CANCELLED` es necesario para retirar una excepción publicada conservando
auditoría.

### 4.5 Timezone

Guardar `timezone` en `ServiceCalendar` es preferible a resolverlo solo desde
configuración global porque conserva la semántica histórica de la programación
y deja explícito el contexto de cada calendario.

En este MVP debe validarse como:

```text
America/Guayaquil
```

La configuración global puede proveer el default, pero no debe reemplazar el
valor persistido cuando se evalúa una fecha histórica.

## 5. SchedulePattern

`SchedulePattern` representa un conjunto recurrente de reglas, no una salida
concreta.

Campos conceptualmente aprobados:

```text
serviceCalendarId
direction
type = EXPLICIT_TIMES
status = DRAFT | PUBLISHED | ARCHIVED
name?
exceptionId?
```

Decisiones:

- `serviceCalendarId` es obligatorio;
- `direction` usa el enum existente `Direction`;
- no se agrega `RoutePath`;
- no se agrega capacidad, número de buses, conductor ni vehículo;
- `name` es etiqueta operativa, no identidad;
- `exceptionId` solo se usa para patrones de reemplazo/agregado de una fecha;
- los patrones de excepción nunca participan en la recurrencia regular;
- `EXPLICIT_TIMES` es el único tipo implementable de este MVP.

El tipo futuro de frecuencia fue retirado del pseudo-modelo mínimo. Si algún día
existe una necesidad real de frecuencia, se añadirá mediante una decisión
posterior y una migración explícita.

## 6. Weekdays

### 6.1 Alternativas auditadas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Siete booleanos en calendario | Válida pero limitada | Mezcla disponibilidad del período con agrupación de horarios |
| Array de enum | No recomendada | Menor claridad de constraints y consultas en Prisma |
| Bitmask | Rechazada | Poco legible y difícil de mantener |
| `SchedulePatternDay` | Recomendada | Permite patrones distintos por subconjunto de días |

### 6.2 Decisión

`SchedulePatternDay` no es una tabla extra por normalización ornamental. Es
necesaria para representar, por ejemplo:

```text
Pattern IDA lunes-jueves → 06:40, 08:30, 17:00
Pattern IDA viernes       → 06:40, 12:30
```

También permite que Ida y Retorno tengan conjuntos de días diferentes. La
relación debe tener:

```text
UNIQUE(schedulePatternId, dayOfWeek)
```

El índice adicional solamente por `dayOfWeek` fue retirado por baja
selectividad y falta de una consulta MVP que lo necesite. El índice único
compuesto ya cubre las búsquedas desde el patrón.

### 6.3 Enum

Se confirma el enum existente:

```text
MONDAY, TUESDAY, WEDNESDAY, THURSDAY,
FRIDAY, SATURDAY, SUNDAY
```

La conversión desde JS `Date.getDay()` debe vivir en una función explícita:

```text
0 → SUNDAY
1 → MONDAY
...
6 → SATURDAY
```

No se deben almacenar números mágicos en la base.

## 7. ScheduleTime

### 7.1 Representación

`ScheduleTime` debe usar PostgreSQL `TIME(0)` para `departureTime` y para la
llegada aproximada opcional. No debe usar UTC `DateTime` ni strings libres.

La representación API futura será:

```text
06:40
08:30
17:00
```

La fecha se incorpora solamente cuando se materialice una
`ScheduledDeparture`.

### 7.2 Unicidad

La constraint correcta es:

```text
UNIQUE(schedulePatternId, departureTime)
```

Impide duplicar 06:40 dentro de un mismo patrón, pero permite 06:40 en IDA y
RETORNO o en patrones distintos.

El índice separado `(schedulePatternId, departureTime)` fue retirado porque la
constraint única ya crea un índice equivalente.

### 7.3 Orden y validaciones

- las consultas ordenan por `departureTime ASC`;
- no se guarda un `position` redundante;
- una llegada aproximada anterior a la salida debe rechazarse o tratarse como
  cruce de medianoche explícitamente, no aceptarse silenciosamente;
- la programación no debe calcular ETA ni usar el tiempo como proxy de path;
- cambiar tiempos publicados requiere nueva versión lógica o reconciliación de
  salidas futuras editables.

## 8. ServiceException

### 8.1 Modelo aprobado

La excepción tiene una fecha civil, alcance opcional por dirección, razón,
efecto y estado editorial:

```text
serviceCalendarId
serviceDate: DATE
direction: Direction?       // NULL = ambos sentidos
reason: HOLIDAY | VACATION | EXAM_PERIOD
effect: NO_SERVICE | REPLACE_TIMES | ADD_TIMES
status: DRAFT | PUBLISHED | CANCELLED
description
```

Los patrones asociados llevan los tiempos de reemplazo o adición. No se usa
JSON ni una columna de horas serializada.

### 8.2 Alcance mínimo de razones

Se corrigió un exceso del diseño original: `WEATHER`, `MAINTENANCE`,
`INSTITUTIONAL_EVENT` y `OTHER` no son categorías obligatorias del
calendario MVP.

Las tres razones requeridas por el alcance son suficientes:

```text
HOLIDAY
VACATION
EXAM_PERIOD
```

Una incidencia operativa futura puede cancelar o suspender una salida
materializada sin convertir esa incidencia en una nueva razón de calendario.

### 8.3 Patrones de excepción

No se crea `ServiceExceptionTime` separado. Reutilizar `ScheduleTime` dentro de
un patrón de excepción mantiene una sola semántica relacional de hora sin
introducir JSON ni duplicar constraints.

El vínculo correcto es:

```text
ServiceException 1 → N SchedulePattern de excepción
```

Esto permite un patrón de reemplazo para IDA y otro para RETORNO. Los patrones
de excepción no tienen `SchedulePatternDay`, porque su fecha efectiva ya está
determinada por `ServiceException.serviceDate`.

## 9. Precedence

### 9.1 Regla definitiva

Para `(ServiceLine, serviceDate, direction)`:

```text
1. excepción publicada específica de direction
2. excepción publicada global (direction = NULL)
3. patrón regular publicado aplicable al weekday
4. no service
```

La primera excepción encontrada gana exclusivamente. No se combinan una
excepción específica y una global.

### 9.2 Caso ambiguo solicitado

Si existe:

```text
Global: NO_SERVICE
IDA:    ADD_TIMES 10:00
```

el resultado es:

```text
IDA     → horario regular de IDA + 10:00
RETORNO → sin servicio
```

La excepción específica de IDA sustituye la global únicamente para IDA. La
global continúa aplicando a Retorno. Esto evita resultados contradictorios y
permite declarar excepciones por sentido.

### 9.3 Efectos

```text
NO_SERVICE     → []
REPLACE_TIMES  → solo tiempos del patrón de excepción
ADD_TIMES      → unión de regular + excepción, deduplicada por TIME
```

La deduplicación de `ADD_TIMES` se hace por hora local antes de preparar una
departure. Una futura unique de departure evita duplicados materiales.

## 10. Calendar Overlap

### 10.1 Decisión

Se prohíben calendarios `PUBLISHED` solapados para la misma
`ServiceLine`.

No se añade `priority` al calendario porque las excepciones ya cubren cambios
puntuales y una prioridad entre semestres introduciría otra regla de resolución
innecesaria.

Los drafts pueden solaparse mientras se editan, pero publicar debe fallar si
la fecha efectiva queda ambigua.

### 10.2 Implementación futura

La implementación debe combinar:

1. validación de aplicación dentro de la transacción de publicación;
2. `CHECK(validFrom <= validUntil)`;
3. preferiblemente una constraint PostgreSQL de exclusión con rango
   `daterange` para impedir carreras entre dos publicaciones concurrentes.

Prisma no debe simular esta garantía con una lectura previa no protegida.

### 10.3 Excepción global y `NULL`

La unicidad lógica requerida es:

```text
máximo una global por (calendar, date)
máximo una específica por (calendar, date, direction)
```

Un `UNIQUE` común no evita dos filas con `direction = NULL` en PostgreSQL.
La migración futura debe usar índices parciales SQL o un modelo explícito de
alcance. Este punto es bloqueante para schema implementation hasta que se
revise el SQL generado.

## 11. Time Model

| Dato | Representación | Regla |
|---|---|---|
| `serviceDate` | PostgreSQL `DATE` | Fecha civil local |
| `departureTime` | PostgreSQL `TIME(0)` | Hora local, no UTC |
| `approximateArrivalTime` | PostgreSQL `TIME(0)` nullable | Referencia aproximada |
| `timezone` | IANA string en calendar | `America/Guayaquil` |
| `createdAt`/eventos | timestamp con instante | UTC/TIMESTAMPTZ futuro |

La función conceptual debe combinar fecha y hora en
`America/Guayaquil` solo cuando necesite comparar con “ahora” o crear una
departure. No debe transformar 06:40 local a 11:40 UTC y perder la hora
conceptual.

`America/Guayaquil` es preferible a `UTC-5`: documenta la zona de negocio y
evita depender de un offset codificado. No se añade lógica DST personalizada.

## 12. ScheduledDeparture Readiness

### 12.1 Resultado de la auditoría

El diseño deja preparada la entidad futura sin implementarla. Su identidad
natural recomendada es:

```text
(serviceLineId, direction, serviceDate, scheduledTime)
```

Debe conservar proveniencia de `SchedulePattern` y, si aplica, de la
`ServiceException` que produjo la hora.

### 12.2 Reglas de materialización futura

La materialización debe recibir una ventana explícita:

```text
generate(serviceDateFrom, serviceDateUntil)
```

No debe calcular toda la programación indefinidamente en cada request ni
generar automáticamente hasta fin de año.

Debe ser:

- idempotente;
- acotada por fechas;
- basada en el resolver efectivo;
- consciente de `NO_SERVICE`, `REPLACE_TIMES` y `ADD_TIMES`;
- capaz de reportar creadas, existentes, omitidas y ambiguas;
- no destructiva con salidas operadas, canceladas o auditadas.

`RoutePath` no participa en la generación. Se asignará posteriormente por bus:

```text
ScheduledDeparture
  → ServiceAssignment
      → RoutePath + Vehicle + Driver
          → ServiceRun
```

### 12.3 Cambio de reglas

Una corrección de horarios solo puede reconciliar departures futuras en estado
editable. No debe mutar silenciosamente salidas que ya tengan operación,
assignment, cancelación o historial.

## 13. Legacy Compatibility

### 13.1 Estado actual verificado

El schema vigente conserva:

```text
Schedule.routeId
Schedule.dayOfWeek
Schedule.direction: String
Schedule.departureTime: String
Schedule.approximateArrivalTime: String?
Schedule.status
```

Evidencia: `apps/api/prisma/schema.prisma:195-210`.

La auditoría previa registra 90 filas `Schedule`. El modelo nuevo no debe
reinterpretarlas automáticamente.

### 13.2 Regla de preservación

- no eliminar, renombrar ni vaciar `Schedule`;
- conservar IDs, dirección textual y strings legacy;
- mantener `/mobile/routes/:id/schedules` y su DTO;
- no cambiar la forma JSON legacy por debajo del consumidor;
- mantener legacy como lectura pública hasta completar dual read;
- si falta mapping, continuar con legacy y marcar `NEEDS_REVIEW` en el proceso
  de análisis futuro.

### 13.3 Conversión conceptual

```text
Schedule legacy
  → SchedulePattern regular
      → SchedulePatternDay
      → ScheduleTime
```

No se puede producir una departure real solo desde `Schedule`, porque no tiene
vigencia. Primero deben aprobarse `ServiceLine`, calendario y fechas.

### 13.4 Dirección y hora

Solo se convierten strings con mapping explícito:

```text
"IDA" → IDA
"RETORNO" → RETORNO
```

`Norte`, `Vuelta`, `Centro` u otros valores no confirmados deben detener el
registro o marcarlo para revisión. Lo mismo aplica a horas que no cumplan
`HH:mm`. No se asigna dirección por nombre, orden o proximidad.

## 14. Backfill

### 14.1 No ejecutado

No se hizo backfill, no se hicieron escrituras de base y no se ejecutaron
`INSERT`, `UPDATE`, `DELETE`, `prisma migrate` ni `prisma db push`.

### 14.2 Prerrequisitos

El futuro backfill requiere:

1. mapping aprobado de las siete rutas;
2. catálogo oficial de `Campus`, `ServiceLine`, `RoutePath` y paradas;
3. dirección canónica aprobada;
4. fechas oficiales de calendario;
5. feriados, vacaciones y exámenes confirmados;
6. confianza explícita de hora local Guayaquil;
7. política para duplicados y horarios inválidos;
8. ventana aprobada para materializar departures.

### 14.3 Dry run

El proceso futuro debe producir, sin escribir:

```text
candidate
warnings
conflicts
duplicates
unmapped
needs_review
```

Debe conservar relación fila-origen para cada uno de los 90 schedules y ser
idempotente. La falta de mapping no puede convertirse en un mapping aproximado.

### 14.4 Secuencia segura

```text
expand → dry run → aprobación → backfill nuevo → shadow read → switch
```

El modelo legacy queda intacto durante todas las primeras etapas.

## 15. Admin UX

El futuro Admin Web puede resolver 5B con una experiencia de operación, no con
un CRUD plano:

```text
Campus Centenario
  → Ruta Norte
      → Calendario académico 2026-2
          → IDA
              → lunes-viernes
                  → 06:40, 08:30, 17:00
```

Capacidades mínimas:

- crear y previsualizar calendario draft;
- mostrar fechas y timezone de forma visible;
- detectar solapamientos antes de publicar;
- crear patrones por sentido y días;
- capturar horas `HH:mm` explícitas;
- crear excepciones por fecha o lote de fechas;
- previsualizar resultado regular, reemplazado, agregado o sin servicio;
- publicar, archivar y cancelar con confirmación;
- registrar todas las mutaciones en `AuditLog`.

No debe permitir en 5B:

- asignar bus/conductor;
- elegir `RoutePath` para una salida;
- iniciar un run;
- editar directamente los 90 schedules legacy como si fueran canónicos;
- publicar datos sin mapping o fecha oficial.

## 16. Constraints

### Aprobadas conceptualmente

```text
CHECK(validFrom <= validUntil)
UNIQUE(patternId, weekday)
UNIQUE(patternId, departureTime)
```

### Requieren SQL o validación reforzada

```text
no overlap de calendars PUBLISHED por serviceLine y fecha
una excepción global por calendar + date
una excepción específica por calendar + date + direction
pattern de excepción y exception del mismo calendar
```

### Requieren application/domain validation

- calendario y patrón publicados deben pertenecer a una línea activa;
- patrón regular necesita al menos un día y un tiempo;
- patrón `REPLACE_TIMES` necesita tiempos;
- patrón de excepción no puede entrar en resolución regular;
- excepción debe estar dentro de la vigencia del calendario;
- horas deben ser válidas y ordenables;
- un calendario publicado no puede quedar ambiguo.

### Índices

Los índices mínimos razonables son:

```text
ServiceCalendar(serviceLineId, validFrom, validUntil, status)
SchedulePattern(serviceCalendarId, direction, status)
SchedulePattern(exceptionId, direction)
ServiceException(serviceCalendarId, serviceDate, status, direction)
```

No se recomienda agregar índices globales de baja selectividad ni duplicar los
índices que ya crean constraints únicas.

## 17. Risks

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Calendarios publicados solapados | HIGH | Validación transaccional + exclusión PostgreSQL |
| Dos excepciones globales por `NULL` | HIGH | Índices parciales SQL |
| Mapping legacy hipotético | HIGH | Binding aprobado, dry run y `NEEDS_REVIEW` |
| Hora local interpretada como UTC | HIGH | `DATE` + `TIME` + IANA timezone |
| Excepción específica/global combinada | MEDIUM | Primera coincidencia por especificidad, exclusiva |
| Pattern variable perdido por simplificación | MEDIUM | `SchedulePatternDay` |
| Estados editoriales ambiguos | MEDIUM | `DRAFT/PUBLISHED/ARCHIVED`, sin `isActive` duplicado |
| Vacaciones modeladas como una fila de período opaca | MEDIUM | Excepciones diarias idempotentes |
| Incidencia operativa mezclada con calendario | MEDIUM | Incidencias posteriores sobre departure/run |
| Sobrearquitectura de frecuencia | LOW | Solo `EXPLICIT_TIMES` en MVP |

## 18. Findings

### F5B-01 — Categorías de excepción más amplias que el MVP

**Severidad:** MEDIUM — **RESUELTO EN DISEÑO**

**Evidencia:** el blueprint inicial incluía `WEATHER`, `MAINTENANCE`,
`INSTITUTIONAL_EVENT` y `OTHER` junto con feriados, vacaciones y exámenes.

**Impacto:** convertía hechos operativos futuros en parte del contrato de
calendario y ampliaba el enum sin necesidad demostrada.

**Corrección:** se dejaron `HOLIDAY`, `VACATION` y `EXAM_PERIOD`; cancelaciones,
suspensiones y desvíos quedan para departures/incidencias posteriores.

### F5B-02 — Duplicidad entre estado editorial e `isActive`

**Severidad:** MEDIUM — **RESUELTO EN DISEÑO**

**Evidencia:** Calendar y Pattern combinaban `DRAFT/PUBLISHED/ARCHIVED` con
`isActive`.

**Impacto:** dos fuentes de verdad para publicación y archivo.

**Corrección:** el ciclo editorial usa status; no se agrega `isActive` paralelo.

### F5B-03 — Unicidad de excepción global no resoluble con UNIQUE simple

**Severidad:** HIGH — **ABIERTO PARA IMPLEMENTACIÓN**

**Evidencia:** `ServiceException.direction` es nullable y PostgreSQL permite
múltiples `NULL` en un índice único ordinario.

**Impacto:** pueden existir dos excepciones globales para el mismo calendario y
fecha, dejando la resolución no determinista.

**Recomendación:** índices parciales SQL o tabla de alcance explícito, con prueba
de concurrencia y revisión del SQL de migración.

### F5B-04 — Solapamiento de calendarios no protegido por pseudo-Prisma

**Severidad:** HIGH — **ABIERTO PARA IMPLEMENTACIÓN**

**Evidencia:** `validFrom/validUntil` e índice compuesto no impiden por sí solos
dos intervalos publicados que cubren la misma fecha.

**Impacto:** el resolver no sabría qué calendario usar.

**Recomendación:** prohibición de publicación con transacción y constraint de
exclusión PostgreSQL si el equipo aprueba la extensión; no confiar en una
lectura previa sin lock.

### F5B-05 — Scope de calendario y fechas oficiales aún no aprobados

**Severidad:** HIGH — **ABIERTO DE NEGOCIO**

**Evidencia:** el decision pack mantiene pendientes calendario institucional,
feriados, vacaciones, exámenes y mapping de las rutas.

**Impacto:** implementar schema sin esos datos permitiría crear estructura pero
no garantiza que el servicio publicado sea real.

**Recomendación:** aprobar primero el paquete de fechas y reglas; no ejecutar
backfill ni cargar catálogo oficial por inferencia.

### F5B-06 — `SchedulePatternDay` aumenta una relación, pero está justificada

**Severidad:** LOW — **ACEPTADO**

**Evidencia:** permite separar lunes-jueves de viernes y no duplica
`ScheduleTime`.

**Impacto:** una query adicional y una tabla más en el MVP.

**Recomendación:** mantenerla porque resuelve horarios variables reales y tiene
una constraint simple. No sustituirla por bitmask, array o JSON.

### F5B-07 — Actor duplicado en excepción

**Severidad:** LOW — **RESUELTO EN DISEÑO**

**Evidencia:** el modelo proponía `createdById` y también existe `AuditLog`.

**Impacto:** duplicación de ownership y riesgo de divergencia.

**Corrección:** el blueprint retiró `createdById`; publicación/cambios se
auditan con el servicio existente.

### F5B-08 — Índices redundantes de horas y weekdays

**Severidad:** LOW — **RESUELTO EN DISEÑO**

**Evidencia:** índices separados repetían las claves únicas o filtraban un enum
de baja selectividad.

**Corrección:** se conservan solo los índices compuestos necesarios y los que
crean las constraints únicas.

## 19. Corrections Applied

Durante esta auditoría se modificó únicamente:

```text
docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_DESIGN.md
```

Correcciones aplicadas:

1. razones de excepción limitadas a `HOLIDAY`, `VACATION` y `EXAM_PERIOD`;
2. eliminación de `FREQUENCY` del enum mínimo implementable;
3. eliminación de `isActive` redundante en Calendar y Pattern;
4. eliminación de `isActive` redundante en `ScheduleTime`;
5. eliminación de índices duplicados;
6. eliminación de `createdById` duplicado frente a `AuditLog`;
7. inclusión explícita de publicación/archivo y sus límites;
8. incorporación de la regla de excepción dentro de vigencia del calendario;
9. separación explícita entre incidencias futuras y reglas de calendario.

No se modificó:

```text
apps/api
apps/mobile
apps/api/prisma/schema.prisma
apps/api/prisma/migrations
seed
base de datos
contratos API
apps/web
```

## 20. Decision

### Decisión de auditoría

```text
FASE 5B DESIGN:                 APPROVED FOR REVIEW
DOMAIN MODEL:                   GO
CALENDAR MODEL:                 GO
SCHEDULE PATTERN:               GO
WEEKDAY MODEL:                  GO
EXPLICIT TIME MODEL:            GO
EXCEPTION MODEL:               GO WITH MVP LIMITS
SCHEDULED DEPARTURE READINESS: GO FOR 5C DESIGN
LEGACY COMPATIBILITY:           GO — PRESERVE 90 ROWS
SCHEMA IMPLEMENTATION:          CONDITIONAL GO, NOT AUTHORIZED NOW
MIGRATION:                      NO-GO
BACKFILL:                       NO-GO
MOBILE/API CONTRACT CHANGE:     NO-GO
```

### Condiciones para autorizar Schema Implementation

Antes de escribir Prisma o una migración deben aprobarse:

- fechas y calendario institucional oficial;
- feriados, vacaciones y exámenes;
- política de excepción global versus direccional;
- mapping de las siete rutas y 90 schedules;
- constraints parciales/exclusión y SQL generado;
- protocolo de publicación y archivo;
- ventana de materialización de departures;
- dry run reproducible y reporte aprobado.

### Evidence Gate ejecutado

Se verificó:

```text
HEAD == origin/main
87857d69f6e7187d0f3076c9f58e8bdb87a1714d

git diff -- apps/api/prisma/schema.prisma
→ sin salida

git diff -- apps/api
→ solo cambios históricos preexistentes del worktree

git diff -- apps/mobile
→ solo cambios históricos preexistentes del worktree
```

El worktree ya estaba sucio antes de esta auditoría; por eso no se interpreta
un diff total vacío como evidencia de limpieza global. No se hizo commit, push ni
PR, conforme al alcance.

### Estado final

```text
FASE 5B REVIEW:                 CLOSED
SCHEMA IMPLEMENTATION:          WAITING FOR APPROVALS
PHASE 5C DESIGN:                READY TO START AFTER APPROVAL
```
