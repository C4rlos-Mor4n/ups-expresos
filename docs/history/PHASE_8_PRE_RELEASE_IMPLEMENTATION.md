# Phase 8 — Pre-release implementation

## Alcance local

Phase 8 prepara UPS GO para una demostración operativa local sin reintroducir
el dominio de transporte legado. La migración
`20260829154419_decommission_legacy_transport_domain` retira las tablas y
módulos sin consumidores; el producto usa exclusivamente el dominio
`Campus → ServiceLine → ServiceCalendar → SchedulePattern → ScheduleTime →
ScheduleJourneyTemplate → ScheduledDeparture → ServiceAssignment → ServiceRun`.

El seed repetible es `apps/api/scripts/seed-demo.ts`. En desarrollo:

```bash
cd apps/api
pnpm prisma:reset:demo
```

El comando borra únicamente el dataset identificado como `UPS-GO-DEMO` y lo
recrea. Nunca se ejecuta con `NODE_ENV=production`.

## Dataset de demostración

- Campus: `Campus María Auxiliadora · Demo UPS GO`.
- Línea: `Ruta Norte`.
- Caminos: Ida y Retorno; seis paradas de referencia.
- Dos salidas materializadas para el día local y una asignación primaria.
- Vehículo: `UPS-GO-DEMO-BUS-01`.
- Estado inicial: `ASSIGNED`, sin `ServiceRun`.
- Cuentas: un `SUPER_ADMIN`, un `DRIVER` activo y un `STUDENT`.

La cuenta `SUPER_ADMIN` no accede al producto operativo móvil. Student y
Driver conservan sus límites de rol y solo Driver puede iniciar/finalizar su
asignación propia.

## Estado de cierre

El cierre descrito aquí es local. No certifica todavía commit, push, PR,
merge ni CI remoto; esos gates requieren revisión independiente posterior.
