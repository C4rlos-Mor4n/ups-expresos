# UPS GO — Business Rules Decision Pack

**Fase:** 4.1 — Business Rules & Catalog Closure
**Fecha:** 2026-08-28
**Modo:** planificación y validación funcional, estrictamente de solo lectura
**Repositorio:** `/home/cmoran/ups-expresos`

Este documento convierte la auditoría de Fase 4 en recomendaciones concretas para que operación pueda aprobarlas o corregirlas. No es una migración ni una especificación final de Prisma.

## 1. Estado

### Resultado de esta fase

- Se inspeccionaron los siete registros actuales de `Route`, sus paradas, horarios y datos operativos locales.
- Se inspeccionó el catálogo de 14 paradas y sus 33 relaciones con rutas.
- Se verificó que el código actual representa asignaciones y viajes, pero no una salida programada con uno o varios buses.
- Se revisó el contrato documentado y se contrastó con los controladores reales.
- No se modificaron datos, código, Prisma, migraciones, contratos API ni pantallas.
- El único archivo nuevo de esta fase es este decision pack.

### Lectura de los estados usados aquí

| Estado | Significado |
|---|---|
| `CONFIRMED` | Está confirmado por la reunión/contexto o es un hecho verificable del sistema actual; no significa que el catálogo operativo final ya esté aprobado |
| `RECOMMENDED` | Recomendación concreta para aprobación |
| `BUSINESS_APPROVAL_REQUIRED` | No se puede cerrar sin respuesta de operación/UPS |
| `BLOCKED_BY_DATA` | Falta información oficial; no se debe inferir |
| `DEFERRED` | Se reserva para una fase posterior y no bloquea el diseño base |

### Decisión ejecutiva

> **GO FASE 5 DESIGN:** puede comenzar el diseño técnico del dominio, contratos de lectura y plan de compatibilidad usando las recomendaciones de este documento.
>
> **NO-GO FASE 5 IMPLEMENTATION:** no se deben crear migraciones, hacer backfill ni reemplazar lecturas hasta que UPS apruebe el mapping oficial, el tratamiento de Intercampus, los ramales y las reglas de programación esenciales.

## 2. Resumen ejecutivo

La perspectiva Student está confirmada como tres rutas principales: **Ruta Norte, Ruta Sur y Ruta La Joya**. El repositorio, sin embargo, contiene siete recorridos técnicos: cuatro relacionados con Campus Centenario y Terminales Río Daule/25 de Julio, dos de Vía a la Costa y uno intercampus.

El seed utiliza notas como “Ruta Norte”, “Ruta Sur” y “Ruta La Joya”, pero también contiene `legacyNames` incompatibles entre sí y declara que las asignaciones son demostrativas. Por ello, las notas sirven como evidencia de hipótesis, no como catálogo oficial.

La recomendación de dominio se mantiene:

```text
ServiceLine
  → RouteVariant
      → StopMembership[]
      → SchedulePattern[]
          → ScheduledDeparture
              → 0..N ServiceRun
                    → Vehicle
                    → Driver
```

La regla más importante queda recomendada así:

```text
Una salida programada puede tener cero, uno o varios buses.
Un bus asignado no significa que ya esté circulando.
Solo una operación iniciada puede mostrarse como “En recorrido”.
```

## 3. Decisiones ya confirmadas

Estas decisiones están suficientemente sustentadas para formar la base del diseño, aunque sus nombres o detalles operativos puedan recibir ajustes:

1. La experiencia Student debe priorizar tres líneas visibles: Norte, Sur y La Joya.
2. El servicio necesita distinguir Ida y Retorno.
3. Ida y Retorno pueden tener paradas, recorridos y horarios diferentes; Retorno no debe asumirse como la Ida invertida.
4. Deben existir paradas ordenadas y reutilizables entre distintos recorridos.
5. El sistema debe soportar varios buses en una misma franja o salida.
6. La operación diaria necesita rotación de vehículos y conductores.
7. El inicio de operación es manual en la etapa actual.
8. Horarios, períodos académicos, vacaciones, feriados y eventos pueden modificar la oferta publicada.
9. Driver Auth y GPS no forman parte de esta fase ni deben bloquear el diseño del dominio base.
10. El Admin Web futuro necesita gestionar servicio, programación, operación, flota, comunicaciones y trazabilidad.

## 4. Decisiones recomendadas

| Tema | Recomendación lista para aprobar |
|---|---|
| Línea | Normalizar `NORTE`, `SUR` y `LA_JOYA` como catálogo visible y estable |
| Recorrido | Usar una variante por combinación material de línea, sentido y recorrido/ramal |
| Ramal | Crear uno solo cuando cambien materialmente paradas, origen/destino o recorrido; horario, bus y conductor no crean ramal |
| Parada compartida | Mantener un lugar físico único y asociarlo a varias variantes mediante membresías ordenadas |
| Horario MVP | Empezar con horas explícitas; dejar frecuencia como capacidad futura del mismo dominio |
| Calendario | Usar vigencia, días de servicio, zona `America/Guayaquil` y excepciones con prioridad sobre la regla semanal |
| Salida | Crear una salida identificable por fecha, hora, variante y patrón publicado |
| Varios buses | Modelar `1 ScheduledDeparture → N ServiceRun`, no varios horarios duplicados |
| Asignación | Separar “unidad/conductor asignados” de “unidad en recorrido” |
| Operación | Exigir acción de inicio válida para pasar a `IN_PROGRESS` |
| Publicación | Publicar reglas/horarios antes de generar o exponer salidas; no mezclar publicación con estado operativo |
| Cancelación | La salida cancelada no se realiza; la suspensión representa interrupción temporal de un servicio u operación existente |
| Roles | Mantener `ADMIN` y `SUPER_ADMIN` en el MVP; ampliar permisos después si operación demuestra necesidad |
| Student UX | Mostrar primero siguiente salida y estado real; Favoritos permanece como función, pero no debe dominar el descubrimiento |

## 5. Decisiones pendientes

Las siguientes no pueden marcarse como confirmadas con la evidencia disponible:

- mapping oficial de cada registro legacy a Norte, Sur o La Joya;
- si Intercampus es una cuarta línea, una variante, un servicio especial o un servicio independiente;
- nombres y coordenadas oficiales de paradas;
- existencia y definición de cada ramal;
- reglas de horarios variables, frecuencia y duración operacional;
- calendario oficial de vacaciones, feriados, exámenes y eventos;
- visibilidad de placa y conductor antes y durante una salida;
- política ante vehículo en mantenimiento y reemplazo durante una operación;
- duración, buffers y conflictos de recursos;
- alcance mínimo de incidencias y avisos;
- necesidad futura de roles administrativos adicionales.

## 6. Mapping legacy → catálogo propuesto

### 6.1 Criterio

La confianza mide la fuerza de la evidencia local, no aprobación de UPS. `HIGH` o `MEDIUM` nunca se convierte en `CONFIRMED` sin validación humana. Las claves de variante son nombres de trabajo, no identificadores oficiales.

### 6.2 Tabla de los siete registros actuales

| Legacy Route | Nombre actual | Direction actual | Stops | Schedules | Posible ServiceLine | Posible Variant | Confianza |
|---|---|---:|---:|---:|---|---|---|
| `rio-daule-centenario-ida` | Terminal Río Daule → Campus Centenario | IDA | 6 | 15 | `NORTE` | Río Daule → Centenario / Ida | LOW |
| `centenario-rio-daule-retorno` | Campus Centenario → Terminal Río Daule | RETORNO | 6 | 15 | `NORTE` | Centenario → Río Daule / Retorno | LOW |
| `terminal-25-centenario-ida` | Terminal 25 de Julio → Campus Centenario | IDA | 4 | 15 | `SUR` | 25 de Julio → Centenario / Ida | LOW |
| `centenario-terminal-25-retorno` | Campus Centenario → Terminal 25 de Julio | RETORNO | 4 | 15 | `SUR` | Centenario → 25 de Julio / Retorno | LOW |
| `terminal-costa-maria-auxiliadora-ida` | Terminal Costa → Campus María Auxiliadora | IDA | 4 | 10 | `LA_JOYA` | Costa → María Auxiliadora / Ida | MEDIUM |
| `maria-auxiliadora-terminal-costa-retorno` | Campus María Auxiliadora → Terminal Costa | RETORNO | 4 | 10 | `LA_JOYA` | María Auxiliadora → Costa / Retorno | MEDIUM |
| `intercampus-centenario-maria-auxiliadora` | Intercampus Centenario → María Auxiliadora | IDA | 5 | 10 | `UNKNOWN` | Intercampus Centenario → María Auxiliadora | UNKNOWN |

### 6.3 Por qué Norte y Sur quedan en LOW

- Río Daule ↔ Centenario tiene nota demo “Ruta Norte”, pero sus `legacyNames` dicen “Ruta Campus Sur”.
- 25 de Julio ↔ Centenario tiene nota demo “Ruta Sur”, pero sus `legacyNames` dicen “Ruta Campus Norte”.
- Las notas están expresamente calificadas como asignaciones demo y el seed pide reemplazarlas cuando operación confirme los turnos.

Por tanto, se pueden usar como candidatos para preparar la conversación, pero no para backfill automático.

### 6.4 Mapping recomendado para aprobación

```text
NORTE
  - candidato: Río Daule ↔ Campus Centenario

SUR
  - candidato: Terminal 25 de Julio ↔ Campus Centenario

LA_JOYA
  - candidato: Terminal Costa ↔ Campus María Auxiliadora

UNKNOWN
  - Intercampus Centenario ↔ María Auxiliadora
```

Este bloque no es un mapping aprobado. Es la propuesta mínima que operación debe confirmar o corregir.

## 7. Catálogo de líneas

### 7.1 Norte

| Campo | Propuesta |
|---|---|
| Código estable sugerido | `NORTE` |
| Nombre visible | Ruta Norte |
| Sentidos conocidos | IDA y RETORNO, ambos por candidato legacy |
| Variantes conocidas | Río Daule ↔ Campus Centenario, pendiente de confirmación |
| Paradas conocidas | Terminal Río Daule, Mall del Sol, Universidad de Guayaquil, Parque Centenario, Estadio George Capwell, UPS Campus Centenario |
| Horarios conocidos | Ida 06:10, 11:30, 16:00; Retorno 07:10, 13:15, 20:00, lunes a viernes en demo |
| Confirmado | La línea existe en el vocabulario Student; los recorridos exactos no |
| Requiere validación | Mapping oficial, nombres de paradas, horarios y calendario |

### 7.2 Sur

| Campo | Propuesta |
|---|---|
| Código estable sugerido | `SUR` |
| Nombre visible | Ruta Sur |
| Sentidos conocidos | IDA y RETORNO, ambos por candidato legacy |
| Variantes conocidas | 25 de Julio ↔ Campus Centenario, pendiente de confirmación |
| Paradas conocidas | Terminal 25 de Julio, Hospital Teodoro Maldonado Carbo, Mall del Sur, UPS Campus Centenario |
| Horarios conocidos | Ida 06:30, 11:50, 16:15; Retorno 07:05, 12:30, 18:10, lunes a viernes en demo |
| Confirmado | La línea existe en el vocabulario Student; los recorridos exactos no |
| Requiere validación | Mapping oficial, nombres de paradas, horarios y calendario |

### 7.3 La Joya

| Campo | Propuesta |
|---|---|
| Código estable sugerido | `LA_JOYA` |
| Nombre visible | Ruta La Joya |
| Sentidos conocidos | IDA y RETORNO por candidato geográfico/legacy |
| Variantes conocidas | Terminal Costa ↔ Campus María Auxiliadora, pendiente de confirmación |
| Paradas conocidas | Terminal Terrestre Municipal Costa, Puerto Azul, Costalmar Shopping, UPS Campus María Auxiliadora |
| Horarios conocidos | Ida 06:20, 14:10; Retorno 07:20, 19:10, lunes a viernes en demo |
| Confirmado | La línea existe en el vocabulario Student; la equivalencia con La Joya debe aprobarse |
| Requiere validación | Mapping oficial, alcance de Vía a la Costa, nombres de paradas y calendario |

### 7.4 Intercampus

Estado: **BUSINESS DECISION REQUIRED**.

Hay un recorrido actual de cinco paradas, 10 horarios demo y una descripción explícita de conexión entre los dos campus. No existe evidencia suficiente para clasificarlo como Norte, Sur o La Joya. La recomendación es mantenerlo como `UNKNOWN`/servicio especial durante el diseño y no esconderlo dentro de una línea hasta que operación decida.

## 8. Ida / Retorno

### Definición recomendada

Una línea puede tener dos o más variantes de sentido:

```text
ServiceLine = Ruta Norte

Variant A = IDA
Variant B = RETORNO
```

Cada sentido puede tener:

- secuencia de paradas diferente;
- origen y destino diferentes;
- horarios diferentes;
- duración estimada diferente;
- ramales diferentes.

No se debe generar el Retorno invirtiendo automáticamente la lista de Ida.

**Estado:** `RECOMMENDED — RECOMMENDED FOR APPROVAL`.

## 9. Ramales

### Branch Definition

Un ramal es una variante operativa identificable de una línea y sentido cuando cambia materialmente al menos uno de estos elementos:

- secuencia de paradas;
- conjunto de paradas atendidas;
- origen o destino;
- recorrido o corredor utilizado.

No crea un ramal el cambio de:

- horario;
- vehículo;
- conductor;
- cantidad de buses.

### Ejemplos

- Si Ruta La Joya Ida llega a Campus María Auxiliadora por dos secuencias distintas de paradas, son dos variantes/ramales.
- Si dos buses realizan exactamente el mismo recorrido a las 06:40, son dos operaciones de la misma salida, no dos ramales.
- Si una salida de Ruta Norte omite una parada solo por una incidencia temporal, se registra incidencia; no se crea un ramal permanente.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

No hay datos actuales suficientes para declarar qué ramales oficiales existen.

## 10. Horarios

### Opciones evaluadas

| Opción | Evaluación |
|---|---|
| A — horas explícitas | Coincide con los 90 registros demo actuales y es la opción más simple para MVP |
| B — solo frecuencia | No representa bien los horarios publicados que hoy son horas concretas |
| C — horas y frecuencia | Es la capacidad completa recomendada para el dominio futuro |

### Recomendación

Adoptar conceptualmente la opción C, pero implementar primero `EXPLICIT_TIMES` para el MVP. La frecuencia debe quedar como una modalidad futura del patrón de servicio, no como una razón para complicar el primer backfill.

Regla:

- una hora explícita genera una salida identificable;
- una frecuencia genera salidas según ventana, calendario y regla aprobada;
- una salida adicional no se inventa porque haya más capacidad disponible;
- un cambio de hora no crea una nueva variante.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` para frecuencia; `RECOMMENDED` para iniciar el MVP con horas explícitas.

## 11. Calendario

### Modelo funcional recomendado

```text
ServiceCalendar
  name
  validFrom
  validUntil
  timezone = America/Guayaquil
  regular service days

ServiceException
  date
  type = NO_SERVICE | SPECIAL_SCHEDULE
  reason
```

Las excepciones tienen prioridad sobre los días regulares. Ejemplos:

- 2026-11-02 — `NO_SERVICE` — feriado.
- 2026-11-10 — `SPECIAL_SCHEDULE` — jornada especial.

### Períodos académicos

No se recomienda crear `AcademicPeriod` como requisito del MVP. Un calendario con vigencia y excepciones resuelve vacaciones, exámenes y eventos simples. Se puede agregar un concepto académico más adelante si se necesitan reportes, permisos o reglas propias que no caben en un calendario operativo.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` para calendario oficial; `RECOMMENDED` para no crear período académico separado en MVP.

## 12. Múltiples buses

### Regla recomendada

```text
ScheduledDeparture
  Ruta Norte / IDA / 06:40
      ├── ServiceRun A → BUS-001
      ├── ServiceRun B → BUS-002
      └── ServiceRun C → BUS-003
```

Una salida publicada es una promesa de servicio. Cada bus que la ejecuta tiene estado, unidad y conductor propios.

No se deben representar tres buses como:

- tres registros de horario idénticos;
- una capacidad agregada sin unidades;
- un solo vehículo con una cantidad de pasajeros;
- tres ramales cuando el itinerario es el mismo.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

## 13. Operación

### 13.1 Servicio programado

`ScheduledDeparture` significa: “la universidad publicó que existe una salida en esta fecha y hora”. No significa que un bus esté circulando.

### 13.2 Operación real

`ServiceRun` significa: “una unidad concreta está ejecutando esa salida”. Estados recomendados:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
SUSPENDED
CANCELLED
NO_SHOW
```

La transición a `IN_PROGRESS` ocurre únicamente por una acción operativa válida. La existencia de una asignación no la provoca.

### 13.3 Assignment vs ServiceRun

Una asignación responde: “¿qué bus y qué conductor fueron reservados para cubrir esta salida?”.

Una operación responde: “¿qué bus comenzó realmente esta salida?”.

Estados recomendados para asignación:

```text
UNASSIGNED
ASSIGNED
REPLACED
RELEASED
```

El Student no debe interpretar `ASSIGNED` como “En recorrido”.

### 13.4 Cancelación y suspensión

#### `CANCELLED`

La salida no se realizará. Puede ocurrir antes del inicio y debe guardar actor, hora y motivo.

#### `SUSPENDED`

Una operación ya existente o un servicio temporalmente activo queda interrumpido. Debe guardar actor, hora, motivo y, cuando aplique, una incidencia relacionada.

Una salida aún no iniciada no debe marcarse `SUSPENDED` para ocultar que nunca saldrá; debe cancelarse o quedar como `NO_SHOW` según la regla aprobada.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

## 14. Vehículos / conductores

### Vehículo en mantenimiento

Recomendación:

1. Si el vehículo pasa a `MAINTENANCE` antes del inicio, no puede iniciar la operación.
2. La asignación queda `REPLACED` o `RELEASED`, según si se consiguió sustituto.
3. El servicio programado continúa existiendo.
4. Admin asigna un vehículo sustituto.
5. Actor, hora y motivo quedan auditados.
6. Si no hay sustituto, Admin decide `CANCELLED` o `NO_SHOW`; no se cancela automáticamente por el solo cambio de estado.

Si el vehículo falla después del inicio, se necesita una política operativa específica: suspender la operación, registrar incidencia y decidir si existe reemplazo en ruta.

### Conflictos de recursos

Un vehículo no puede tener dos operaciones con intervalos solapados. Un conductor tampoco.

Para comprobarlo se necesita una ventana operacional basada en:

- hora de salida;
- duración estimada;
- buffer de preparación/retorno, si operación lo define.

El catálogo actual tiene horas de llegada aproximadas en los horarios, pero no una política oficial de duración y buffer. No se debe inventar un margen global. Para MVP, si falta duración, Admin debe aportar una duración estimada o el sistema debe marcar el conflicto como pendiente de validación.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

Driver Auth permanece `PENDING PRODUCT DECISION` y no bloquea este diseño. GPS permanece `POST-MVP / FUTURE`.

## 15. Paradas

### 15.1 Inventario actual

Las coordenadas son valores WGS84 de referencia del seed y el seed advierte que no representan paradas oficiales de transporte público. No se cambian ni se declaran oficiales en esta fase.

| Stop ID | Nombre actual | Coordenadas | Utilizado por rutas | Posible nombre oficial | Validación requerida |
|---|---|---|---:|---|---|
| `c6d5f04f-7fac-4561-9182-6783d1799700` | Costalmar Shopping | `-2.1853820, -80.0058523` | 2 | Por confirmar | Nombre, punto y autorización |
| `caa1e951-7c4e-46a0-b4da-ddd8dbea8958` | Estadio George Capwell | `-2.2066230, -79.8937897` | 2 | Por confirmar | Nombre, punto y autorización |
| `11967546-9ffa-4e00-8197-e70c24d71b78` | Hospital Teodoro Maldonado Carbo | `-2.2326772, -79.8984470` | 2 | Por confirmar | Nombre, punto y autorización |
| `26f6df63-c434-411d-8956-df43be239ab6` | Mall del Sol | `-2.1550405, -79.8926855` | 2 | Por confirmar | Nombre, punto y autorización |
| `d78250ee-3842-4ad1-92d9-6b67f5512d85` | Mall del Sur | `-2.2272268, -79.8979628` | 2 | Por confirmar | Nombre, punto y autorización |
| `96d90fc4-c58f-4e47-ae4a-268294514df7` | Parque Centenario | `-2.1898725, -79.8876439` | 2 | Por confirmar | Nombre, punto y autorización |
| `d2e13afb-7709-4353-bf49-b7efa8fcb157` | Puerto Azul | `-2.1906289, -79.9675719` | 3 | Por confirmar | Nombre, punto y autorización |
| `541b5819-3ddd-4a29-ab94-80d7de7fcb45` | Terminal 25 de Julio | `-2.2396900, -79.8983100` | 2 | Por confirmar | Nombre, punto y autorización |
| `355cfb07-900f-41a3-bc52-0d1a63d502a7` | Terminal Río Daule | `-2.1401756, -79.8800529` | 2 | Por confirmar | Nombre, punto y autorización |
| `78992cdd-b8bb-4611-9d62-1a28c6d35006` | Terminal Terrestre Municipal Costa | `-2.1817002, -79.9493309` | 3 | Por confirmar | Diferenciar de otros puntos Costa |
| `384d6a1e-c4ae-4c23-9683-c652136084b5` | UPS Campus Centenario | `-2.2206355, -79.8866590` | 5 | Por confirmar | Nombre, acceso y punto exacto |
| `97a84c83-5156-4b91-a873-cf2154bce841` | UPS Campus María Auxiliadora | `-2.1918485, -80.0458099` | 3 | Por confirmar | Nombre, acceso y punto exacto |
| `1e3d6a35-efb0-4f36-b965-4606b2e46dbc` | Universidad Católica de Santiago de Guayaquil | `-2.1815949, -79.9042370` | 1 | Por confirmar | Autorización del punto |
| `01a9935f-df4e-4c3a-9cb4-74f6c3cc2591` | Universidad de Guayaquil | `-2.1814973, -79.8986378` | 2 | Por confirmar | Autorización del punto |

### 15.2 Hallazgos

- No hay coordenadas faltantes en los 14 registros locales.
- No hay nombres duplicados exactos en el inventario consultado.
- “Terminal Río Daule” y “Terminal Terrestre Municipal Costa” son nombres distintos; la institución debe confirmar si ambos son denominaciones oficiales o puntos con alcance diferente.
- Hay convergencia real: 13 de 14 paradas son usadas por dos o más rutas; UPS Campus Centenario aparece en cinco.

### 15.3 Decisión arquitectónica

La misma parada física debe poder pertenecer a Norte, Sur y La Joya sin duplicarse:

```text
Stop
  ↑
StopMembership
  ↓
RouteVariant
```

Cada membresía conserva orden, tiempos estimados, notas y vigencia por variante.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` para el catálogo oficial; `RECOMMENDED` para la arquitectura compartida.

## 16. Incidencias

### Alcance MVP recomendado

Una incidencia es un hecho operativo, no un comunicado. Tipos mínimos:

```text
DELAY
VEHICLE_BREAKDOWN
ROUTE_DEVIATION
STOP_CLOSED
SERVICE_INTERRUPTION
OTHER
```

Debe poder relacionarse con línea, variante, salida, operación o parada, guardar estado, actor, hora, motivo y resolución.

`OperationalIncident ≠ Notice`:

- incidencia: lo que ocurrió en la operación;
- aviso: lo que se comunica a estudiantes o administradores;
- una incidencia puede producir un aviso, pero no toda incidencia necesariamente se publica.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

## 17. Avisos

### Alcance recomendado para el primer Admin Web

Permitir alcance:

```text
NETWORK
SERVICE_LINE
ROUTE_VARIANT
```

La relación con `STOP` debe habilitarse porque una parada cerrada es un caso operativo relevante. El alcance directo a una salida específica puede agregarse junto con el dominio de salidas si no se resuelve adecuadamente con una incidencia.

Los avisos mantienen vigencia, severidad y publicación. Una cancelación no debe depender exclusivamente de crear un aviso: el estado de la salida debe ser verdadero por sí mismo.

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED`.

## 18. Student UX

No se modifica Mobile en esta fase. Se fija la arquitectura conceptual para que la próxima evolución no vuelva a diseñar sobre el catálogo plano.

### Navegación recomendada

```text
Inicio
Rutas
Avisos
Perfil
```

Favoritos se mantiene como función y puede integrarse dentro de Inicio/Rutas. No es necesario eliminar inmediatamente el tab actual; esa es una decisión de implementación de Fase 6.

### Jerarquía de Inicio

1. Aviso crítico vigente.
2. Ruta Norte.
3. Ruta Sur.
4. Ruta La Joya.
5. Próxima salida por línea.
6. Estado operativo real.
7. Favoritos relevantes.

La pregunta principal debe ser: **“¿Qué puedo tomar ahora o próximamente?”**

### Información por estado

| Estado real | Mostrar |
|---|---|
| `PUBLISHED` | Línea, sentido, horario, paradas y variante si aplica |
| `ASSIGNED` | No decir “En recorrido”; opcionalmente “Unidad asignada”, solo si UPS lo considera útil |
| `IN_PROGRESS` | “En recorrido”, código del bus, placa/conductor si la política lo permite y hora de inicio |
| `COMPLETED` | Finalizado, preferentemente en la salida/historial |
| `CANCELLED` | Cancelado, fecha y motivo cuando corresponda |
| Sin dato operativo | “Sin información operativa actualizada”; nunca afirmar “Operativo” por defecto |

**Estado:** `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` para mostrar placa/conductor; `RECOMMENDED` para no convertir asignación en recorrido.

## 19. Admin Web

### Módulos MVP

1. **Dashboard:** operación de hoy, líneas, sentidos, variantes, salidas, asignaciones, operaciones, recursos faltantes e incidencias.
2. **Servicio:** líneas, variantes/ramales, sentidos, paradas, orden y tiempos.
3. **Programación:** calendarios, vigencias, horas explícitas, excepciones y publicación.
4. **Operación:** salidas del día, asignaciones, reemplazos, estados, cancelaciones y suspensiones.
5. **Flota:** vehículos y disponibilidad por fecha.
6. **Conductores:** catálogo y disponibilidad por fecha; no Driver Auth todavía.
7. **Comunicaciones:** avisos e incidencias.
8. **Administración:** usuarios administrativos, roles y consulta de auditoría.

### Datos mínimos requeridos por el futuro Dashboard

Esto es requerimiento funcional, no payload final:

```text
serviceDate
line
variant
departure
assignmentStatus
operationStatus
vehicle
driver
incidents
```

### Fuera de alcance

- Driver Auth.
- GPS, tracking, websockets o ETA por ubicación.
- Integrar un mapa como sustituto de la planificación.
- Nuevos roles sin necesidad demostrada.
- Cambiar la identidad visual vigente de UPS GO.

## 20. Matriz de decisiones

Las 13 decisiones pendientes identificadas en Fase 4 aparecen aquí con respuesta propuesta. “Recomendado” no equivale a “aprobado”.

| ID | Decisión | Evidencia | Recomendación | Alternativas | Impacto | Requiere aprobación humana | Estado |
|---|---|---|---|---|---|---|---|
| D01 | ¿Cómo se asignan los siete registros a Norte, Sur y La Joya? | Tres líneas son vocabulario Student; seed tiene notas demo contradictorias | Usar candidatos Río Daule=Norte, 25 de Julio=Sur, Costa/María=La Joya, sin backfill hasta aprobación | Reasignar cualquier par; mantener alguno en `UNKNOWN` | Alto: catálogo, favoritos, reportes y UX | Sí | `BUSINESS_APPROVAL_REQUIRED / BLOCKED_BY_DATA` |
| D02 | ¿Qué es Intercampus? | Hay recorrido y horarios propios, pero no línea oficial | Mantener `UNKNOWN` como servicio especial candidato | Cuarta línea; variante de La Joya; servicio de otra línea | Alto: navegación y calendario | Sí | `BUSINESS_APPROVAL_REQUIRED` |
| D03 | ¿Cómo se modelan Ida y Retorno? | Existen pares actuales con direction IDA/RETORNO | Dos variantes/sentidos relacionados, con paradas y horarios independientes | Retorno derivado de Ida; no recomendado | Alto: paradas y horarios | Sí | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D04 | ¿Qué constituye un ramal? | No hay entidad actual; hay paradas compartidas | Cambio material de secuencia, paradas, origen/destino o recorrido | Crear por hora; crear por bus; no recomendado | Alto: catálogo y operación | Sí | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D05 | ¿Varios buses del mismo horario son varias operaciones? | Reunión confirma múltiples buses; modelo actual no lo soporta | Sí: una salida publicada con 1:N operaciones reales | Horarios duplicados; capacidad agregada; no recomendado | Crítico: operación, estado Student y conflictos | Sí | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D06 | ¿Se separan salida programada y operación real? | API actual confunde asignación `SCHEDULED` con current operation | Sí: publicar no inicia; solo acción válida produce `IN_PROGRESS` | Mantener fallback actual; no recomendado | Crítico: confianza del estudiante | No para el principio; sí para estados operativos finales | `RECOMMENDED` |
| D07 | ¿Assignment y ServiceRun son lo mismo? | Assignment actual solo vincula ruta/fecha/bus/conductor | Separarlos: `ASSIGNED` puede existir sin `IN_PROGRESS` | Una sola entidad; no recomendado | Crítico: múltiples buses y reemplazos | Sí para estados y flujo | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D08 | ¿Horas explícitas o frecuencia? | Los 90 horarios demo son horas concretas | MVP con horas explícitas; dominio preparado para ambas | Solo frecuencia; ambas desde el día uno | Medio/alto: complejidad y flexibilidad | Sí para frecuencia futura | `RECOMMENDED` |
| D09 | ¿Calendario y período académico? | Hay necesidad de vacaciones, feriados, exámenes y eventos | Calendario con vigencia y excepciones; no `AcademicPeriod` en MVP | Crear período académico desde el inicio | Alto: fechas de servicio | Sí para calendario oficial | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D10 | ¿Se necesita publicación Draft/Published/Cancelled? | Horarios actuales son activos/inactivos; no hay flujo de publicación | Borrador para reglas/patrones; salidas publicadas/canceladas; no mezclar operación | Draft por cada salida desde el inicio | Medio: administración y UX | Sí | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D11 | ¿Cómo se distinguen cancelación y suspensión? | Estados actuales mezclan conceptos | Cancelada=no sale; suspendida=interrupción temporal; siempre actor/hora/motivo | Usar `SUSPENDED` como cancelación previa; no recomendado | Alto: comunicación y reportes | Sí | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D12 | ¿Qué ocurre con mantenimiento y conflictos? | Existe asignación activa con BUS-004 en mantenimiento; no hay ventanas operativas | Bloquear inicio, reemplazar/liberar asignación y validar solapamiento por bus/conductor | Cancelar automáticamente; permitir inicio; no recomendado | Crítico: seguridad y operación diaria | Sí para duración/buffer | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |
| D13 | ¿Qué ve el estudiante y quién administra? | Hay ADMIN/SUPER_ADMIN y Student actual plano; política de placa no está definida | No mostrar conductor/placa como activo antes de iniciar; conservar dos roles y permisos extensibles | Mostrar datos desde asignación; crear roles nuevos ahora | Alto: privacidad, confianza y administración | Sí para visibilidad | `RECOMMENDED — BUSINESS_APPROVAL_REQUIRED` |

## 21. Información oficial requerida

Solicitar únicamente lo que no se puede determinar con el repositorio:

1. Mapping oficial de cada recorrido actual a Norte, Sur, La Joya o servicio independiente.
2. Decisión oficial para Intercampus.
3. Lista de ramales existentes, con origen, destino y paradas de cada uno.
4. Catálogo oficial de paradas, incluyendo nombre, punto de abordaje y coordenadas autorizadas.
5. Horarios oficiales por sentido, recorrido y día.
6. Reglas para múltiples buses en una misma salida.
7. Calendario de servicio: clases, exámenes, vacaciones, feriados y eventos especiales.
8. Duraciones estimadas y margen mínimo entre salidas para evitar conflictos de bus/conductor.
9. Política cuando un vehículo entra en mantenimiento antes o durante el servicio.
10. Información que puede ver el estudiante sobre vehículo y conductor.
11. Tipos de incidencias que deben convertirse en avisos visibles.
12. Responsables autorizados para publicar, cancelar, suspender y reemplazar una salida.

No se solicita nuevamente confirmar que existen Norte, Sur, La Joya, Ida/Retorno, paradas ordenadas, horarios programados, varios buses, rotación ni que GPS/Driver Auth están fuera de esta fase: eso ya forma parte del contexto de negocio recibido.

## 22. Preguntas para reunión

Texto preparado para copiar a WhatsApp, correo o reunión. No requiere conocer términos técnicos:

```text
1. Para la aplicación tendremos tres rutas principales: Norte, Sur y La Joya. ¿Correcto?

2. ¿El recorrido desde Río Daule hasta Campus Centenario pertenece a Norte?

3. ¿El recorrido desde 25 de Julio hasta Campus Centenario pertenece a Sur?

4. ¿El recorrido desde Terminal Costa hasta Campus María Auxiliadora pertenece a La Joya?

5. ¿El recorrido Intercampus es una cuarta ruta, un servicio especial o parte de alguna de las tres rutas?

6. Dentro de cada ruta, ¿Ida y Retorno pueden tener paradas y horarios diferentes?

7. ¿Cuándo debemos considerar que existe un ramal diferente: cuando cambia el origen, el destino, las paradas o el recorrido?

8. Si a las 06:40 salen tres buses de Ruta Norte, ¿la aplicación debe tratarlos como tres unidades separadas?

9. ¿Está bien que una salida aparezca como programada aunque todavía no haya comenzado ningún bus?

10. ¿En qué momento exacto debe aparecer “En recorrido” para los estudiantes?

11. Si un bus asignado entra en mantenimiento antes de salir, ¿se reemplaza primero y solo se cancela si no hay reemplazo?

12. ¿Qué horarios oficiales aplican en clases, exámenes, vacaciones, feriados y eventos especiales?

13. ¿Los horarios deben ser horas concretas o también habrá servicios que salgan cada cierto número de minutos?

14. ¿El estudiante puede ver antes de la salida el número de bus, la placa o el nombre del conductor?

15. ¿Qué situaciones deben generar un aviso visible: retraso, bus averiado, parada cerrada, desvío o suspensión?

16. ¿Quiénes pueden publicar horarios, cancelar salidas, suspender servicios y hacer reemplazos?

17. ¿Las paradas y coordenadas actuales son oficiales o deben reemplazarse por un catálogo entregado por UPS?
```

## 23. GO / NO-GO para Fase 5

### GO FASE 5 DESIGN

Se puede iniciar el diseño técnico de Fase 5 porque:

- la separación línea → variante → paradas → programación → operación está suficientemente definida;
- la regla `ScheduledDeparture 1:N ServiceRun` resuelve múltiples buses;
- la separación entre asignación y operación resuelve el error de mostrar un bus programado como activo;
- el MVP puede limitarse a horas explícitas y calendario con excepciones;
- Driver Auth y GPS pueden quedar como extensiones posteriores;
- los datos desconocidos pueden representarse como pendientes de validación, sin inventarlos.

El diseño debe incluir desde el inicio compatibilidad con el contrato actual, mapping explícito y una estrategia de doble lectura. No se debe codificar el catálogo hipotético como si fuera oficial.

### NO-GO FASE 5 IMPLEMENTATION

No se deben ejecutar migraciones ni backfill hasta aprobar:

- el mapping de las siete rutas;
- el destino de Intercampus;
- el catálogo oficial de paradas y coordenadas;
- los ramales reales;
- horarios y calendario oficial;
- reglas de múltiples buses, conflictos y reemplazos;
- visibilidad de conductor/vehículo.

### Estado definitivo

```text
GO FASE 5 DESIGN:            SÍ
GO FASE 5 IMPLEMENTATION:   NO
MIGRACIONES PRISMA:          NO
CAMBIOS API/MOBILE:          NO
ADMIN WEB:                   NO, todavía
DRIVER AUTH / GPS:           DEFERRED
```

## 24. Evidencia y límites de ejecución

Se usaron como evidencia el blueprint de Fase 4, el schema Prisma, seed, servicios/controladores API, tipos/servicios/pantallas Student, documentación de contrato y consultas `SELECT` locales.

Consultas de datos ejecutadas:

- conteos de rutas, paradas, relaciones, horarios, vehículos, conductores, asignaciones, viajes y avisos;
- inventario de paradas con coordenadas y cantidad de rutas;
- secuencias de paradas por ruta;
- asignaciones con estado actual de vehículo;
- restricciones de base actuales;
- duplicados de horario por ruta/día/dirección/hora.

No se ejecutaron `INSERT`, `UPDATE`, `DELETE`, migraciones, `db push`, generación de Prisma ni cambios de código.

## 25. Delivery Gate — Fase 4.1

| Check | Estado | Evidencia |
|---|---|---|
| lint PASS | N/A | Fase de planificación; no se modificó código |
| typecheck PASS | N/A | Fase de planificación; no se modificó código |
| build PASS | N/A | Fase de planificación; no se modificó código |
| tests PASS | N/A | Fase de planificación; no se modificó código |
| Migraciones revisadas | ✅ | No se ejecutaron ni se generaron migraciones; solo se inspeccionó el schema |
| OpenAPI/Swagger actualizado | N/A | No se modificó contrato; se identificó que el resumen documentado omite módulos existentes |
| `.env.example` actualizado | N/A | No se modificó configuración |
| Documentación mínima actualizada | ✅ | Se creó este decision pack como único archivo nuevo de Fase 4.1 |
| QA manual del flujo afectado | N/A | No se modificó Student ni Admin Web; se auditó el flujo existente |
| Cambios en `apps/api` | ✅ | Ningún cambio nuevo de esta fase; existían modificaciones previas en el worktree |
| Cambios en `apps/mobile` | ✅ | Ningún cambio nuevo de esta fase; existían modificaciones previas en el worktree |
| Cambios en Prisma/datos | ✅ | Solo consultas `SELECT`; no hubo escritura ni migración |

**Estado: DONE ✅ — entregable documental de Fase 4.1 completado.**
