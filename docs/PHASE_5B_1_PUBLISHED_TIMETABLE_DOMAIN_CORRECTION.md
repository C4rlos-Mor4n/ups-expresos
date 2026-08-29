# UPS GO — FASE 5B.1 PUBLISHED TIMETABLE & SCHEDULED STOP TIMES DOMAIN CORRECTION

**Estado:** `DESIGN CORRECTION COMPLETE` / `NO-GO IMPLEMENTATION`

**Baseline auditado:** `87857d69f6e7187d0f3076c9f58e8bdb87a1714d`

**Alcance:** diseño y auditoría de dominio únicamente.

**Fecha:** 2026-08-28

## 1. Propósito y autoridad

La revisión de Fase 5B cerró correctamente la recurrencia, el calendario, los
días de semana, la vigencia, las excepciones y la prioridad de excepción sobre
el calendario regular. Esta corrección no reabre esas decisiones. Añade lo que
faltaba para representar una tabla publicada de transporte:

```text
hora de salida
  → camino exacto de esa salida
      → hora planificada en cada parada
```

La evidencia usada es únicamente:

- `docs/PHASE_5_1_CAMPUS_ROUTEPATH_DOMAIN_CORRECTION.md`;
- `docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_DESIGN.md`;
- `docs/PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_REVIEW.md`;
- `docs/ups_go_routes_reference_guayaquil.json`;
- el schema y el código actuales, inspeccionados sin modificarlos.

La revisión anterior de 5B sigue siendo válida para recurrencia y calendario.
Esta fase la complementa con requisitos de timetable que no estaban cubiertos.

## 2. Límites estrictos de esta fase

No se hizo ni se autoriza en esta fase:

- cambio en `apps/api` o `apps/mobile`;
- cambio en `apps/api/prisma/schema.prisma`;
- creación o ejecución de migraciones;
- `INSERT`, `UPDATE`, `DELETE`, `prisma migrate` o `prisma db push`;
- cambio de contratos API u OpenAPI;
- creación de `apps/web`;
- backfill de los 90 `Schedule` legacy;
- carga productiva del JSON de referencia;
- commit, push, PR o merge.

El JSON permanece en `docs/ups_go_routes_reference_guayaquil.json` como
referencia/fixture futura. Su propio estado es
`REFERENCE_DATASET_NOT_PRODUCTION`; no se movió, copió ni convirtió en seed
ejecutable.

## 3. Evidencia del dataset de Guayaquil

El análisis fue estructural y read-only. El dataset declara zona
`America/Guayaquil`, dos campus, tres líneas, catorce paradas, siete caminos,
quince configuraciones de servicio, cincuenta y cuatro viajes y trescientas
cincuenta y siete horas de parada.

| Evidencia | Resultado |
|---|---:|
| `campuses` | 2 |
| `serviceLines` | 3 |
| `stops` | 14 |
| `routePaths` | 7 |
| `services` | 15 |
| `trips` | 54 |
| `stopTimes` | 357 |
| perfiles | `REGULAR`, `ADMINISTRATIVOS_ESTUDIANTES`, `SATURDAY` |
| conjuntos de días | lunes-viernes, sábado |
| secuencias inválidas detectadas | 0 |
| primera parada distinta de la salida | 0 |
| llegada declarada distinta de la última parada | 0 |
| stop IDs fuera de su camino | 0 |
| cruces de medianoche observados | 0 |

Las tres líneas de referencia son:

```text
NORTE       → Ruta Norte
SUR         → Ruta Sur
URB_LA_JOYA → Ruta Urb. La Joya
```

Los siete caminos no son siete líneas. Incluyen, entre otros, dos variantes de
`SUR` en `IDA`: `SUR_IDA_WEEKDAY` tiene seis paradas y
`SUR_IDA_SATURDAY` tiene cinco. Esa diferencia se debe modelar como caminos
distintos, no como una parada opcional o una columna de horario en
`RoutePathStop`.

La referencia también contiene dos campus y una conexión con
`Campus Centenario - Edificio La Joya`. Su clasificación institucional no debe
deducirse automáticamente como `INTERCAMPUS`; permanece pendiente de
confirmación de negocio, tal como advierte el dataset.

## 4. Hallazgos que corrigen el diseño anterior

### 4.1 `ScheduleTime` solo no publica una ruta

El modelo de 5B responde a la hora de partida, pero no puede responder de
forma completa:

```text
¿qué camino exacto usa la salida de las 08:30?
¿cuál es la hora publicada en Mi Comisariato para esa salida?
¿la salida de sábado usa el mismo ramal que la de lunes?
```

Agregar `routePathId` directamente a `ScheduleTime` resolvería solo un camino
por hora y dejaría sin representación una salida con varios caminos o varias
tablas de parada. Tampoco conserva la identidad de la tabla planificada como
unidad reutilizable por operación futura.

### 4.2 `RoutePathStop` no debe contener horarios

`RoutePathStop` define pertenencia y orden físico:

```text
RoutePath + Stop + stopOrder
```

El dataset prueba que el tiempo depende de la salida: los offsets de una misma
línea y camino cambian según el viaje. Si se almacenaran en `RoutePathStop`, la
segunda salida sobrescribiría conceptualmente a la primera y se perdería la
tabla publicada.

### 4.3 Los offsets no son constantes por camino

Los 15 servicios tienen al menos un stop con offset variable entre sus viajes.
Ejemplos auditados:

```text
NORTE / IDA / laborable / STOP_COLEGIO_AMERICANO
  → +25 y +20 minutos

NORTE / RETORNO / laborable / última parada
  → +60, +55 y +70 minutos

SUR / IDA / laborable / última parada
  → +65, +75 y +55 minutos

LA_JOYA / RETORNO / laborable / STOP_REDONDEL_LA_JOYA
  → +70 y +75 minutos
```

Por tanto, el tiempo planificado pertenece a la combinación de una salida y su
camino publicado. No pertenece a `RoutePath`, `RoutePathStop` ni a la línea en
abstracto.

### 4.4 La misma hora nominal puede tener más de una fuente

Se observaron 14 colisiones de `(lineCode, direction, departureTime)` entre
configuraciones de días o perfiles. La mayoría separa laborables de sábado,
pero `URB_LA_JOYA / IDA / 16:50` aparece en dos configuraciones laborables:

```text
REGULAR
ADMINISTRATIVOS_ESTUDIANTES
```

Ambas usan el mismo camino, pero no deben ser colapsadas sin verificar si son
la misma oferta pública, ofertas alternativas por perfil o dos instrucciones
operativas distintas. La diferencia de origen se conserva mediante su
`SchedulePattern`, `ScheduleTime` y `ScheduleJourneyTemplate`.

Esta evidencia obliga a que el futuro materializador no deduzca una tabla de
paradas solo por `(línea, sentido, hora)`. Debe resolver y conservar todas las
plantillas aplicables. Si el producto exige una sola tabla pública, la
ambigüedad de perfil debe ser aprobada antes del backfill.

## 5. Decisión de nombre y semántica

El nombre elegido es **`ScheduleJourneyTemplate`**.

Se descartan como nombre principal:

- `Journey`: demasiado genérico; puede confundirse con un viaje real;
- `Timetable`: describe la publicación completa, no la relación concreta entre
  una salida y un camino;
- `RouteSchedule`: puede confundirse con un calendario de línea;
- `Trip`: sugiere una ejecución real y compite semánticamente con
  `ServiceRun`.

`ScheduleJourneyTemplate` significa una plantilla de recorrido planificado que
pertenece a un `ScheduleTime`, usa un `RoutePath` concreto y contiene sus
tiempos planificados por parada. No representa bus, conductor, GPS ni una
ejecución.

La entidad de detalle se llama **`ScheduledStopTime`**. El prefijo
`Scheduled` indica que es una hora prevista/publicada y evita confundirla con
un ETA o una observación.

## 6. Modelo corregido

La relación normativa queda así:

```text
Campus
  → ServiceLine
      → ServiceCalendar
          → SchedulePattern
              → SchedulePatternDay
              → ScheduleTime
                  → ScheduleJourneyTemplate[]
                      → RoutePath
                      → ScheduledStopTime[]
                          → RoutePathStop
```

### 6.1 Responsabilidad de cada nivel

| Entidad | Responsabilidad | No debe contener |
|---|---|---|
| `ServiceCalendar` | vigencia, zona y publicación de una línea | horarios por parada |
| `SchedulePattern` | sentido y regla recurrente o excepcional | vehículo o posición |
| `SchedulePatternDay` | día civil de semana | hora libre en texto |
| `ScheduleTime` | hora de partida de una salida lógica | camino único obligatorio |
| `ScheduleJourneyTemplate` | camino y tabla planificada de esa salida | estado real del bus |
| `ScheduledStopTime` | offset planificado para una parada del template | ETA observado |
| `RoutePath` | camino reutilizable y su sentido | minutos dependientes de la salida |
| `RoutePathStop` | parada y orden del camino | hora específica de una salida |

### 6.2 Cardinalidades

```text
SchedulePattern 1 ── N ScheduleTime
ScheduleTime 1 ── N ScheduleJourneyTemplate
ScheduleJourneyTemplate N ── 1 RoutePath
ScheduleJourneyTemplate 1 ── N ScheduledStopTime
ScheduledStopTime N ── 1 RoutePathStop
```

La cardinalidad `ScheduleTime 1 → N ScheduleJourneyTemplate` es deliberada:

- permite varios caminos publicados para una misma salida;
- permite varios buses futuros asignados a la misma oferta sin duplicar el
  calendario;
- conserva tablas distintas cuando una fuente de horario las declara;
- no fuerza a poner un `routePathId` único en `ScheduleTime`.

Una plantilla concreta es única por `(scheduleTimeId, routePathId)` dentro del
modelo mínimo. Si el negocio necesita dos tablas distintas para el mismo
camino y hora, no se deben sobrescribir: se requiere una decisión explícita
de versión/perfil antes de relajar esa unicidad.

## 7. Tiempos absolutos frente a offsets

### 7.1 Alternativas consideradas

| Opción | Ventaja | Riesgo |
|---|---|---|
| `plannedTime TIME` por parada | coincide con la imagen fuente y es fácil de leer | repite la salida, puede divergir y no expresa bien el día siguiente |
| `offsetMinutes INT` desde la salida | elimina duplicación, conserva variación por viaje y compone fecha + hora | la UI debe derivar la hora visible |
| ambos valores | fácil auditoría visual | dos fuentes de verdad; exige sincronización y más invariantes |

### 7.2 Decisión

El valor canónico será **`offsetMinutes`** en `ScheduledStopTime`.

```text
plannedStopDateTime
  = serviceDate en America/Guayaquil
  + ScheduleTime.departureTime
  + offsetMinutes
```

Reglas:

- el primer stop del template tiene offset `0`;
- los offsets son enteros no negativos en minutos;
- los offsets respetan el orden de `RoutePathStop.stopOrder`;
- un cruce de medianoche se expresa con un offset que hace avanzar la fecha;
- no se redondean minutos del origen;
- la hora absoluta del JSON es evidencia de entrada, no una segunda columna
  persistida automáticamente;
- la UI devuelve `HH:mm` y, si corresponde, la fecha local resultante.

El dataset auditado no contiene cruces de medianoche, pero el diseño no debe
romperse si una futura salida sale a las 23:50 y una parada ocurre después de
las 00:00. `TIME` sirve para la salida; la combinación con fecha civil y
offset sirve para la parada.

## 8. Pseudo-schema propuesto — diseño, no implementación

El siguiente bloque es intencionalmente conceptual. No autoriza editar
`schema.prisma` ni generar una migración.

```prisma
// DESIGN ONLY — NOT IMPLEMENTED
model ScheduleTime {
  id                     String   @id @default(uuid()) @db.Uuid
  schedulePatternId     String   @db.Uuid
  departureTime         DateTime @db.Time(0)
  approximateArrivalTime DateTime? @db.Time(0)
  createdAt              DateTime @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime @updatedAt @db.Timestamptz(3)

  pattern          SchedulePattern
  journeyTemplates ScheduleJourneyTemplate[]

  @@unique([schedulePatternId, departureTime])
  @@map("schedule_times")
}

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
  id                String   @id @default(uuid()) @db.Uuid
  journeyTemplateId String   @db.Uuid
  routePathStopId   String   @db.Uuid
  offsetMinutes     Int
  createdAt         DateTime @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime @updatedAt @db.Timestamptz(3)

  journeyTemplate ScheduleJourneyTemplate @relation(fields: [journeyTemplateId], references: [id])
  routePathStop   RoutePathStop           @relation(fields: [routePathStopId], references: [id])

  @@unique([journeyTemplateId, routePathStopId])
  @@index([journeyTemplateId, offsetMinutes])
  @@map("scheduled_stop_times")
}
```

La relación `pattern` es singular porque un `ScheduleTime` pertenece a un solo
`SchedulePattern`. El bloque es diseño conceptual y no una migración lista
para ejecutar.

La implementación debe validar además que:

1. el template y su `ScheduleTime` pertenecen a la misma `ServiceLine` y
   `Direction` por sus relaciones padre;
2. el `RoutePath` pertenece a esa misma línea y sentido;
3. cada `RoutePathStop` pertenece al `RoutePath` del template;
4. el template contiene exactamente los stops de su `RoutePath`, en el mismo
   orden;
5. el primer offset es cero y los siguientes no disminuyen;
6. no existe un stop duplicado dentro del template;
7. un ramal con secuencia diferente es un `RoutePath` distinto;
8. no se persisten campos de vehículo, conductor, ETA, GPS o estado real en
   estas tablas.

En una implementación real se debe decidir si las invariantes 1–3 se
refuerzan con claves foráneas compuestas, triggers/constraints SQL o validación
transaccional de aplicación. Prisma no debe ocultar una regla de integridad
que dependa de más de una entidad.

## 9. Recurrencia, excepciones y publicación

El timetable no reemplaza a la recurrencia. Se compone sobre ella:

```text
ServiceCalendar vigente
  → SchedulePattern aplicable al día
      → ScheduleTime efectivo
          → ScheduleJourneyTemplate(s)
              → ScheduledStopTime(s)
```

La resolución mantiene las decisiones de 5B:

- una excepción publicada tiene prioridad sobre la regla regular;
- `NO_SERVICE` no produce salidas ni templates efectivos;
- `REPLACE_TIMES` sustituye las horas del alcance afectado;
- `ADD_TIMES` agrega horarios sin duplicar una salida efectiva;
- una excepción global y una específica por dirección se resuelven con
  prioridad específica;
- un template de excepción reutiliza el mismo `RoutePath` o un camino
  aprobado distinto si el cambio de servicio lo requiere;
- nunca se confunde un horario publicado con un bus en recorrido.

Publicar un calendario exige que sus templates estén completos. Un calendario
`DRAFT` puede tener datos incompletos para edición, pero un resolver público no
debe devolver una salida sin su tabla de paradas requerida o marcarla como
operativa por el mero hecho de tener `ScheduleTime`.

## 10. Preparación de `ScheduledDeparture`

`ScheduledDeparture` sigue siendo una instancia civil materializada para una
fecha concreta. Su responsabilidad mínima es:

```text
ServiceLine + Direction + serviceDate + scheduledTime
```

No debe contener directamente el único `routePathId`. Ese vínculo rompería la
cardinalidad corregida. La preparación futura debe conservar la procedencia
completa:

```text
ScheduledDeparture
  → ScheduledDepartureTemplate[]
      → ScheduleJourneyTemplate
          → RoutePath
          → ScheduledStopTime[]
```

`ScheduledDepartureTemplate` se deja como relación/tabla puente conceptual
para 5C si una fecha/hora efectiva proviene de más de un `ScheduleTime` o
template. El puente evita perder el caso observado de perfiles concurrentes o
de fuentes que producen la misma hora nominal.

La clave natural de `ScheduledDeparture` puede seguir siendo
`(serviceLineId, direction, serviceDate, scheduledTime)` solo si el negocio
confirma que existe una sola oferta pública por esa clave. Si existen perfiles
simultáneos que el estudiante debe distinguir, se necesita incorporar un
`serviceProfile`/producto al dominio de salida o confirmar que una sola salida
contendrá varios templates. No se debe elegir silenciosamente una de las dos
tablas.

### 10.1 Asignación y operación futura

La secuencia operacional recomendada es:

```text
ScheduledDeparture
  → ServiceAssignment
      → ScheduleJourneyTemplate
          → RoutePath
      → recurso/bus asignado
  → ServiceRun
      → estado real, GPS, ETA e incidencias
```

La asignación debe referenciar el `ScheduleJourneyTemplate` cuando sea
importante conservar la tabla exacta de paradas. El `RoutePath` se deriva de
ese template. Guardar simultáneamente `journeyTemplateId` y `routePathId` solo
es seguro con una restricción que impida que diverjan; de lo contrario crea
dos fuentes de verdad.

Una salida programada sin assignment sigue siendo válida y visible como
programada. Solo `ServiceRun` iniciado puede producir estado «en recorrido».

## 11. Compatibilidad con los 90 `Schedule` legacy

La compatibilidad permanece absoluta:

- las 90 filas `Schedule` conservan IDs, valores y contratos actuales;
- no se renombran, eliminan, vacían ni reescriben en esta fase;
- el endpoint legacy mantiene su shape mientras haya consumidores;
- no se hace backfill automático desde una fila legacy;
- un `Schedule` legacy no basta para crear `ScheduledDeparture`: faltan
  fechas de vigencia, calendario publicado y tabla de paradas;
- una dirección desconocida o un mapping ambiguo queda en revisión;
- el resolver nuevo no rellena silenciosamente el DTO legacy;
- legacy permanece como lectura pública hasta completar shadow read y
  comparación aprobada.

### 11.1 Mapping futuro

El backfill posterior deberá ser explícito y trazable:

```text
legacy Route
  → ServiceLine + RoutePath aprobado

legacy Schedule
  → ServiceCalendar aprobado
      → SchedulePattern + SchedulePatternDay
          → ScheduleTime
              → ScheduleJourneyTemplate
                  → ScheduledStopTime
```

Para crear los dos últimos niveles se necesita una fuente aprobada de:

- `routePath` exacto;
- cobertura de paradas;
- hora absoluta de cada parada o offsets calculables;
- perfil y alcance de días;
- evidencia de publicación.

Si solo existe la hora de salida legacy, se puede mapear como `ScheduleTime`
propuesto, pero el template queda `UNMAPPED` y no se publica como timetable
completo. El proceso debe reportar `UNMAPPED`, `PROPOSED`, `APPROVED` y
`REJECTED` por fila origen. Ninguna optimización de agrupación puede perder el
`legacyScheduleId`.

## 12. JSON de referencia y futuro fixture de desarrollo

El JSON es una fuente de evidencia y un candidato de fixture, no un seed de
producción. Antes de usarlo en desarrollo se debe validar:

1. `status === REFERENCE_DATASET_NOT_PRODUCTION`;
2. zona `America/Guayaquil`;
3. referencias de `serviceLine`, `routePath` y `stopId` resolubles;
4. secuencia del viaje igual a la secuencia del camino;
5. primera hora igual a `departureTime`;
6. última hora igual a `arrivalTime` cuando exista;
7. conversión exacta de horas absolutas a offsets enteros;
8. días de operación y perfil conservados como metadatos de fuente;
9. coordenadas con `requiresManualValidation` no promovidas a ubicación
   oficial sin revisión;
10. ningún `INSERT` productivo ni backfill implícito.

La forma futura del fixture puede ser:

```text
fixture service config
  → calendar/pattern/day
      → schedule time
          → journey template por trip y routePath
              → stop times por routePathStop y offset
```

Los 54 viajes dan 54 candidatos de plantilla si cada viaje fuente se conserva
como una salida planificada. Esto no autoriza a crear 54 registros reales ni a
afirmar que el catálogo institucional ya está aprobado.

## 13. Student UX derivada

La experiencia del estudiante debe preguntar primero por la oferta pública,
no por un bus imaginario:

```text
Hoy
  → Ruta Norte / Ruta Sur / Ruta La Joya
      → Ida o Retorno
          → próxima salida programada
              → paradas y horas planificadas
                  → estado real solo si existe ServiceRun
```

Reglas de presentación:

- mostrar «Programado» cuando solo existe calendario/timetable;
- mostrar «En recorrido» únicamente cuando existe un `ServiceRun` iniciado;
- mostrar la hora de cada parada derivada del template, no un ETA como si
  fuera exacto;
- indicar «sin servicio» en feriados, vacaciones o excepciones publicadas;
- no mostrar una parada omitida: si el ramal cambia, mostrar el camino
  publicado correspondiente;
- si dos perfiles producen la misma salida nominal y no hay decisión de
  audiencia, no ocultar una tabla arbitrariamente; la oferta queda pendiente
  de definición de producto.

## 14. Alcance Admin Web futuro

El Admin Web no debe comenzar por GPS ni por Driver Auth. Para esta parte del
dominio su alcance futuro es:

### Catálogo y caminos

- administrar `Campus`, `ServiceLine`, `RoutePath` y `RoutePathStop`;
- revisar paradas con coordenadas de baja confianza;
- visualizar diferencias entre caminos de lunes-viernes y sábado;
- impedir publicar un camino con secuencia inconsistente.

### Calendario y publicación

- crear borradores de `ServiceCalendar`;
- definir vigencia y zona;
- configurar días y `ScheduleTime` explícitos;
- asociar una o más `ScheduleJourneyTemplate` por salida;
- editar `ScheduledStopTime` en minutos relativos a la salida;
- previsualizar la tabla completa antes de publicar;
- administrar feriados, vacaciones, exámenes y excepciones por dirección;
- mostrar precedencia y conflictos antes de publicar.

### Auditoría y compatibilidad

- mostrar origen y evidencia de cada horario;
- revisar mappings legacy sin mutar los 90 registros originales;
- ejecutar dry run de backfill con reporte de ambiguos y faltantes;
- publicar una versión nueva sin reescribir salidas operadas;
- mantener `AuditLog` para cambios de catálogo y publicación.

Queda fuera de este alcance inicial: asignar buses reales, autenticar drivers,
recibir GPS, calcular ETA, despachar incidencias o declarar un viaje «en
recorrido». Esas capacidades pertenecen a 5C y fases posteriores.

## 15. Invariantes y pruebas requeridas

### Timetable

- `ScheduleTime` único por patrón y hora;
- template único por `(scheduleTimeId, routePathId)` en el MVP;
- cada `ScheduledStopTime` único por template y `RoutePathStop`;
- todos los stops del camino aparecen una vez;
- el primer offset es cero;
- offsets no negativos y no decrecientes;
- horas derivadas respetan la zona del calendario;
- no se acepta `RoutePathStop` de otro camino;
- no se publica un template incompleto.

### Integridad de dominio

- `ScheduleJourneyTemplate` y `ScheduleTime` comparten línea y sentido;
- template y camino comparten línea y sentido;
- un ramal diferente usa otro `RoutePath`;
- una modificación publicada genera nueva versión o reconcilia solo el futuro
  editable;
- un bus real solo aparece mediante assignment/run, no por tener timetable.

### Resolver

- regular M-F y sábado producen conjuntos correctos;
- excepciones `NO_SERVICE`, `REPLACE_TIMES` y `ADD_TIMES` respetan precedencia;
- la misma hora nominal con múltiples fuentes no se colapsa sin regla;
- materialización repetida no duplica una oferta efectiva aprobada;
- una salida puede conservar múltiples templates;
- un template no produce por sí solo un `ServiceRun`.

### Legacy y fixture

- los 90 `Schedule` permanecen byte-for-byte equivalentes en contenido;
- un mapping sin aprobación no genera timetable público;
- el fixture no ejecuta escrituras ni seed productivo;
- el JSON con `requiresManualValidation` queda marcado para revisión;
- no se inventa un `RETORNO` que la fuente no declare.

## 16. Gaps exactos antes de implementación

El modelo conceptual ya puede avanzar, pero estos puntos bloquean una
implementación segura:

1. aprobar si `ADMINISTRATIVOS_ESTUDIANTES` es un perfil visible, una variante
   interna o una oferta alternativa;
2. decidir si perfiles simultáneos con la misma hora son una
   `ScheduledDeparture` con varios templates o productos/salidas separadas;
3. confirmar si la clave natural de salida excluye o incorpora perfil;
4. aprobar catálogo oficial de líneas, campus, caminos y paradas;
5. aprobar fechas reales de vigencia del calendario;
6. aprobar los horarios y excepciones institucionales, incluidos feriados,
   vacaciones y semanas de exámenes;
7. decidir si el MVP admite offsets mayores a 24 horas o exige una fecha local
   explícita para cruces de medianoche;
8. definir el mecanismo SQL/aplicativo para validar pertenencia cruzada de
   línea, sentido, camino y parada;
9. definir versionado de templates publicados y política de reconciliación;
10. completar mapping de cada `Schedule` legacy a calendario, patrón, camino y
    tabla de paradas;
11. ejecutar dry run aislado del fixture y del backfill, sin escritura
    productiva;
12. aprobar el contrato Student/Admin antes de modificar API o Mobile.

No se debe cerrar ninguno de estos gaps inventando datos a partir del nombre de
una ruta o de una imagen.

## 17. Secuencia segura posterior

```text
5B.1 DESIGN CORRECTION                ← esta fase
  ↓ aprobación de gaps y modelo
5B IMPLEMENTATION DESIGN PACKAGE
  ↓ migración aditiva rehearse-only
5B IMPLEMENTATION
  ↓ resolver + lectura shadow + fixture DEV explícito
5C ScheduledDeparture + bridge de templates
  ↓
ServiceAssignment + ServiceRun
  ↓ decisiones posteriores
Driver Auth + GPS/ETA
```

La primera implementación autorizada debe ser aditiva, reversible y sin
backfill automático. Debe incluir pruebas de integridad, resolver de lectura,
auditoría, comparación con legacy y un dry run de materialización. El fixture
de desarrollo se puede ejecutar solo después de una autorización separada; no
es parte de este documento aplicado al repositorio.

## 18. GO / NO-GO final

```text
GO RECURRENCE MODEL:       YES — 5B remains valid
GO TIMETABLE MODEL:        YES — corrected with template + stop times
GO JOURNEY TEMPLATE:       YES — use ScheduleJourneyTemplate
GO SCHEMA IMPLEMENTATION:  NO — design only; schema not touched
GO MIGRATION:              NO — no migration until gaps and rehearsal close
GO DEV FIXTURE:            YES — design/validation only; execution not authorized
GO PRODUCTION BACKFILL:    NO — legacy and production remain untouched
GO PHASE 5C DESIGN:        YES — after this correction is approved
```

### Veredicto ejecutivo

**GO para el modelo de recurrencia y timetable.** La arquitectura ya puede
representar salidas explícitas, múltiples caminos por salida, ramales reales,
horarios por parada, excepciones y futura operación sin contaminar
`RoutePathStop` ni confundir programación con recorrido.

**NO-GO para implementar, migrar o hacer backfill.** La semántica de perfiles,
la identidad de salidas con hora coincidente, el catálogo oficial, las fechas
de vigencia y el mapping de los 90 `Schedule` todavía requieren aprobación y
dry run. En particular, no se debe convertir el JSON de referencia en datos
productivos ni resolver una colisión de perfil eligiendo una tabla al azar.

## 19. Estado de entrega

```text
PHASE 5B RECURRENCE:              VALIDATED BY THIS CORRECTION
PUBLISHED TIMETABLE MODEL:        DEFINED
SCHEDULED STOP TIMES:             DEFINED AS OFFSETS
SCHEDULE JOURNEY TEMPLATE:        DEFINED
ROUTE PATH STOP TIMES:            PROHIBITED
REFERENCE JSON:                   UNCHANGED / DEV-ONLY EVIDENCE
LEGACY 90 SCHEDULES:              PRESERVED / NOT BACKFILLED
PRISMA / MIGRATIONS:              NOT TOUCHED
API / MOBILE / WEB:               NOT TOUCHED
PHASE 5C:                         DESIGN MAY START AFTER APPROVAL
IMPLEMENTATION:                   NO-GO
```
