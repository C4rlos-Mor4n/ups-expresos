# UPS GO

Plataforma institucional de transporte de la Universidad Politécnica Salesiana (Guayaquil): los estudiantes consultan
campus, líneas, salidas y buses asignados; los conductores ejecutan el servicio que se les asignó; la administración
(panel web, en construcción) configura y opera todo desde la API.

## Estructura

| Ruta | Contenido |
|---|---|
| [`apps/api`](./apps/api) | Backend NestJS + Prisma + PostgreSQL. |
| [`apps/mobile`](./apps/mobile) | App Expo / React Native (Student y Driver). |
| [`docs`](./docs/README.md) | Documentación: `api/`, `app/`, `web/` e `history/`. |
| [`scripts`](./scripts) | `dev-stack.sh`: stack de desarrollo local (BD, emulador, API, Metro). |
| [`docker-compose.yml`](./docker-compose.yml) | Despliegue de la API (PostgreSQL + migraciones + API). |

El panel administrativo web **aún no existe**; ver [`docs/web`](./docs/web/README.md).

## Inicio rápido

### Desplegar la API con Docker

```bash
cp .env.example .env            # completa secretos, SMTP y dominios
docker compose up -d --build    # postgres + migraciones + API (puerto interno 3000, tras reverse proxy)
```

Guía completa (Dokploy, respaldo, verificación): [`docs/api/deployment.md`](./docs/api/deployment.md).

### Desarrollo de la API

```bash
cd apps/api
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm install --frozen-lockfile && pnpm prisma migrate deploy && pnpm start:dev
```

### Desarrollo de la app

```bash
cd apps/mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL
npm ci && npm run verify
```

Stack completo en emulador: `./scripts/dev-stack.sh`. Detalles en [`docs/app`](./docs/app/README.md).

## Variables de entorno

| Archivo | Para |
|---|---|
| [`.env.example`](./.env.example) | `docker-compose.yml` (despliegue). |
| [`apps/api/.env.example`](./apps/api/.env.example) | API en desarrollo local. |
| [`apps/mobile/.env.example`](./apps/mobile/.env.example) | App móvil (`EXPO_PUBLIC_API_URL`). |

Los `.env` reales no se versionan. Referencia de cada variable: [`docs/api/configuration.md`](./docs/api/configuration.md).

## Calidad

CI (`.github/workflows/ci.yml`) ejecuta, para la API, migraciones, integraciones contra PostgreSQL, lint, typecheck, build,
pruebas, contrato OpenAPI y verificación de tipos generados; y, para la app, `npm run verify` y exportación Android.
Reglas de contribución: [`docs/api/conventions.md`](./docs/api/conventions.md) y [`docs/app/conventions.md`](./docs/app/conventions.md).

## Estado

App Student/Driver y API de operación y de horarios funcionales. Pendientes: panel web, GPS en tiempo real (Hunter),
ETA y notificaciones push. Resumen en [`docs/README.md`](./docs/README.md).
