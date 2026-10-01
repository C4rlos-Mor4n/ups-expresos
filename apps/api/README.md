# UPS GO API

Backend NestJS + Prisma + PostgreSQL de UPS GO. La documentación completa vive en
[`docs/api`](../../docs/api/README.md); este archivo es la guía rápida.

```text
Campus → ServiceLine → ServiceCalendar → SchedulePattern → ScheduleTime
       → ScheduleJourneyTemplate → ScheduledDeparture
       → ServiceAssignment → ServiceRun
```

## Requisitos

- Node.js 20 y pnpm 10
- PostgreSQL 17 (o Docker)

## Inicio rápido

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d     # PostgreSQL de desarrollo (5433) y test (5434)
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm prisma generate
pnpm start:dev                                      # http://localhost:3000, Swagger en /docs
```

Sin SMTP, usa `AUTH_DEV_EXPOSE_OTP=true` en `.env` para recibir el OTP en la respuesta de `/auth/request-code`.

## Comandos habituales

```bash
pnpm lint && pnpm typecheck && pnpm build
pnpm exec jest --runInBand                  # unitarias
pnpm test:openapi && pnpm verify:mobile-contracts
pnpm generate:mobile-contracts              # tras cambiar DTOs: regenera los tipos de la app
pnpm prisma:seed:reference                  # carga el dataset de referencia de Guayaquil (entorno descartable)
```

Pruebas de integración y E2E (PostgreSQL aislado): [`docs/api/testing.md`](../../docs/api/testing.md).

## Despliegue

`Dockerfile` en este directorio y `docker-compose.yml` en la raíz del repositorio.
Guía: [`docs/api/deployment.md`](../../docs/api/deployment.md).

## Reglas esenciales

- Cambios de esquema **solo con migraciones**; nunca `prisma db push`.
- Contrato: DTOs → OpenAPI → `apps/mobile/src/api/generated/openapi.ts` (no se edita a mano).
- Sin `any`; toda ruta declara `@Roles` o `@Public`.
- El backend es la autoridad de roles, propiedad y estados.

Más en [`docs/api/conventions.md`](../../docs/api/conventions.md).
