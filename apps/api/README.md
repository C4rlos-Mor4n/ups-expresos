# UPS GO API

API NestJS/Prisma de UPS GO. El dominio operativo activo separa el horario
publicado de la ejecución real:

```text
Campus → ServiceLine → ServiceCalendar → SchedulePattern → ScheduleTime
       → ScheduleJourneyTemplate → ScheduledDeparture
       → ServiceAssignment → ServiceRun
```

Las entidades `Route`, `Schedule`, `Trip`, `RouteAssignment`, `Notice` y
`TripFeedback` pertenecen al dominio retirado y no forman parte del contrato
actual.

## Requisitos

- Node.js 20
- pnpm 10.34.5
- PostgreSQL 17

Configura variables locales a partir de `.env.example`. Nunca subas `.env`.

## Desarrollo

Desde la raíz del repositorio, el flujo habitual para API, Metro y Android es:

```bash
./scripts/dev-stack.sh
```

Para detener únicamente esos procesos del checkout actual:

```bash
./scripts/dev-stack.sh --stop
```

Para ejecutar la API por separado:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm start:dev
```

## Dataset de demostración

En un entorno local no productivo:

```bash
pnpm prisma:reset:demo
```

El reset elimina únicamente datos identificados como `UPS-GO-DEMO` y recrea
tres usuarios, un conductor, un vehículo, dos salidas y una asignación en
estado `ASSIGNED`, sin `ServiceRun`. El script se bloquea con
`NODE_ENV=production`.

## Calidad y migraciones

```bash
pnpm prisma format
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate status
pnpm lint
pnpm typecheck
pnpm build
pnpm exec jest --runInBand
pnpm test:openapi
pnpm verify:mobile-contracts
```

Las transiciones de esquema usan exclusivamente migraciones controladas. No
uses `prisma db push` para modificar el esquema.

## Contrato API a Mobile

La fuente de verdad del contrato es el encadenamiento:

```text
DTOs NestJS → OpenAPI generado → apps/mobile/src/api/generated/openapi.ts
```

Después de cambiar DTOs o anotaciones Swagger:

```bash
pnpm generate:mobile-contracts
pnpm verify:mobile-contracts
```

El segundo comando falla si el tipo generado no está sincronizado con el API.
No se mantiene un archivo OpenAPI manual o un handoff estático en paralelo.

## Superficies activas

- Auth: OTP, refresh, logout y perfil.
- Student: campus, líneas de servicio y salidas materializadas.
- Driver: asignaciones propias, recorrido actual, inicio y finalización.
- Admin operacional: consulta de dominio operativo y creación de asignaciones.

El backend sigue siendo la autoridad de autenticación y roles. La aplicación
móvil solo ofrece flujos para `STUDENT` y `DRIVER`; `SUPER_ADMIN` no recibe un
flujo móvil operativo.

Admin Web, GPS, tiempo real y ETA no forman parte de este alcance.
