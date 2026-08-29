# UPS GO — Fase 4: Product, Domain & UX Blueprint

**Fecha:** 2026-08-28
**Modo:** auditoría estrictamente de solo lectura
**Alcance:** producto, dominio, operación diaria, Student UX y futuro Admin Web

## 1. Autoridad, alcance y límites de esta auditoría

La instrucción vigente de esta fase es la solicitud actual de Fase 4. Los textos adjuntos de auditorías anteriores se trataron como contexto histórico y decisiones previas que deben contrastarse con el repositorio, no como autorización para modificar código.

Durante esta fase:

- No se modificó `apps/api`.
- No se modificó `apps/mobile`.
- No se creó `apps/web`.
- No se tocó Prisma ni se generaron migraciones.
- No se cambiaron contratos API.
- No se alteró la identidad visual vigente de UPS GO.
- El único archivo nuevo de esta fase es este blueprint.

El worktree ya contenía cambios de la renombrada y de la identidad visual de UPS GO realizados en fases anteriores. Esos cambios se conservaron y no se mezclan con las conclusiones de este documento.

## 2. Resumen ejecutivo

El sistema actual tiene una base técnica funcional para un MVP: autentica estudiantes, expone rutas, paradas, horarios, avisos, vehículos, conductores, asignaciones y operaciones manuales. Sin embargo, su modelo actual representa principalmente **siete registros de ruta independientes**, no el servicio de transporte que el estudiante entiende como **Ruta Norte, Ruta Sur y Ruta La Joya**.

La diferencia no es cosmética. Afecta qué se muestra como disponible, qué salida está programada, qué bus está realmente en recorrido y cómo un administrador planifica un día con varios buses, horarios variables, retornos y ramales.

La conclusión de Fase 4 es:

> **GO condicional para iniciar el diseño/evolución del backend en Fase 5, una vez aprobada la semántica de negocio y confirmado el catálogo oficial de Norte, Sur y La Joya. NO-GO para implementar el backend nuevo, el Admin Web o una reestructuración móvil sobre el modelo actual sin cerrar primero esos gaps.**

El modelo actual debe mantenerse como contrato de compatibilidad mientras se construye un dominio canónico nuevo de forma incremental.

## 3. Evidencia revisada

### 3.1 Repositorio y contratos

- El repositorio contiene `apps/api` y `apps/mobile`; no existe `apps/web`.
- El contrato documentado en `apps/api/docs/handoff/API_CONTRACT_SUMMARY.md` declara 46 endpoints.
- El código también contiene `admin/route-assignments` y `driver/*`, que no aparecen en ese resumen. Con esos módulos, el inventario real supera el resumen documentado. Esto es un gap de documentación de contrato, no una razón para cambiar contratos durante esta fase.
- La API actual ya tiene CRUD administrativo para rutas, paradas, horarios, vehículos, conductores y avisos.
- No existe un controlador administrativo para tablero de operación diaria, calendario de servicio, incidencias, usuarios administrativos ni consulta de auditoría.
- `AuditLogsModule` expone el servicio internamente, pero no un endpoint de consulta para Admin Web.
- `TripsModule` expone el servicio internamente; las acciones de operación se exponen por `driver/*` y son manuales, sin GPS.

### 3.2 Modelo actual

La evidencia principal está en `apps/api/prisma/schema.prisma:129-356`:

- `Route` tiene `name`, `description`, `direction` como texto libre, `status` e `isActive`.
- `RouteStop` ordena paradas por ruta, pero no por una variante/ramal versionado.
- `Schedule` guarda día de semana, dirección como texto libre, hora de salida y llegada aproximada. No guarda vigencia, calendario, excepción, frecuencia, rancho/salida ni vínculo con una operación real.
- `RouteAssignment` vincula una ruta, conductor, bus y fecha; no vincula una salida programada concreta.
- `Trip` vincula una asignación, pero no una salida programada, una variante, un progreso por paradas ni una traza GPS.
- `Driver` mantiene `assignedVehicleId` y `assignedRouteId` como relaciones permanentes, aunque la operación diaria necesita asignaciones temporales.
- Los estados de `TripStatus` mezclan estado de una salida (`SCHEDULED`, `IN_PROGRESS`, etc.) con la noción de asignación y operación.

### 3.3 Datos actuales de base de datos

Se realizaron consultas `SELECT` de solo lectura sobre el contenedor local. Resultados:

| Entidad | Cantidad | Lectura de negocio |
|---|---:|---|
| Rutas | 7 | Son pares origen-destino, no las 3 líneas principales visibles al estudiante |
| Paradas | 14 | Catálogo compartido; 13 aparecen en dos o más rutas |
| Relación ruta-parada | 33 | Ya existe convergencia física, pero no concepto explícito de ramal |
| Horarios | 90 | Lunes a viernes; registros semanales fijos |
| Vehículos | 5 | 3 activos, 1 en mantenimiento, 1 inactivo |
| Conductores | 5 | 5 activos |
| Asignaciones | 4 | Todas fechadas el 2026-08-27 |
| Viajes | 1 | Un viaje completado; ninguno en curso al momento de consulta |
| Avisos | 6 | Hay base para comunicaciones publicadas con vigencia |

Las siete rutas actuales son:

1. Terminal Río Daule → Campus Centenario — `IDA`.
2. Campus Centenario → Terminal Río Daule — `RETORNO`.
3. Terminal 25 de Julio → Campus Centenario — `IDA`.
4. Campus Centenario → Terminal 25 de Julio — `RETORNO`.
5. Terminal Costa → Campus María Auxiliadora — `IDA`.
6. Campus María Auxiliadora → Terminal Costa — `RETORNO`.
7. Intercampus Centenario → María Auxiliadora — `IDA`.

No hay una entidad ni un registro cuyo nombre canónico sea literalmente Ruta Norte, Ruta Sur o Ruta La Joya.

El seed confirma que esos nombres existen solo en contexto legado o notas de demostración (`apps/api/prisma/seed-data.ts:174-238` y `633-665`). El propio seed indica que las asignaciones deben reemplazarse cuando operación confirme los turnos reales. Por eso no se debe inferir automáticamente el catálogo oficial a partir de `legacyNames`, descripciones o notas.

La base también muestra una inconsistencia operativa concreta: una asignación activa del 2026-08-27 usa `BUS-004`, cuyo estado actual es `MAINTENANCE`. La validación de creación exige un vehículo activo, pero no existe una regla que revalide o bloquee la asignación cuando el vehículo cambia de estado después.

### 3.4 API actual y separación servicio/operación

`apps/api/src/modules/mobile/mobile.service.ts:31-97` devuelve rutas planas y horarios activos. `buildCurrentOperation` en `:151-200` busca primero un viaje `IN_PROGRESS` y luego la última asignación del día.

Esto produce dos problemas de producto:

1. Una asignación `SCHEDULED` con conductor y bus puede aparecer como si fuera el estado operativo de la ruta, aunque ningún conductor haya iniciado el recorrido.
2. Solo se devuelve una `currentOperation` por ruta. No se pueden representar dos buses simultáneos, dos salidas del mismo horario ni varios ramales activos.

La distinción correcta debe ser explícita:

| Concepto | Significado | Visible para estudiante |
|---|---|---|
| Servicio programado | La institución publicó que una salida debería existir en una fecha/hora | Sí, como “Programado” |
| Salida asignada | El administrador reservó bus/conductor para esa salida | Puede mostrarse como dato administrativo; no equivale a bus en recorrido |
| Bus en recorrido | Una instancia operativa fue iniciada por el mecanismo autorizado | Sí, como “En recorrido” |
| Finalizado | La instancia operativa terminó | Sí, en historial o detalle |
| Cancelado/Suspendido | La salida o instancia fue anulada temporalmente o cancelada | Sí, con motivo y fecha |

La primera lectura del estudiante debe priorizar el servicio programado; la etiqueta “En recorrido” solo puede aparecer cuando exista una operación iniciada. La asignación por sí sola no debe activar esa etiqueta.

## 4. Diagnóstico del producto real

El estudiante no piensa en siete UUID ni en siete pares de terminal-campus. Su pregunta diaria es más simple:

> “¿Qué línea me sirve hoy, desde qué parada, en qué sentido, a qué hora sale y si ese bus realmente está operando?”

El vocabulario principal del producto debe ser:

- **Línea:** Norte, Sur o La Joya.
- **Sentido:** Ida o Retorno.
- **Variante/ramal:** recorrido específico dentro de una línea y sentido.
- **Parada:** punto compartido o propio del recorrido, con orden y tiempos estimados.
- **Salida programada:** fecha/hora publicada para el servicio.
- **Operación/salida real:** instancia concreta de un bus que puede iniciar, finalizar, suspenderse o cancelarse.

El nombre actual de cada recorrido puede conservarse como descripción operacional o compatibilidad, pero no debe seguir siendo el único identificador que el estudiante usa para descubrir el servicio.

## 5. Gaps exactos que bloquean la evolución directa

### Gap crítico 1 — No existe la entidad de línea

Norte, Sur y La Joya no están normalizadas. La aplicación no puede agrupar rutas, contar disponibilidad por línea, mostrar tres entradas principales ni asociar avisos a una línea de forma fiable.

### Gap crítico 2 — `direction` es texto libre y está duplicada

`Route.direction` y `Schedule.direction` son strings. No hay una relación formal entre un sentido de ida y su retorno ni validación de valores canónicos. Cualquier variación textual puede crear filtros o agrupaciones incompatibles.

### Gap crítico 3 — Los ramales no tienen representación

Un mismo servicio puede compartir parte de sus paradas y divergir después. El esquema solo permite una secuencia por `Route`; no expresa una línea, una variante, una vigencia de la secuencia ni el punto de convergencia/divergencia.

### Gap crítico 4 — El calendario es insuficiente

Los 90 horarios actuales son filas por día de semana. No existen período de vigencia, calendario académico/feriado, excepción por fecha, servicio suspendido para un día concreto, frecuencia, ventana horaria ni regla para horarios variables.

### Gap crítico 5 — Una asignación no representa una salida

`RouteAssignment` solo conoce ruta, conductor, bus y fecha. No conoce `scheduleId`, hora, variante ni número de salida. La regla de conflicto en `route-assignments.service.ts:198-225` considera conflicto cualquier segunda asignación de la misma ruta en el mismo día. Eso impide, por diseño, múltiples buses o múltiples salidas de una ruta durante una jornada.

### Gap crítico 6 — Operación actual confundida con programación

El fallback de operación móvil toma una asignación del día aunque esté `SCHEDULED`. Esto hace que bus y conductor parezcan operación actual antes de que exista un inicio real.

### Gap crítico 7 — No existe colección de operaciones simultáneas

El contrato móvil actual devuelve una sola `currentOperation`. La representación real debe permitir cero, una o varias operaciones por línea/variante/salida programada, incluyendo reemplazos o buses de refuerzo.

### Gap crítico 8 — Viaje sin vínculo con salida programada

`Trip` no guarda cuál horario o salida publicó el administrador. No se puede medir con precisión puntualidad, salida omitida, retraso, sustitución, cumplimiento por horario ni feedback ligado a una salida específica.

### Gap crítico 9 — Asignación permanente del conductor

`Driver.assignedRouteId` y `assignedVehicleId` describen una relación estable, pero el negocio necesita asignación por jornada y salida. Deben pasar a ser datos administrativos heredados o de referencia, no la fuente de verdad de la operación diaria.

### Gap crítico 10 — Integridad de flota incompleta

Se permite que un vehículo pase a mantenimiento después de tener una asignación activa. Falta la política transaccional que impida iniciar una operación con un bus no disponible y que marque la necesidad de reemplazo.

### Gap crítico 11 — Rutas y paradas no están versionadas

La ordenación actual reemplaza la relación de paradas dentro de una transacción. Eso es aceptable para el MVP, pero no conserva qué recorrido vio el estudiante en una fecha anterior ni protege operaciones ya publicadas ante una edición posterior.

### Gap crítico 12 — El Student Home no responde la pregunta diaria

`apps/mobile/src/app/(tabs)/index.tsx:27-50` obtiene solo `routes[0]` y consulta sus horarios. Además, en `:101-119` el estado “Operativo” es estático. El inicio no presenta Norte/Sur/La Joya, siguientes salidas por línea, excepciones, múltiples buses ni diferencia entre programado y en recorrido.

### Gap crítico 13 — Student Rutas es un catálogo plano

`apps/mobile/src/app/(tabs)/rutas.tsx:37-44` filtra una lista plana por nombre/dirección y `:134-180` presenta cada registro como ruta activa. No existe agrupación por línea, selector Ida/Retorno, ramal, agenda por fecha ni lista de salidas.

### Gap crítico 14 — El detalle puede distorsionar horarios

El detalle móvil consume una sola ruta, una sola operación y una lista de horarios. `buildScheduleSummary` agrupa días y deduce frecuencia desde las primeras horas; esa heurística no es suficiente para horarios variables, excepciones o varios buses.

### Gap crítico 15 — El alcance administrativo actual no cubre la operación

Los CRUD existentes permiten gestionar catálogos, pero falta un centro de operación diaria que responda: qué salidas estaban planificadas, cuáles fueron asignadas, cuáles iniciaron, cuáles están retrasadas/suspendidas, qué buses faltan y qué incidencias se comunicaron.

### Gap crítico 16 — Documentación de contrato desactualizada

El resumen de 46 endpoints omite los módulos de asignaciones y driver operations que están presentes en el código. Antes de Fase 5 debe existir un inventario único generado/verificado desde controladores y DTOs, sin cambiar todavía la API pública.

## 6. Propuesta de dominio canónico

La propuesta siguiente es conceptual y no constituye una migración ejecutada.

### 6.1 Entidades y relaciones

```text
ServiceLine
  └── RouteVariant
        ├── Direction (IDA | RETORNO)
        ├── Branch / itinerary identity
        ├── ordered StopMembership[]
        └── SchedulePattern[]
              └── ScheduledDeparture (date/time instance)
                    └── ServiceRun[]
                          ├── Vehicle
                          ├── Driver (later authenticated)
                          └── Trip/operation events
```

#### `ServiceLine`

Representa la promesa visible al estudiante: `NORTE`, `SUR`, `LA_JOYA`. Debe tener nombre visible, código estable, descripción, estado de publicación y orden de presentación. La asignación de las siete rutas actuales a estas líneas requiere confirmación de operación; no debe inferirse solo por `legacyNames`.

#### `RouteVariant`

Representa un recorrido concreto de una línea, un sentido y un ramal. Debe conservar origen, destino, sentido, nombre operativo, estado, vigencia y versión del itinerario. Una ida y su retorno pueden relacionarse como sentidos de una misma línea, pero no deben forzarse a tener las mismas paradas invertidas: el retorno puede tener diferencias reales.

#### `Stop` y `StopMembership`

`Stop` sigue siendo el lugar físico canónico. `StopMembership` relaciona una parada con una variante, con orden, minutos estimados, notas y vigencia. Así se preservan paradas compartidas y se permite que una variante diverja sin duplicar innecesariamente el lugar.

#### `ServiceCalendar` y excepciones

El calendario debe expresar días regulares, período de vigencia, zona horaria de Guayaquil y excepciones explícitas: feriado, suspensión, día especial, horario extraordinario o servicio agregado. La excepción debe ganar sobre la regla semanal.

#### `SchedulePattern` / `ScheduledDeparture`

La regla puede ser una lista de horas, una frecuencia dentro de una ventana o una combinación de ambas. Cada salida publicada debe poder identificarse por fecha, hora, variante y patrón. Para el estudiante, la salida es la unidad que se compara con “ahora”.

#### `ServiceRun`

Es la instancia operacional de una salida programada. Una `ScheduledDeparture` puede tener cero, una o varias `ServiceRun`:

- cero: servicio publicado pero todavía sin bus iniciado o sin asignación;
- una: operación normal;
- varias: buses simultáneos, refuerzo, sustitución o capacidad adicional.

La relación debe permitir registrar bus y conductor asignados sin afirmar que la salida inició. El estado `IN_PROGRESS` solo se obtiene por una acción operativa válida. Driver Auth y GPS no forman parte de esta fase; el dominio debe dejarlos como extensiones futuras.

#### Incidencia y aviso

Un `Notice` es comunicación publicada. Una `OperationalIncident` es un hecho de operación: cancelación, retraso, sustitución, desvío, parada cerrada o falta de bus. Una incidencia puede generar un aviso, pero no deben ser el mismo objeto.

### 6.2 Estados recomendados

No se deben reutilizar a ciegas los estados actuales para todos los conceptos.

| Capa | Estados conceptuales |
|---|---|
| Línea/variante publicada | `ACTIVE`, `SUSPENDED`, `INACTIVE` |
| Salida programada | `PUBLISHED`, `CANCELLED`, `EXCEPTIONAL` |
| Asignación | `UNASSIGNED`, `ASSIGNED`, `REPLACED`, `RELEASED` |
| Operación real | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `SUSPENDED`, `CANCELLED`, `NO_SHOW` |
| Vehículo | `AVAILABLE`, `MAINTENANCE`, `INACTIVE` |

La interfaz puede traducir estos estados a lenguaje estudiantil, pero la API no debe mezclar “publicado”, “asignado” y “en recorrido”.

### 6.3 Reglas de negocio que deben aprobarse

1. Un servicio programado existe aunque todavía no tenga bus asignado.
2. Un bus asignado no equivale a bus en recorrido.
3. Una operación iniciada siempre referencia una salida programada o queda marcada explícitamente como extraordinaria.
4. Una salida puede tener varios buses; un bus y un conductor no pueden tener dos operaciones solapadas.
5. El mismo vehículo puede hacer varias salidas secuenciales si los intervalos y tiempos de preparación lo permiten.
6. La disponibilidad de un servicio se calcula por fecha, calendario, excepciones y estado de la salida, no solo por `Route.status`.
7. Un cambio de itinerario no debe reescribir históricamente la ruta de una operación ya iniciada.
8. Toda cancelación, suspensión, sustitución o cambio manual debe dejar motivo, actor y fecha en auditoría.

## 7. Arquitectura de información Student futura

La evolución debe conservar la identidad visual actual de UPS GO. El cambio propuesto es de jerarquía y semántica, no de paleta, logo ni estilo visual.

### 7.1 Navegación principal

La navegación existente (`Inicio`, `Rutas`, `Avisos`, `Favoritos`, `Perfil`) puede conservarse como base de compatibilidad. Favoritos no debe ser la puerta principal de descubrimiento: el estudiante primero necesita entender el servicio del día.

### 7.2 Inicio — “¿Qué funciona hoy?”

Contenido prioritario:

1. Fecha de servicio y última actualización.
2. Aviso crítico vigente, si existe.
3. Tres entradas principales: **Ruta Norte**, **Ruta Sur**, **Ruta La Joya**.
4. Para cada línea: siguiente salida disponible, sentido, variante si aplica y estado.
5. Si existe operación iniciada: bus(es) en recorrido, código/placa según política de privacidad y hora de inicio.
6. Si no existe salida: “No hay servicio publicado para hoy” o “No hay otra salida disponible”, sin mostrar “Operativo” genérico.

La tarjeta debe distinguir visual y textualmente:

- `Programado`: está publicado, aún no iniciado.
- `En recorrido`: existe al menos una operación iniciada.
- `Suspendido/Cancelado`: explicar alcance y motivo si está disponible.
- `Sin información operativa`: no afirmar que el servicio está detenido; indicar cuándo se actualizó el dato.

### 7.3 Rutas — descubrir por línea

La lista debe comenzar por las tres líneas canónicas, no por los siete registros técnicos. Cada línea abre su detalle y permite elegir:

- `IDA` o `RETORNO`;
- ramal/variante, si hay más de uno;
- fecha o “hoy”;
- siguiente salida y resto de salidas del día;
- paradas y tiempos estimados;
- buses realmente en recorrido, separados de buses asignados;
- avisos que afecten esa línea o variante.

### 7.4 Detalle de una línea

Orden recomendado:

1. Nombre de línea y descripción breve.
2. Selector de sentido.
3. Selector de variante/ramal solo cuando sea necesario.
4. Próximas salidas para la fecha elegida.
5. Estado de cada salida y cantidad de buses realmente activos.
6. Paradas ordenadas y tiempos estimados.
7. Mapa como apoyo, no como única fuente de comprensión.
8. Avisos/incidencias aplicables.
9. Favorito de línea, sentido o parada.

No debe mostrarse conductor o vehículo de una asignación `SCHEDULED` con lenguaje que sugiera que el bus ya está circulando.

### 7.5 Avisos, favoritos y perfil

- Avisos conserva el canal actual, pero debe poder indicar alcance: toda la red, línea, variante, salida o parada.
- Favoritos puede mantener rutas/paradas durante la transición; en la evolución debe guardar el identificador canónico de línea/variante/parada, con compatibilidad para IDs antiguos.
- Perfil mantiene autenticación y preferencias; Driver Auth queda fuera del flujo Student y fuera de esta fase.

### 7.6 Estados UX mínimos

Cada vista que consuma transporte debe diseñarse para: cargando, sin servicio hoy, servicio publicado, operación en curso, cancelación, suspensión, error temporal, datos desactualizados y modo offline con fecha de última actualización.

Los objetivos de accesibilidad ya presentes en componentes móviles —`Pressable`, `hitSlop`, etiquetas y feedback de pulsación— deben conservarse durante la futura reorganización. La jerarquía no debe depender solo del color ni de un mapa.

## 8. Alcance real del futuro Admin Web

Admin Web no debe ser solamente una pantalla que consuma los cinco CRUD existentes. Debe ser la herramienta para publicar el servicio, preparar el día y explicar desviaciones.

### 8.1 MVP administrativo propuesto

#### A. Tablero de operación de hoy

- Fecha y calendario aplicado.
- Líneas Norte, Sur y La Joya.
- Sentido y variante.
- Salidas programadas por hora.
- Estado: publicada, asignada, en recorrido, finalizada, cancelada o sin operación.
- Buses/conductores asignados y buses realmente iniciados separados.
- Alertas de vehículo no disponible, conflicto o salida sin cobertura.

#### B. Catálogo de servicio

- Líneas.
- Variantes/ramales.
- Sentidos.
- Paradas compartidas y específicas.
- Orden y tiempos estimados por variante.
- Vigencia del itinerario.

#### C. Calendario y horarios

- Calendarios regulares.
- Períodos de vigencia.
- Excepciones por fecha.
- Horarios variables y frecuencias.
- Publicación, previsualización y cancelación de salidas.

#### D. Planificación operativa

- Generar o revisar salidas del día.
- Asignar cero, uno o varios buses por salida.
- Asignar conductor y reemplazarlo.
- Detectar conflictos de bus/conductor por solapamiento.
- Suspender/cancelar con motivo.
- Crear salida extraordinaria con trazabilidad.

#### E. Flota y personal

- CRUD de vehículos con disponibilidad real para una fecha.
- CRUD de conductores como catálogo.
- Historial de asignaciones.
- Driver Auth y acciones desde la app Driver se reservan para una fase posterior.

#### F. Comunicación e incidencias

- Avisos con vigencia y alcance.
- Incidencias operativas separadas de avisos.
- Relación entre incidencia, salida, variante, línea y parada.
- Historial de quién publicó o resolvió cada cambio.

#### G. Seguridad y trazabilidad

- Usuarios administrativos y roles.
- Permisos por capacidad, si la operación lo requiere.
- Consulta de `AuditLog`.
- Registro de cambios de horario, itinerario, asignación y estado.

### 8.2 Fuera de alcance de Admin Web en este momento

- Login operativo de conductores.
- GPS, geocercas, ubicación en tiempo real o ETA calculada por posición.
- Facturación, pagos o reservas de asientos.
- Rediseño visual de UPS GO.
- Edición directa de datos productivos sin flujo de revisión/publicación.

## 9. Estrategia de compatibilidad y migración segura

### Fase 0 — Decisión de negocio antes de Prisma

1. Operación confirma el significado oficial de Norte, Sur y La Joya.
2. Se mapea cada ruta actual a línea, sentido y variante con aprobación humana.
3. Se confirma si el intercampus pertenece a una de las tres líneas o es un servicio independiente.
4. Se valida catálogo oficial de paradas, coordenadas y nombres.
5. Se documentan calendarios, feriados, horarios variables y regla de múltiples buses.

Ningún mapping debe basarse exclusivamente en los nombres legados del seed.

### Fase 1 — Modelo paralelo y adaptadores

Después de aprobar el catálogo:

- agregar entidades canónicas sin eliminar inmediatamente `Route`, `Schedule`, `RouteAssignment` ni `Trip`;
- conservar los IDs antiguos para feedbacks, favoritos y enlaces existentes;
- crear relaciones explícitas de compatibilidad entre registro legado y entidad canónica;
- mantener los endpoints actuales con su payload actual;
- exponer lecturas nuevas versionadas o nuevos endpoints separados, sin cambiar silenciosamente el significado de `currentOperation`.

La forma exacta de las rutas nuevas debe decidirse en Fase 5 junto con OpenAPI y permisos. Este blueprint no cambia contratos.

### Fase 2 — Backfill controlado

1. Crear catálogo canónico vacío o en estado de borrador.
2. Cargar líneas y variantes aprobadas.
3. Asociar rutas/paradas existentes mediante tabla de mapping revisada.
4. Transformar horarios semanales a patrones y salidas solo para fechas verificables.
5. Convertir asignaciones futuras a asignaciones de salida únicamente cuando exista hora/variante confirmada.
6. Marcar datos no confirmados como `needs_review`; no inventar línea, ramal o turno.

### Fase 3 — Doble lectura y validación

- Comparar lectura legacy y lectura canónica para las mismas rutas.
- Verificar conteos por línea, sentido, variante, fecha y salida.
- Verificar que ninguna operación activa aparezca si solo existe asignación.
- Verificar múltiples buses y conflictos de recursos.
- Verificar que cambios futuros no reescriban itinerarios históricos.
- Registrar diferencias y resolverlas antes del cambio de lectura.

### Fase 4 — Cutover gradual

- Activar la nueva lectura por feature flag para usuarios internos.
- Después, habilitarla a un grupo pequeño de estudiantes.
- Mantener fallback al contrato legacy durante el período acordado.
- Monitorear errores, datos faltantes, latencia y discrepancias.
- Promover por línea o por entorno, no con un cambio irreversible global.

### Fase 5 — Retiro posterior

Solo después de demostrar equivalencia, uso estable y aprobación operativa:

- congelar escrituras legacy;
- archivar adaptadores;
- retirar campos o tablas obsoletos mediante migraciones separadas;
- conservar auditoría e historial.

No se recomienda `db push`, borrado de columnas ni eliminación de rutas legacy como parte de Fase 4.

## 10. Decisiones que deben cerrar el negocio

Estas decisiones son bloqueantes para el diseño final del backend:

1. ¿Cuál es el mapping oficial de las siete rutas actuales a Norte, Sur y La Joya?
2. ¿El servicio intercampus es una cuarta línea o una variante de La Joya/u otra línea?
3. ¿Ida y Retorno comparten línea pero pueden tener variantes y horarios independientes?
4. ¿Qué define un ramal: secuencia de paradas, destino, ventana horaria o recorrido operativo?
5. ¿Dos buses del mismo horario son dos operaciones simultáneas o una capacidad agregada?
6. ¿Los horarios variables se modelan como horas explícitas, frecuencias o ambos?
7. ¿Qué calendario institucional rige fines de semana, feriados, vacaciones y eventos?
8. ¿Quién puede publicar, cancelar, suspender y reactivar una salida?
9. ¿Qué información del conductor y placa se muestra al estudiante y desde qué estado?
10. ¿Cuál es el protocolo cuando un bus asignado entra en mantenimiento antes de iniciar?
11. ¿Qué alcance debe tener una incidencia y cuándo genera un aviso visible?
12. ¿Qué roles administrativos existirán además de `ADMIN` y `SUPER_ADMIN`?
13. ¿Cuál es la fuente oficial de coordenadas y nombres de paradas?

Driver Auth y GPS quedan expresamente como decisiones posteriores. No deben usarse para justificar retrasar la definición de programación y operación básica.

## 11. Plan recomendado de siguientes fases

### Fase 5 — Backend Domain Evolution

Debe empezar con especificación de entidades, invariantes, compatibilidad, OpenAPI y plan de datos. La primera entrega debe resolver catálogo, calendario, salidas y operaciones; no GPS.

### Fase 6 — Student Mobile Evolution

Debe consumir la lectura canónica de manera incremental, conservar la identidad UPS GO y reemplazar gradualmente el catálogo plano por línea/sentido/variante/salida.

### Fase 7 — Admin Web

Debe comenzar después de que las reglas de Fase 5 existan y puedan ser probadas sin depender de pantallas incompletas. Su primera vista útil es el tablero de operación diaria, no un CRUD aislado.

### Fases posteriores — Driver y GPS

Driver Auth, inicio operativo autorizado, progreso de paradas y GPS deben diseñarse sobre `ServiceRun`, no sobre la actual asignación genérica de ruta.

## 12. Delivery Gate de esta Fase 4

| Control | Resultado |
|---|---|
| Auditoría sin cambios en `apps/api` | Cumplido |
| Auditoría sin cambios en `apps/mobile` | Cumplido |
| No se creó `apps/web` | Cumplido |
| No se tocó Prisma ni se generaron migraciones | Cumplido |
| No se cambiaron contratos API | Cumplido |
| Se preservaron cambios previos del worktree | Cumplido; el worktree no se declaró limpio |
| Se verificó modelo actual | Cumplido mediante schema, servicios, controladores y consultas SELECT |
| Se verificaron datos locales actuales | Cumplido mediante consultas SELECT de solo lectura |
| Se verificó Student IA existente | Cumplido mediante layout, Home, Rutas, detalle, tipos y servicios |
| Se definió alcance Admin Web | Cumplido en este documento |
| Se definió compatibilidad/migración segura | Cumplido como propuesta, sin ejecutar migración |
| Tests/build de aplicación | No ejecutados: esta fase fue de reconocimiento y no modificó código |

## 13. GO / NO-GO para iniciar la evolución del backend

### NO-GO inmediato

No se debe iniciar todavía una implementación de migraciones, nuevas tablas, reemplazo de endpoints o construcción de `apps/web` basada únicamente en el modelo actual. Hacerlo consolidaría estos errores:

- rutas técnicas en lugar de líneas de negocio;
- dirección como texto libre;
- ausencia de ramales;
- horarios sin calendario ni excepciones;
- asignación confundida con salida;
- una sola operación por ruta;
- imposibilidad de múltiples buses por salida;
- operación no vinculada a un horario;
- Student Home afirmando “Operativo” sin evidencia real.

### GO condicionado

Se autoriza iniciar la **Fase 5 de diseño y evolución del backend** cuando se cumplan estas condiciones mínimas:

1. Operación apruebe el catálogo Norte/Sur/La Joya y el mapping de las siete rutas actuales.
2. Se decida el tratamiento del servicio intercampus.
3. Se aprueben las definiciones de Ida/Retorno, ramal, salida programada y operación real.
4. Se aprueben múltiples buses por salida y reglas de conflicto temporal.
5. Se aprueben calendario, excepciones y zona horaria.
6. Se aprueben estados separados para publicación, asignación y operación.
7. Se apruebe la estrategia de compatibilidad de endpoints legacy y nuevas lecturas.
8. Se convierta el inventario real de controladores/DTOs en documentación de contrato verificable.
9. Se defina el protocolo de datos no confirmados, sin inferencias automáticas.

Con esas aprobaciones, el resultado de esta fase es **GO condicional para Fase 5**. Hasta entonces, el estado correcto es **NO-GO para cambiar el backend actual** y **GO para cerrar la validación de negocio**.
