# API de UPS GO

Backend de la plataforma: autenticación, dominio de transporte, operación de
estudiantes/conductores y administración. Código en [`apps/api`](../../apps/api).

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (modo `strict`, `noUncheckedIndexedAccess`) |
| Runtime | Node.js 20 |
| Framework | NestJS 11 (monolito modular) |
| Base de datos | PostgreSQL 17 + Prisma 6 (`prisma-client-js`, motor `classic`) |
| Validación | `class-validator` / `class-transformer` (DTOs) y `zod` (variables de entorno) |
| Autenticación | OTP por correo + JWT (access/refresh con rotación), `passport-jwt` |
| Documentación de contrato | `@nestjs/swagger` → OpenAPI → `openapi-typescript` (app móvil) |
| Seguridad HTTP | `helmet`, CORS explícito, `@nestjs/throttler` (rate limiting) |
| Correo | `nodemailer` (SMTP) |
| Pruebas | Jest, ts-jest, Supertest; PostgreSQL aislado para integración/E2E |
| Gestor de paquetes | pnpm 10 |

No hay Redis, colas ni microservicios: el alcance actual no lo requiere. Redis se
incorporará cuando exista el flujo de posiciones en tiempo real (ver
[`tracking-hunter.md`](./tracking-hunter.md)).

## Arquitectura

Monolito modular. Cada módulo vive en `src/modules/<nombre>` con su controlador,
servicio, DTOs y pruebas. El acceso a datos es siempre a través de `PrismaService`
(`src/database`); no hay SQL fuera de Prisma salvo constraints en migraciones y los
bloqueos advisory de la asignación de servicios.

```text
src/
  main.ts                bootstrap (helmet, CORS, ValidationPipe, filtro global, Swagger)
  app.module.ts          composición; guards globales: JWT → Roles → Throttler
  config/                esquema zod de entorno, tipado de configuración, Swagger
  common/                decoradores (@Public, @Roles, @CurrentUser), guards, filtro de errores, paginación
  database/              PrismaModule / PrismaService
  modules/
    auth/                OTP, sesiones, JWT, proveedores de correo (SMTP / desarrollo)
    health/              /health y /health/db
    audit-logs/          escritura de bitácora de acciones administrativas
    stops/               CRUD de paradas (Admin)
    vehicles/            CRUD de buses (Admin)
    drivers/             CRUD de conductores (Admin)
    calendar/            CalendarResolver, materializador de salidas y API de horarios (Admin)
    operational/         Student, Driver y planificación operativa (Admin)
```

### Seguridad por defecto

- **Todo endpoint exige JWT** salvo los marcados con `@Public()`.
- `@Roles(...)` restringe por rol (`STUDENT`, `DRIVER`, `ADMIN`, `SUPER_ADMIN`).
- `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`: campos desconocidos se rechazan.
- Rate limiting global (60 solicitudes/60 s por IP) y más estricto en OTP:
  `request-code` 3/min, `verify-code` 5/min.
- Una excepción global traduce errores de Prisma (P2002/P2025/P2003) a 409/404/409 y oculta detalles internos.
- Los refresh tokens se guardan hasheados y se rotan de forma atómica.

### Zona horaria

La hora civil del servicio es `America/Guayaquil` (UTC-5, sin DST). Fechas de servicio (`DATE`)
y horas programadas (`TIME`) son civiles; los instantes reales (`plannedStartAt`,
`startedAt`, …) son `TIMESTAMPTZ`. En los contenedores se fija `TZ=America/Guayaquil`.

## Puesta en marcha local

```bash
cd apps/api
cp .env.example .env                      # ajusta valores; nunca se versiona
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL de desarrollo (5433) y de test (5434)
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma:seed                          # crea los SUPER_ADMIN de SUPER_ADMIN_EMAILS
pnpm start:dev                            # http://localhost:3000  (Swagger en /docs)
```

Para desarrollo con emulador Android y app, el script [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh)
levanta base de datos, API, Metro y la app (ver [`../app/build-and-release.md`](../app/build-and-release.md)).

Sin SMTP configurado el correo no sale: pon `AUTH_DEV_EXPOSE_OTP=true` en `.env` para
recibir el código OTP en la respuesta de `POST /auth/request-code` (solo desarrollo).

## Scripts de `package.json`

| Script | Qué hace |
|---|---|
| `start:dev` | API en modo watch. |
| `build` / `start:prod` | Compila a `dist/` y ejecuta `node dist/src/main.js`. |
| `lint`, `typecheck`, `test` | Gates estáticos y pruebas unitarias. |
| `test:*:integration`, `test:e2e` | Pruebas contra PostgreSQL aislado (ver [`testing.md`](./testing.md)). |
| `prisma:validate / generate / migrate / studio` | Utilidades de Prisma. |
| `prisma:seed` | Seed base: usuarios `SUPER_ADMIN` de `SUPER_ADMIN_EMAILS`. |
| `prisma:seed:reference` | Carga el dataset de referencia de Guayaquil y materializa salidas. |
| `prisma:seed:demo` / `prisma:reset:demo` | Dataset de demostración etiquetado `UPS-GO-DEMO`. |
| `qa:showcase:reset` | Reconstruye el showcase de QA (destructivo, solo local; exige `CONFIRM_LOCAL_QA_RESET=YES`). |
| `export:openapi`, `generate:mobile-contracts`, `verify:mobile-contracts`, `test:openapi` | Contrato OpenAPI y tipos de la app. |

## Documentos relacionados

- [`domain.md`](./domain.md) — modelo de datos y reglas de negocio.
- [`endpoints.md`](./endpoints.md) — superficie HTTP y quién la consume.
- [`auth-flow.md`](./auth-flow.md) y [`auth-client-guide.md`](./auth-client-guide.md) — flujo de autenticación.
- [`configuration.md`](./configuration.md) — todas las variables de entorno.
- [`deployment.md`](./deployment.md) — Docker, Dokploy, migraciones, respaldo.
- [`testing.md`](./testing.md) — gates y pruebas.
- [`conventions.md`](./conventions.md) — reglas para contribuir.
- [`tracking-hunter.md`](./tracking-hunter.md) — plan de integración GPS (Hunter DataForward).
