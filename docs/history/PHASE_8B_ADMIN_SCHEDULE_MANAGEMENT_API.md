# UPS GO — FASE 8B Admin Schedule Management API

## Alcance

La API administrativa permite configurar calendarios, patrones, horas civiles,
journey templates, itinerarios por `RoutePathStop`, excepciones y
materialización de `ScheduledDeparture`. La UI Web se implementará en una fase
posterior.

## Lifecycle

- `ServiceCalendar`: `DRAFT` → `PUBLISHED` → `ARCHIVED`.
- Un calendario `DRAFT` es editable.
- Un calendario `PUBLISHED` no permite alterar horarios regulares.
- Una excepción `DRAFT` puede configurarse después de publicar el calendario y
  debe publicarse por separado.
- Un calendario `ARCHIVED` es inmutable.

## Publicación

La publicación rechaza configuraciones incompletas: cada patrón regular debe
tener días, horas, uno o más journeys válidos y cobertura completa de las
paradas del recorrido. `RoutePathStop.stopOrder` determina el orden y
`ScheduledStopTime.offsetMinutes` es la fuente de verdad temporal. El primer
offset debe ser cero y los offsets no pueden decrecer.

## Excepciones

Se usan únicamente los tipos del dominio: `NO_SERVICE`, `REPLACE_TIMES` y
`ADD_TIMES`. Los patrones de reemplazo son específicos de la fecha y no usan
`SchedulePatternDay`.

## Materialización

`POST /admin/schedules/materialization` reutiliza `CalendarResolver` y
`ScheduledDepartureMaterializer`. El rango máximo existente se respeta y la
operación es idempotente mediante la identidad
`sourceScheduleTimeId + serviceDate`.

## Timezone

Las fechas operativas y horas recurrentes se interpretan en
`America/Guayaquil`. Las horas civiles no se convierten arbitrariamente a UTC.
